# Athena — Basic Context Management
### Phase 1 Implementation Handoff

> Replace the current last-40-messages approach with token-budget trimming, cached summarization, and SSE status events. No Qdrant, no Celery, no embeddings yet — just PostgreSQL + tiktoken + a summarization call.

---

## The Problem

The current implementation loads the last 40 messages by count. This is naive for two reasons:

```
40 short messages  = maybe 1000 tokens  → wastes budget
40 long messages   = maybe 12000 tokens → exceeds context window
```

Message count tells you nothing useful. Token count tells you everything.

A fixed history budget also fails when the user sends a long message:

```
User pastes 2000 tokens of code + question
History is 2500 tokens (seemed fine before)
System prompt is 1000 tokens

Total: 1000 + 2500 + 2000 + 1192 = 6692 tokens → fine
But if history was 3500:
       1000 + 3500 + 2000 + 1192 = 7692 tokens → over limit
```

The history budget must be dynamic — calculated after accounting for the actual current message size.

---

## The Goal

```
Before:
└── Load last 40 messages regardless of token count

After:
├── Count current message tokens first
├── Calculate remaining budget for history
├── Check cached token_count — fast path if under budget
├── If over budget and summary exists → use cached summary + load recent only
├── If over budget and no summary → generate summary, cache it, use it
├── If message alone too large → reject with HTTP 400
└── Always protect most recent exchanges
```

---

## Token Budget

Total context window for Tier 1 (7B model): **8,192 tokens**

```
├── System prompt        1000 tokens   fixed — always reserved
├── Generation buffer    1192 tokens   fixed — always reserved
├── Current message      variable      counted first, subtracted from remaining
└── History              whatever's left after above three
                         ─────────────────────────────────
                         8192 - 1000 - 1192 - message_tokens
```

**History budget is not fixed — it's calculated per request:**

```
message = 100 tokens   → history budget = 5900
message = 500 tokens   → history budget = 5500
message = 1000 tokens  → history budget = 5000
message = 2000 tokens  → history budget = 4000
message = 3000 tokens  → history budget = 3000
message = 5000 tokens  → history budget = 1000
message = 6000 tokens  → history budget = 0 → no history at all
message > 5500 tokens  → HTTP 400 rejection
```

RAG chunks and user profile are not included yet — those come in later phases.

---

## Schema Changes

Three things needed in the conversations table before implementation:

```sql
-- Cached token count — incremented on every message save
-- avoids loading all messages just to check the budget
ALTER TABLE conversations
    ADD COLUMN token_count INTEGER DEFAULT 0;

-- Cached summary — generated when history first exceeds budget
-- reused on every subsequent request instead of regenerating
ALTER TABLE conversations
    ADD COLUMN summary TEXT,
    ADD COLUMN summarized_up_to_id INTEGER REFERENCES messages(id),
    ADD COLUMN last_summarized_at TIMESTAMP;

-- Flags for Phase 4 Celery + Qdrant integration (set now, used later)
ALTER TABLE conversations
    ADD COLUMN summary_embedded BOOLEAN DEFAULT false,
    ADD COLUMN last_embedded_at TIMESTAMP;
```

**Why `summary_embedded` now:** When Phase 4 arrives, the Celery sweep needs to know which summaries have been pushed to Qdrant and which haven't. Adding the column now means no migration later — it just sits as `false` until Celery is wired up.

---

## Files to Create / Modify

```
backend/app/core/context.py       ← create
backend/app/api/chat.py           ← modify (replace naive history loading)
```

---

## Full Implementation

### context.py

