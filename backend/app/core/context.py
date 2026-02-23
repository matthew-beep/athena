import uuid
import httpx
import tiktoken
from fastapi import HTTPException
from loguru import logger
from app.db import postgres
from app.config import get_settings

enc = tiktoken.get_encoding("cl100k_base")

TOTAL_BUDGET = 8192
SYSTEM_BUDGET = 1000
GENERATION_BUDGET = 1192
PROTECT_LAST_N = 6

# Hard limit for a single user message.
# 500 token floor ensures at least minimal history can always fit.
MAX_MESSAGE_TOKENS = TOTAL_BUDGET - SYSTEM_BUDGET - GENERATION_BUDGET - 500  # = 5500


def count_tokens(messages: list[dict]) -> int:
    """Count tokens across a list of message dicts. Includes ~4 tokens per-message overhead."""
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
    Summarize a list of messages into a concise paragraph using the configured Tier 1 model.
    Falls back to a placeholder on timeout or error — never crashes the caller.
    """
    settings = get_settings()
    formatted = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )
    prompt = (
        "Summarize this conversation segment concisely.\n"
        "Preserve:\n"
        "- Topics discussed\n"
        "- Decisions or conclusions reached\n"
        "- User's apparent knowledge level\n"
        "- Any follow-up questions or confusion points\n\n"
        "Keep under 200 words. Write in third person past tense.\n"
        "Example: \"User asked about gradient descent, focusing on learning rate...\"\n\n"
        f"Conversation:\n{formatted}"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]
    except httpx.TimeoutException:
        logger.warning("[context] summarization timed out — using placeholder")
        return "Earlier conversation content unavailable (summarization timed out)."
    except Exception as e:
        logger.error(f"[context] summarization failed: {e}")
        return "Earlier conversation content unavailable."


async def get_managed_history(
    conversation_id: str,
    current_message: str,
    rag_tokens: int = 0,
) -> tuple[list[dict], bool]:
    """
    Load conversation history from PostgreSQL and fit it into the remaining
    token budget after accounting for the current message and RAG context.

    Returns: (history_messages, will_summarize)
    - history_messages: assembled history ready to prepend before current message
    - will_summarize: True if a summarization LLM call was made this request

    Three paths:
    1. Under budget  → return all messages as-is (fast path, uses cached token_count)
    2. Over budget, cached summary exists → prepend summary + load recent messages only
    3. Over budget, no summary → generate summary, cache it, use it
    """
    current_tokens = count_tokens_text(current_message)
    history_budget = TOTAL_BUDGET - SYSTEM_BUDGET - GENERATION_BUDGET - current_tokens - rag_tokens

    logger.debug(
        f"[context] message_tokens={current_tokens} history_budget={history_budget}"
    )

    if history_budget <= 0:
        return [], False

    conv = await postgres.fetch_one(
        """
        SELECT token_count, summary, summarized_up_to_id
        FROM conversations
        WHERE conversation_id = $1
        """,
        conversation_id,
    )

    if not conv:
        return [], False

    # Fast path — cached token_count fits, return all messages
    if (conv["token_count"] or 0) <= history_budget:
        rows = await postgres.fetch_all(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = $1
            ORDER BY timestamp ASC
            """,
            conversation_id,
        )
        logger.debug(f"[context] fast path — {len(rows)} messages")
        return [{"role": r["role"], "content": r["content"]} for r in rows], False

    # Over budget — use cached summary if available
    if conv["summary"]:
        rows = await postgres.fetch_all(
            """
            SELECT role, content FROM messages
            WHERE conversation_id = $1
              AND id > $2
            ORDER BY timestamp ASC
            """,
            conversation_id,
            conv["summarized_up_to_id"],
        )
        recent = [{"role": r["role"], "content": r["content"]} for r in rows]

        # If recent messages are filling up again, regenerate the summary
        if count_tokens(recent) > history_budget * 0.8:
            logger.debug("[context] recent messages filling up — regenerating summary")
            return await _generate_and_cache_summary(conversation_id, history_budget)

        logger.debug(f"[context] cached summary + {len(recent)} recent messages")
        return [
            {
                "role": "system",
                "content": f"[Earlier in this conversation]: {conv['summary']}",
            },
            *recent,
        ], False

    # No summary yet — generate one for the first time
    logger.debug("[context] no cached summary — generating")
    return await _generate_and_cache_summary(conversation_id, history_budget)