```python
# backend/app/core/context.py

import asyncio
import tiktoken
from fastapi import HTTPException
from app.db.database import db
from app.services.ollama import ollama

enc = tiktoken.get_encoding("cl100k_base")

# Fixed budget allocations
TOTAL_BUDGET      = 8192
SYSTEM_BUDGET     = 1000   # reserved for system prompt
GENERATION_BUDGET = 1192   # reserved for LLM response
PROTECT_LAST_N    = 6      # most recent messages never summarized

# Hard limit for a single user message
# 500 token floor ensures at least minimal history can always fit
MAX_MESSAGE_TOKENS = TOTAL_BUDGET - SYSTEM_BUDGET - GENERATION_BUDGET - 500
# = 5500 tokens


def count_tokens(messages: list[dict]) -> int:
    """
    Count tokens across a list of message dicts.
    Uses tiktoken cl100k_base — approximation for Ollama models (~5-15% variance).
    Conservative budget constants account for this.
    """
    total = 0
    for message in messages:
        total += len(enc.encode(message["content"]))
        total += 4  # per-message overhead (role + formatting)
    return total


def count_tokens_text(text: str) -> int:
    """Count tokens in a plain string."""
    return len(enc.encode(text))


async def summarize_messages(messages: list[dict]) -> str:
    """
    Summarize a list of messages into a concise paragraph.
    Uses Tier 1 model — fast and cheap.

    Two important notes:
    - Has a 15s timeout — falls back to a placeholder if Ollama is slow
    - Result gets cached in conversations.summary, not regenerated each request
    """
    formatted = "\n".join([
        f"{m['role'].upper()}: {m['content']}"
        for m in messages
    ])

    try:
        response = await asyncio.wait_for(
            ollama.chat(
                model="qwen2.5:7b",
                messages=[{
                    "role": "user",
                    "content": f"""Summarize this conversation segment concisely.
Preserve:
- Topics discussed
- Decisions or conclusions reached
- User's apparent knowledge level
- Any follow-up questions or confusion points

Keep under 200 words. Write in third person past tense.
Example: "User asked about gradient descent, focusing on learning rate..."

Conversation:
{formatted}"""
                }]
            ),
            timeout=15.0
        )
        return response.message.content

    except asyncio.TimeoutError:
        # Ollama too slow — return placeholder rather than crash
        return "Earlier conversation content unavailable (summarization timed out)."
    except Exception:
        # Any other failure — same fallback
        return "Earlier conversation content unavailable."


async def get_managed_history(
    conversation_id: str,
    current_message: str
) -> tuple[list[dict], bool]:
    """
    Load conversation history from PostgreSQL and fit it into the
    remaining token budget after accounting for the current message.

    Returns: (messages, will_summarize)
    - messages: assembled history ready for the prompt
    - will_summarize: True if a new summarization LLM call will be made
                      (used by chat.py to emit the status SSE event early)

    Three paths:
    1. Under budget → return all messages as-is
    2. Over budget, cached summary exists → prepend summary + load recent only
    3. Over budget, no summary → generate summary, cache it, prepend + recent
    """

    # Calculate dynamic budget
    current_tokens = count_tokens_text(current_message)
    history_budget = (
        TOTAL_BUDGET
        - SYSTEM_BUDGET
        - GENERATION_BUDGET
        - current_tokens
    )

    if history_budget <= 0:
        return [], False

    # Load conversation record — single query for token_count + cached summary
    conv = await db.fetch_one(
        """
        SELECT token_count, summary, summarized_up_to_id
        FROM conversations
        WHERE conversation_id = :id
        """,
        {"id": conversation_id}
    )

    # Fast path — cached token_count fits, load messages as-is
    if (conv["token_count"] or 0) <= history_budget:
        rows = await db.fetch_all(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = :id
            ORDER BY timestamp ASC
            """,
            {"id": conversation_id}
        )
        return [{"role": r["role"], "content": r["content"]} for r in rows], False

    # Over budget — check for cached summary
    if conv["summary"]:
        # Load only messages after the summarized point — no full history load
        rows = await db.fetch_all(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = :id
            AND id > :after_id
            ORDER BY timestamp ASC
            """,
            {"id": conversation_id, "after_id": conv["summarized_up_to_id"]}
        )
        recent = [{"role": r["role"], "content": r["content"]} for r in rows]

        # Check if recent messages alone are filling up again
        # If so, regenerate the summary to include them (progressive compression)
        if count_tokens(recent) > history_budget * 0.8:
            return await _regenerate_summary(conversation_id, history_budget)

        return [
            {
                "role": "system",
                "content": f"[Earlier in this conversation]: {conv['summary']}"
            },
            *recent
        ], False

    # No cached summary — need to generate one
    # Return will_summarize=True so chat.py can emit status event before this runs
    return await _generate_and_cache_summary(
        conversation_id, history_budget
    )


async def _generate_and_cache_summary(
    conversation_id: str,
    history_budget: int
) -> tuple[list[dict], bool]:
    """
    Generate a summary for the first time, cache it, return assembled history.
    Called when history exceeds budget and no cached summary exists yet.
    """
    rows = await db.fetch_all(
        """
        SELECT id, role, content FROM messages
        WHERE conversation_id = :id
        ORDER BY timestamp ASC
        """,
        {"id": conversation_id}
    )
    all_messages = [
        {"id": r["id"], "role": r["role"], "content": r["content"]}
        for r in rows
    ]

    protected = all_messages[-PROTECT_LAST_N:]
    trimmable = all_messages[:-PROTECT_LAST_N]

    if not trimmable:
        return [{"role": m["role"], "content": m["content"]} for m in protected], False

    midpoint = len(trimmable) // 2
    to_summarize = trimmable[:midpoint]
    remaining = trimmable[midpoint:]

    summary_text = await summarize_messages(to_summarize)
    last_summarized_id = to_summarize[-1]["id"]

    # Cache summary in PostgreSQL
    # summary_embedded stays false — Celery will flip it in Phase 4
    await db.execute(
        """
        UPDATE conversations SET
            summary = :summary,
            summarized_up_to_id = :up_to,
            last_summarized_at = NOW(),
            summary_embedded = false
        WHERE conversation_id = :id
        """,
        {
            "summary": summary_text,
            "up_to": last_summarized_id,
            "id": conversation_id
        }
    )

    return [
        {
            "role": "system",
            "content": f"[Earlier in this conversation]: {summary_text}"
        },
        *[{"role": m["role"], "content": m["content"]} for m in remaining],
        *[{"role": m["role"], "content": m["content"]} for m in protected]
    ], True  # True = summarization LLM call was made


async def _regenerate_summary(
    conversation_id: str,
    history_budget: int
) -> tuple[list[dict], bool]:
    """
    Regenerate the cached summary when recent messages fill up again.
    Same as _generate_and_cache_summary but called when a summary already exists.
    Progressive compression — rolls more content into the summary each time.
    """
    # Reuse the same logic — overwrites the existing cached summary
    return await _generate_and_cache_summary(conversation_id, history_budget)


def build_system_prompt() -> str:
    """
    Base system prompt for Phase 1.
    No RAG, no user profile — those come in later phases.
    """
    return (
        "You are Athena, a personal AI assistant. "
        "You help the user learn, research, and build. "
        "Be concise, precise, and adapt your explanation depth to the conversation."
    )


async def build_messages(
    conversation_id: str,
    current_message: str,
) -> tuple[list[dict], bool]:
    """
    Assemble the complete messages array for an LLM call.

    Returns: (messages, will_summarize)
    - messages: ready to pass to ollama.chat()
    - will_summarize: True if summarization LLM call is about to run
                      chat.py uses this to emit the status SSE event

    Rejects messages over MAX_MESSAGE_TOKENS — does not silently truncate.
    Truncation cuts at an arbitrary boundary, often dropping the question
    itself if it appears after a large code block.
    """

    # Reject oversized messages
    current_tokens = count_tokens_text(current_message)
    if current_tokens > MAX_MESSAGE_TOKENS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "message_too_long",
                "tokens": current_tokens,
                "max": MAX_MESSAGE_TOKENS,
                "message": "Message too long — try splitting code and question into separate messages"
            }
        )

    history, will_summarize = await get_managed_history(
        conversation_id=conversation_id,
        current_message=current_message
    )

    return [
        {"role": "system", "content": build_system_prompt()},
        *history,
        {"role": "user", "content": current_message}
    ], will_summarize


async def save_message(
    conversation_id: str,
    role: str,
    content: str
) -> None:
    """
    Save a message and keep token_count accurate on the conversation record.
    Always use this instead of inserting directly — token_count must stay current
    or the fast path in get_managed_history() will be wrong.
    """
    new_tokens = count_tokens_text(content)

    await db.execute(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES (:id, :role, :content)
        """,
        {"id": conversation_id, "role": role, "content": content}
    )

    await db.execute(
        """
        UPDATE conversations SET
            token_count  = token_count + :tokens,
            message_count = message_count + 1,
            last_active  = NOW()
        WHERE conversation_id = :id
        """,
        {"id": conversation_id, "tokens": new_tokens}
    )
```

---

## Wire Into chat.py

**Add imports:**

```python
from app.core.context import build_messages, count_tokens, save_message
```

**Replace naive history loading:**

```python
# BEFORE — delete this block
messages = await db.fetch_all(
    "SELECT role, content FROM messages WHERE conversation_id = :id LIMIT 40",
    {"id": conversation_id}
)
chat_messages = [
    {"role": "system", "content": "You are Athena..."},
    *[{"role": m["role"], "content": m["content"]} for m in messages],
    {"role": "user", "content": message}
]


# AFTER

async def generate():

    # build_messages returns will_summarize=True if a summarization
    # LLM call is about to happen — emit status event first so the
    # frontend shows a spinner instead of a frozen input
    try:
        chat_messages, will_summarize = await build_messages(
            conversation_id=conversation_id,
            current_message=message
        )
    except HTTPException:
        raise  # let FastAPI handle the 400

    if will_summarize:
        yield f"data: {json.dumps({'type': 'status', 'content': 'summarizing context...'})}\n\n"

    # Emit token count for frontend debug overlay
    yield f"data: {json.dumps({'type': 'context_debug', 'tokens': count_tokens(chat_messages)})}\n\n"

    # Stream LLM response
    full_response = ""
    try:
        async for chunk in await ollama.chat(
            model=model,
            messages=chat_messages,
            stream=True
        ):
            if chunk.message.content:
                full_response += chunk.message.content
                yield f"data: {json.dumps({'type': 'token', 'content': chunk.message.content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': 'Stream failed'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done'})}\n\n"

    # Save both messages using save_message() — keeps token_count accurate
    await save_message(conversation_id, "user", message)
    await save_message(conversation_id, "assistant", full_response)
```