async def _generate_and_cache_summary(
    conversation_id: str,
    history_budget: int,
) -> tuple[list[dict], bool]:
    """
    Generate a summary, cache it in PostgreSQL, return assembled history.
    Used both for first-time summarization and progressive re-compression.
    """
    rows = await postgres.fetch_all(
        """
        SELECT id, role, content FROM messages
        WHERE conversation_id = $1
        ORDER BY timestamp ASC
        """,
        conversation_id,
    )
    all_messages = [
        {"id": r["id"], "role": r["role"], "content": r["content"]} for r in rows
    ]

    protected = all_messages[-PROTECT_LAST_N:]
    trimmable = all_messages[:-PROTECT_LAST_N]

    if not trimmable:
        # Nothing to summarize — return protected messages and accept slight overage
        return [{"role": m["role"], "content": m["content"]} for m in protected], False

    midpoint = max(1, len(trimmable) // 2)
    to_summarize = trimmable[:midpoint]
    remaining = trimmable[midpoint:]

    summary_text = await summarize_messages(
        [{"role": m["role"], "content": m["content"]} for m in to_summarize]
    )
    last_summarized_id = to_summarize[-1]["id"]

    # Cache summary — summary_embedded stays false until Phase 4 (Celery + Qdrant)
    await postgres.execute(
        """
        UPDATE conversations SET
            summary              = $1,
            summarized_up_to_id  = $2,
            last_summarized_at   = NOW(),
            summary_embedded     = false
        WHERE conversation_id = $3
        """,
        summary_text,
        last_summarized_id,
        conversation_id,
    )

    logger.debug(f"[context] summary cached, up_to_id={last_summarized_id}")
    return [
        {
            "role": "system",
            "content": f"[Earlier in this conversation]: {summary_text}",
        },
        *[{"role": m["role"], "content": m["content"]} for m in remaining],
        *[{"role": m["role"], "content": m["content"]} for m in protected],
    ], True  # True = summarization LLM call was made this request


def build_system_prompt(rag_context: str | None = None) -> str:
    base = (
        "You are Athena, a personal AI assistant. "
        "You help the user learn, research, and build. "
        "Be concise, precise, and adapt your explanation depth to the conversation."
    )
    if rag_context:
        return f"{base}\n\n{rag_context}"
    return base


async def build_messages(
    conversation_id: str,
    current_message: str,
    rag_context: str | None = None,
) -> tuple[list[dict], bool, int]:
    """
    Assemble the complete messages array for an Ollama call.

    Returns: (messages, will_summarize, total_tokens)
    - messages:       ready to pass to Ollama
    - will_summarize: True if a summarization LLM call was made
    - total_tokens:   estimated token count of the assembled messages array

    Raises HTTP 400 if current_message exceeds MAX_MESSAGE_TOKENS.
    """
    current_tokens = count_tokens_text(current_message)
    if current_tokens > MAX_MESSAGE_TOKENS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "message_too_long",
                "tokens": current_tokens,
                "max": MAX_MESSAGE_TOKENS,
                "message": "Message too long — try splitting code and question into separate messages",
            },
        )

    rag_tokens = count_tokens_text(rag_context) if rag_context else 0
    history, will_summarize = await get_managed_history(
        conversation_id=conversation_id,
        current_message=current_message,
        rag_tokens=rag_tokens,
    )

    assembled = [
        {"role": "system", "content": build_system_prompt(rag_context)},
        *history,
        {"role": "user", "content": current_message},
    ]
    total_tokens = count_tokens(assembled)
    return assembled, will_summarize, total_tokens


async def save_message(
    conversation_id: str,
    role: str,
    content: str,
    model: str | None = None,
) -> str:
    """
    Save a message and keep token_count + message_count accurate on the conversation.
    Always use this instead of inserting directly — token_count must stay current
    or the fast path in get_managed_history() will be wrong.
    """
    new_tokens = count_tokens_text(content)
    msg_id = f"msg_{uuid.uuid4().hex[:16]}"

    await postgres.execute(
        """
        INSERT INTO messages (message_id, conversation_id, role, content, model_used)
        VALUES ($1, $2, $3, $4, $5)
        """,
        msg_id,
        conversation_id,
        role,
        content,
        model,
    )

    await postgres.execute(
        """
        UPDATE conversations SET
            token_count   = COALESCE(token_count, 0) + $1,
            message_count = COALESCE(message_count, 0) + 1,
            last_active   = NOW()
        WHERE conversation_id = $2
        """,
        new_tokens,
        conversation_id,
    )

    return msg_id