---

## SSE Event Types

```
{"type": "status",        "content": "summarizing context..."}  — summarization running
{"type": "context_debug", "tokens": 3821}                       — total tokens sent to LLM
{"type": "token",         "content": " of"}                     — LLM token
{"type": "error",         "content": "Stream failed"}           — something went wrong
{"type": "done"}                                                 — stream complete
```

**Frontend handling:**

```typescript
const data = JSON.parse(line.slice(6))

switch (data.type) {
    case 'status':
        setStatus(data.content)       // "summarizing context..."
        break
    case 'context_debug':
        setContextTokens(data.tokens)
        break
    case 'token':
        setResponse(prev => prev + data.content)
        setStatus(null)               // clear once tokens arrive
        break
    case 'error':
        setError(data.content)
        setStreaming(false)
        break
    case 'done':
        setStreaming(false)
        break
}
```

---

## Debug Token Counter (Frontend)

Visible only when `NEXT_PUBLIC_DEBUG=true`. Returns null in production — no bundle impact.

```typescript
// components/chat/ContextDebug.tsx
'use client'

interface ContextDebugProps {
    messageTokens: number      // current input estimate (live as user types)
    contextTokens: number      // total sent to LLM (from context_debug event)
    historyBudget: number      // remaining budget for history
}

export function ContextDebug({ messageTokens, contextTokens, historyBudget }: ContextDebugProps) {
    if (process.env.NEXT_PUBLIC_DEBUG !== 'true') return null

    return (
        <div className="fixed bottom-4 right-4 font-mono text-[10px]
                        bg-black/80 text-green-400 rounded-sm px-3 py-2
                        border border-green-400/20 z-50">
            <div className="opacity-50 mb-1">context</div>
            <div>input:   {messageTokens} tok</div>
            <div>history: {historyBudget} budget</div>
            <div>total:   {contextTokens} / 8192</div>
            <div className="mt-1 opacity-50">
                {Math.round((contextTokens / 8192) * 100)}% used
            </div>
        </div>
    )
}
```

**Wire into chat page:**

```typescript
const [contextTokens, setContextTokens] = useState(0)
const [messageTokens, setMessageTokens] = useState(0)
const [historyBudget, setHistoryBudget]  = useState(0)

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)  // ~4 chars per token
}

// Update live as user types
onChange={(e) => {
    setMessage(e.target.value)
    setMessageTokens(estimateTokens(e.target.value))
    setHistoryBudget(8192 - 1000 - 1192 - estimateTokens(e.target.value))
}}

// Warn if getting long
const MAX_WARN_TOKENS = 3000
{messageTokens > MAX_WARN_TOKENS && (
    <span>Long message (~{messageTokens} tokens) — consider splitting</span>
)}
```

**Enable:**
```
NEXT_PUBLIC_DEBUG=true   # in .env.local
```

---

## Install Dependency

```bash
pip install tiktoken
```

Add to `requirements.txt`:
```
tiktoken==0.7.0
```

**Note on tiktoken accuracy:** tiktoken uses OpenAI's tokenizer which differs from Ollama model tokenizers by ~5-15%. Conservative budget constants account for this variance. Can be swapped for Ollama's `/api/tokenize` endpoint later if exact counts become necessary.

---

## What the LLM Receives

**Short conversation (under budget — fast path):**

```json
[
  {"role": "system", "content": "You are Athena..."},
  {"role": "user", "content": "what is gradient descent?"},
  {"role": "assistant", "content": "Gradient descent is..."},
  {"role": "user", "content": "how does learning rate affect it?"},
  {"role": "assistant", "content": "Learning rate controls..."},
  {"role": "user", "content": "can you show me an example?"}
]
```

**Long conversation, first time over budget (summary generated + cached):**

```json
[
  {"role": "system", "content": "You are Athena..."},
  {
    "role": "system",
    "content": "[Earlier in this conversation]: User asked about gradient descent, focusing on learning rate and momentum. Discussed how high learning rates cause overshooting. User understood after a code example."
  },
  {"role": "user", "content": "what about adam optimizer?"},
  {"role": "assistant", "content": "Adam combines..."},
  {"role": "user", "content": "which should I use?"}
]
```

**Subsequent requests (cached summary reused — no LLM call):**

Same shape as above. Summary comes from `conversations.summary`, only messages after `summarized_up_to_id` are loaded fresh. No second LLM call.

The UI always shows full conversation history from PostgreSQL. The LLM only ever sees the token-managed version.

---

## Behavior Reference

```
Scenario                               What happens
────────────────────────────────────   ──────────────────────────────────────────
Normal message, short history          Fast path — token_count check, return all
Normal message, long history           First time: generate + cache summary
                                       Subsequent: reuse cached summary
Long message, short history            History budget shrinks, fits anyway
Long message, long history             Budget shrinks + summary path runs
Recent messages fill up again          Regenerate summary (progressive compression)
Message > 5500 tokens                  HTTP 400, user told to split message
Only 6 messages, over budget           Return protected, accept slight overage
Summarization times out (15s)          Placeholder text used, no crash
```

---

## Next Up: Celery + Qdrant Integration (Phase 4)

The `summary` and `summary_embedded` columns are already in place. When Phase 4 arrives, this is what hooks in:

**What Celery does with the cached summary:**

```python
# tasks/embeddings.py (Phase 4)

@celery.task
def sweep_unembedded_conversations():
    """
    Runs every 6 hours.
    Finds conversations with a cached summary not yet in Qdrant.
    Embeds the existing summary — does NOT regenerate it.
    """

    # Job 1: already summarized inline, just needs embedding
    ready = db.fetch_all("""
        SELECT conversation_id, summary
        FROM conversations
        WHERE summary IS NOT NULL
        AND summary_embedded = false
        AND last_active < NOW() - INTERVAL '30 minutes'
    """)

    for conv in ready:
        embed_conversation_summary.delay(
            conversation_id=conv["conversation_id"],
            summary_text=conv["summary"]    # reuse — no LLM call needed
        )

    # Job 2: meaningful conversations that never hit inline threshold
    needs_summary = db.fetch_all("""
        SELECT conversation_id FROM conversations
        WHERE summary IS NULL
        AND message_count >= 10
        AND last_active < NOW() - INTERVAL '30 minutes'
    """)

    for conv in needs_summary:
        embed_conversation_summary.delay(
            conversation_id=conv["conversation_id"]
        )


@celery.task
def embed_conversation_summary(
    conversation_id: str,
    summary_text: str = None
):
    if not summary_text:
        # Sweep found a conversation with no inline summary
        # Generate one now
        messages = load_messages(conversation_id)
        summary_text = summarize_messages_sync(messages)

    embedding = ollama.embed(model="nomic-embed-text", prompt=summary_text)

    qdrant.upsert(
        collection_name="athena_knowledge",
        points=[{
            "id": str(uuid4()),
            "vector": embedding.embedding,
            "payload": {
                "type": "conversation_summary",
                "conversation_id": conversation_id,
                "text": summary_text,
                "date": datetime.now().isoformat()
            }
        }]
    )

    db.execute("""
        UPDATE conversations SET
            summary_embedded = true,
            last_embedded_at = NOW()
        WHERE conversation_id = :id
    """, {"id": conversation_id})
```

**The key principle — one summary, two consumers:**

```
context.py generates summary → saves to conversations.summary
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
        Used by build_messages()                  Celery reads it later
        for token budget management               embeds it into Qdrant
        (synchronous, this request)               (async, background job)
                    │                                         │
        Serves: current conversation             Serves: cross-session RAG
```

One LLM call generates the summary. PostgreSQL caches it. Context management uses it immediately. Celery picks it up later and pushes it to Qdrant. No duplication, no wasted compute.

Do not implement the Celery/Qdrant side yet. The `summary_embedded` column sits as `false` until Phase 4.

---

## Testing It Works

```python
# Temporary debug logging in get_managed_history()
print(f"[context] message tokens:  {current_tokens}")
print(f"[context] history budget:  {history_budget}")
print(f"[context] cached count:    {conv['token_count']}")
print(f"[context] has summary:     {bool(conv['summary'])}")
```

Confirm these scenarios:

```
Short conversation    → fast path, no summarization log
Long conversation     → summary generated, cached, status SSE fires
Second message after  → cached summary reused, no LLM summarization call
Long user message     → history budget shrinks in log
Message > 5500 tokens → HTTP 400 with token count in response
Ollama slow           → 15s timeout, placeholder used, response still works
```

---

*Athena Basic Context Management · Phase 1 · Cached summary + dynamic token budget + Celery-ready schema*
