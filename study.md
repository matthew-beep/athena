# Athena — Study Guide

This isn't a reading list of textbooks. It's a list of the specific concepts that show up
in this codebase, why they matter, and where to see them in action right here in the project.
Grouped by priority — start at the top.

---

## Priority 1 — Understand These Now

These concepts are active in every request the app makes. You'll hit them constantly.

---

### 1. Async / Await in Python

**Why it matters here:**
Almost every backend function is `async def`. If you call a blocking function (like `pypdf`)
inside an async function without wrapping it, you freeze the entire server.

**Where you see it:**
```
backend/app/api/documents.py   — _process_document, _embed
backend/app/core/context.py    — get_managed_history, build_messages
```

**The key concept to grasp:**
`async` functions run concurrently — while one is waiting for a network response (Ollama, Qdrant),
Python can handle another request. But synchronous/blocking code (file reading, CPU work)
breaks this. That's why you see `asyncio.to_thread()` wrapping `extract_text()` in documents.py.

**Search:** "Python asyncio explained simply" — the Real Python guide is good.

---

### 2. FastAPI Basics — Routes, Dependencies, Background Tasks

**Why it matters here:**
Every API endpoint in the backend is a FastAPI route. The `Depends(get_current_user)` pattern
on every route is how auth works.

**Where you see it:**
```
backend/app/api/documents.py   — @router.post("/upload"), Depends(get_current_user)
backend/app/api/chat.py        — @router.post(""), BackgroundTasks
```

**The key concepts:**
- `@router.post("/upload")` — registers the function as a POST handler
- `Depends(get_current_user)` — runs get_current_user first, passes result in. If it fails (bad token), the route never runs.
- `BackgroundTasks.add_task(fn, arg1, arg2)` — runs fn after the response is sent. This is why upload returns 202 immediately while processing happens behind the scenes.

**Search:** "FastAPI tutorial" — their official docs are genuinely the best resource.

---

### 3. Server-Sent Events (SSE)

**Why it matters here:**
This is how the chat response streams token by token to the browser instead of waiting
for the full response.

**Where you see it:**
```
backend/app/api/chat.py        — stream_response() generator, yield f"data: ..."
frontend/hooks/useSSEChat.ts   — ReadableStream parsing, buffer splitting
```

**The key concept:**
The backend `yield`s lines in the format `data: {json}\n\n`. The browser reads these one
at a time as they arrive. Each `yield` is one token appearing on screen.

The frontend splits the raw bytes on `\n`, looks for lines starting with `data: `,
parses the JSON, and routes it by `event.type`.

**Search:** "Server-Sent Events explained" — MDN has a clear overview.

---

### 4. JWTs (JSON Web Tokens)

**Why it matters here:**
Every API request includes `Authorization: Bearer {token}` in the header. The backend
validates this on every route via `Depends(get_current_user)`.

**Where you see it:**
```
backend/app/core/security.py   — create_token(), get_current_user()
frontend/stores/auth.store.ts  — stores the token after login
frontend/api/client.ts         — attaches token to every request
```

**The key concept:**
A JWT is a signed string with three parts: header.payload.signature. The backend signs it
with `JWT_SECRET_KEY` on login. On every subsequent request, it verifies the signature —
no database lookup needed. The payload contains `user_id` which is how the backend knows
who's asking.

**Search:** "JWT explained" — jwt.io has an interactive decoder that makes it click.

---

### 5. Vector Embeddings (Conceptual)

**Why it matters here:**
This is the core of why RAG works. Every document chunk and every user query gets turned
into a list of ~768 numbers (a vector). Similar meaning = similar numbers = close together
in vector space. Qdrant finds the closest ones.

**Where you see it:**
```
backend/app/api/documents.py   — _embed() call per chunk during ingestion
backend/app/core/rag.py        — embed_text() on user query, then qdrant.search()
```

**The key concept:**
"nomic-embed-text" is a model trained specifically to produce these vectors such that
"What is gradient descent?" and "How does the learning rate affect training?" produce
vectors that are mathematically close. The cosine similarity score (0.0–1.0) in the
search results measures this closeness.

You don't need to understand the math. You need to understand: garbage in → garbage out.
If your chunks are too large, too small, or split mid-sentence, the vectors are worse and
retrieval quality drops.

**Search:** "embeddings explained visually" — Jay Alammar's blog posts are the best visual
explanation out there.

---

### 6. React State — useState, useEffect, useCallback

**Why it matters here:**
Most of the frontend complexity is state management. The document upload flow,
progress polling, and streaming chat are all built on these three hooks.

**Where you see it:**
```
frontend/components/documents/DocumentList.tsx   — two useEffect polling loops
frontend/components/documents/UploadZone.tsx     — staged[] state, uploading state
frontend/components/chat/MessageList.tsx         — streamingContent display
```

**The key concept:**
- `useState` — a value that, when changed, causes the component to re-render
- `useEffect` — code that runs after render, optionally on a schedule (polling) or when a value changes
- `useCallback` — wraps a function so it doesn't get recreated on every render (matters when passed as a prop)

The two polling loops in DocumentList are `useEffect` with `setInterval` inside —
the cleanup return (`return () => clearInterval(t)`) is critical or the interval keeps
running after the component unmounts.

**Search:** "React hooks explained" — the official React docs beta (react.dev) rewrote
everything around hooks and are very clear.

---

### 7. Zustand (State Management)

**Why it matters here:**
This is how state is shared between components that aren't parent/child — e.g. the sidebar
(conversation list) and the chat window both read from the same store.

**Where you see it:**
```
frontend/stores/chat.store.ts    — conversations, messages, streaming state
frontend/stores/auth.store.ts    — token, user
```

**The key concept:**
Each store is a `create()` call that returns a hook. Any component that calls `useChatStore()`
gets the current state and re-renders when it changes. You mutate state by calling the
setter functions defined in the store, never by modifying state directly.

It's simpler than Redux — there's no action/reducer separation, just a state object
with setter functions on it.

**Search:** "Zustand tutorial" — their GitHub README is genuinely enough.

---

## Priority 2 — Learn These Before Phase 2

These aren't blocking you right now but you'll need them for the next set of features.

---

### 8. PostgreSQL + asyncpg

**Why it matters here:**
All conversations, messages, documents, and chunks are in Postgres. The `asyncpg` library
is how the backend queries it.

**Where you see it:**
```
backend/app/db/postgres.py          — connection pool, fetch_one, fetch_all, execute
backend/sql/schema.sql              — the actual table definitions
backend/sql/migrations/             — changes to the schema over time
```

**The key concepts:**
- Parameterized queries: `fetch_one("SELECT * FROM users WHERE id = $1", user_id)` — the `$1`
  is NOT string formatting. asyncpg substitutes it safely. Never use f-strings in SQL.
- Connection pool: instead of opening a new DB connection per request (slow), a pool keeps
  connections open and lends them out. `async with pool.acquire() as conn` borrows one.
- `fetch_one` returns one row or None. `fetch_all` returns a list. `execute` runs
  INSERT/UPDATE/DELETE and returns a status string.

**Search:** "PostgreSQL tutorial" for SQL basics, "asyncpg docs" for the Python library.

---

### 9. Docker and Docker Compose

**Why it matters here:**
Every service (postgres, ollama, qdrant, backend) runs in a container. The `docker-compose.yml`
defines how they connect, what ports are exposed, and what environment variables they get.

**Where you see it:**
```
docker-compose.yml     — the full stack definition
backend/Dockerfile     — how the backend image is built
```

**The key concepts:**
- Services communicate by service name inside Docker's network (`postgres`, `ollama`, `qdrant`)
  — that's why `OLLAMA_HOST=ollama` works but `localhost` wouldn't from the backend container
- `volumes` persist data between restarts (postgres_data, ollama_models, qdrant_data)
- `depends_on` with `condition: service_healthy` means Docker waits for the healthcheck
  to pass before starting the next service
- `docker compose up --build` rebuilds the image; `docker compose up -d` just starts with
  whatever image already exists

**Search:** "Docker Compose getting started" — official Docker docs.

---

### 10. Tokenization

**Why it matters here:**
The context budget (8,192 tokens), chunking (512 tokens), and the MAX_MESSAGE_TOKENS
limit are all in tokens — not characters or words. One token is roughly 4 characters of
English text.

**Where you see it:**
```
backend/app/core/ingestion.py   — tiktoken enc.encode(), CHUNK_SIZE = 512
backend/app/core/context.py     — count_tokens(), MAX_MESSAGE_TOKENS = 5500
```

**The key concept:**
Ollama/LLMs have a context window limit — the total tokens for system prompt + history +
current message + response can't exceed it. The context.py file manages this budget by
measuring everything in tokens and summarizing old history when the conversation gets too long.

tiktoken is OpenAI's tokenizer — it's used here even though the model is Qwen/Llama because
the token counts are close enough for budget estimation.

**Search:** "What is tokenization LLM" — Andrej Karpathy's tokenizer video is excellent
if you want depth, but the Wikipedia article is enough for working with this codebase.

---

### 11. TypeScript Basics

**Why it matters here:**
The frontend is TypeScript. The `interface` and `type` definitions in `types/index.ts`
describe the shape of data flowing between frontend and backend.

**Where you see it:**
```
frontend/types/index.ts          — all shared type definitions
frontend/stores/chat.store.ts    — typed state interfaces
frontend/components/**/*.tsx     — props interfaces on every component
```

**The key concepts:**
- `interface Foo { bar: string; baz?: number }` — `baz?` means optional
- `Record<string, Message[]>` — an object where keys are strings and values are Message arrays
- `type X = A | B` — X can be either A or B (union type)
- TypeScript errors are caught at compile time, not runtime — a red squiggle in the editor
  means it won't build, not just a warning

You don't need to be a TypeScript expert. The existing types are your documentation —
if you look at `RagSource` in types/index.ts you know exactly what fields a RAG result has.

**Search:** "TypeScript for JavaScript developers" — the official handbook has a 5-minute intro.

---

## Priority 3 — Eventually, Not Now

These will matter in Phase 3-5. Bookmark them, don't stress about them today.

---

### 12. Celery + Redis (Background Task Queue)

Currently the app uses FastAPI's `BackgroundTasks` for document processing —
this works fine for one process but doesn't survive restarts or scale beyond one worker.
Celery replaces this with a proper job queue backed by Redis.

Phase 2 work. **Search:** "Celery getting started Python".

---

### 13. Cosine Similarity (the actual math)

You know it produces a score 0.0–1.0. That's enough to work with the codebase.
When you want to understand *why* similar text produces similar vectors and what
the dot product calculation actually does — that's a linear algebra topic.

**Search:** "cosine similarity explained visually" when you're ready.

---

### 14. WebSockets

The research pipeline (Phase 5) uses WebSockets for bidirectional communication —
the server pushes progress updates and the client can send a cancel signal.
SSE is one-way (server → client). WebSocket is two-way.

**Search:** "WebSocket vs SSE" to understand the difference. FastAPI has built-in WebSocket support.

---

### 15. Spaced Repetition / SM-2 Algorithm

The quiz system (Phase 3) uses SM-2 to schedule when to re-show flashcards based on
how well you remembered them. It's a well-documented algorithm from the 1980s.

**Search:** "SM-2 algorithm explained" — the original paper is readable.

---

## The One Thing That Will Help Most

Read the actual code in this order whenever you're confused about how a feature works:

```
1. Find the API route   →  backend/app/api/
2. Find the core logic  →  backend/app/core/
3. Find the DB call     →  backend/app/db/
4. Find the frontend    →  frontend/components/ + frontend/hooks/
```

The code in this project is written to be readable — functions are short, variable names
describe what they hold, and there's a comment anywhere something non-obvious is happening.
Reading it is faster than most tutorials for understanding what's actually going on.

---
---

# What's Actually Happening Right Now — Code Walkthroughs

These are step-by-step traces through the four main things the app does today.
Read these alongside the files they reference.

---

## Walkthrough 1 — Uploading a Document

**Files involved:**
```
frontend/components/documents/UploadZone.tsx
frontend/components/documents/DocumentsPanel.tsx
backend/app/api/documents.py
backend/app/core/ingestion.py
backend/app/db/postgres.py
backend/app/db/qdrant.py
```

### Step 1: You drop a file or click browse

The file goes into a staging list — nothing is uploaded yet.

```typescript
// UploadZone.tsx
const stageFiles = (files: File[]) => {
  const next = files.map((f) => ({
    file: f,
    id: `${f.name}-${f.size}-${Date.now()}`,  // unique ID for this staged item
  }));
  setStaged((prev) => {
    const existingNames = new Set(prev.map((s) => s.file.name));
    return [...prev, ...next.filter((n) => !existingNames.has(n.file.name))];
    // ↑ deduplication — won't add the same filename twice
  });
};
```

`staged` is a `useState` array. Every time it changes, React re-renders the component
and shows the queue of files waiting to be uploaded.

---

### Step 2: You click "Upload"

```typescript
// UploadZone.tsx — handleUpload()
for (let i = 0; i < toUpload.length; i++) {
  const { file, id } = toUpload[i];
  const tempId = `upload-${id}`;

  onUploadStart?.({ file, tempId });   // ← tells DocumentsPanel to show a placeholder row

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
```

Files are uploaded one at a time (sequential, not parallel). This is intentional —
uploading them all at once would slam Ollama with multiple concurrent embedding jobs.

The `onUploadStart` callback fires *before* the fetch. This is what makes the
"uploading…" placeholder appear in the list instantly instead of after the server responds.

---

### Step 3: The backend receives the file

```python
# documents.py — upload_document()
body = await file.read()   # read all bytes into memory NOW

document_id = f"doc_{uuid.uuid4().hex[:12]}"   # e.g. "doc_a3f9b1c2d4e5"

# Insert the DB row immediately — so the frontend poll sees it right away
await postgres.execute(
    "INSERT INTO documents (document_id, filename, file_type, processing_status, word_count) "
    "VALUES ($1, $2, $3, 'processing', 0)",
    document_id, filename, file_type,
)

# Schedule background work, then return 202 immediately
background_tasks.add_task(_process_document, document_id, body, mime, filename, file_type)

return JSONResponse(status_code=202, content={
    "document_id": document_id,
    "status": "processing",
})
```

**Why read the file bytes before the background task?**
FastAPI's `UploadFile` is tied to the HTTP request. Once the handler function returns,
the request is closed and the file object is gone. The background task gets plain `bytes`
it owns independently.

**Why 202 instead of 200?**
HTTP 202 means "Accepted — we got it but haven't finished yet." 200 would imply the work
is done. This is the honest response. If we waited until processing was done, the Next.js
proxy would time out after 30 seconds on large files.

---

### Step 4: The frontend drops the placeholder

```typescript
// DocumentsPanel.tsx
const onUploadComplete = useCallback((payload) => {
  // Remove the upload placeholder from processingDocs.
  // The real DB row (status: 'processing') will appear via polling.
  setProcessingDocs((prev) => prev.filter((d) => d.document_id !== payload.tempId));
}, []);
```

When `processingDocs` shrinks, this effect fires:

```typescript
// DocumentsPanel.tsx
useEffect(() => {
  if (processingDocs.length < prevLengthRef.current) {
    setRefreshKey((k) => k + 1);  // triggers DocumentList to re-fetch immediately
  }
  prevLengthRef.current = processingDocs.length;
}, [processingDocs.length]);
```

The `refreshKey` bump is passed as a prop to `DocumentList`, which has a `useEffect`
watching it — so bumping the key triggers an immediate fetch, and the real DB row
(status: `processing`) appears in the list.

---

### Step 5: Background processing — Extract

This runs *after* the 202 response has already been sent. The user sees the document
as "Processing" while this is happening.

```python
# documents.py — _process_document()

# Stage 1: Extract text from the file
_progress[document_id] = {"stage": "extracting", "done": 0, "total": 0}

# asyncio.to_thread() runs extract_text in a thread pool.
# This is needed because pypdf is synchronous — calling it directly
# would freeze the entire server while it runs.
text, error = await asyncio.to_thread(extract_text, BytesIO(body), mime, filename)
```

`extract_text` in `ingestion.py` handles different file types:

```python
# ingestion.py — extract_text()
if mime_type == "application/pdf":
    reader = PdfReader(file_obj, strict=False)  # strict=False = don't crash on bad PDFs
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            t = page.extract_text()
            if t and t.strip():
                pages.append(t)
        except Exception as page_err:
            logger.warning("Skipping PDF page {} due to error: {}", i, page_err)
            # skip the broken page, keep going with the rest
    text = "\n\n".join(pages)

elif mime_type in _TEXT_MIME_TYPES:  # .md, .txt, .py, .csv etc.
    raw = file_obj.read()
    text = raw.decode("utf-8", errors="replace")  # errors="replace" = bad chars → ?
```

---

### Step 6: Background processing — Chunk

```python
# ingestion.py — chunk_text()
CHUNK_SIZE = 512    # tokens per chunk
CHUNK_OVERLAP = 64  # tokens shared between adjacent chunks

def chunk_text(text: str) -> list[dict]:
    tokens = enc.encode(text)   # convert text → list of token IDs

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunks.append({
            "text": enc.decode(tokens[start:end]),   # convert token IDs back → text
            "token_count": end - start,
            "chunk_index": len(chunks),
        })
        if end >= len(tokens):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP  # move forward, but keep 64 tokens of overlap
    return chunks
```

**What the overlap is for:**
Imagine a sentence that straddles chunk 3 and chunk 4. Without overlap, neither chunk
has the full sentence and the model can't answer questions about it. With 64 tokens of
overlap, the end of chunk 3 and the start of chunk 4 share the same 64 tokens, so the
sentence appears complete in at least one chunk.

A 10-page PDF is roughly 5,000 words → ~6,500 tokens → about 14 chunks.

---

### Step 7: Background processing — Embed and store

```python
# documents.py — inside _process_document()
_progress[document_id] = {"stage": "embedding", "done": 0, "total": total}

async with httpx.AsyncClient() as client:
    for chunk in chunks:
        i = chunk["chunk_index"]
        chunk_id = f"{document_id}_chunk_{i}"   # e.g. "doc_a3f9b1_chunk_0"

        # Send the chunk text to Ollama, get back 768 numbers
        embedding = await _embed(client, chunk["text"])

        # Store the text in Postgres (so we can look it up by document later)
        await postgres.execute(
            "INSERT INTO document_chunks (chunk_id, document_id, chunk_index, text, ...) "
            "VALUES ($1, $2, $3, $4, ...)",
            chunk_id, document_id, i, chunk["text"], ...
        )

        # Build the Qdrant point — vector + metadata about where it came from
        qdrant_points.append({
            "id": _chunk_id_to_qdrant_id(chunk_id),   # deterministic number from hash
            "vector": embedding,                        # the 768 numbers
            "payload": {
                "document_id": document_id,
                "text": chunk["text"],                  # stored here too for fast retrieval
                "metadata": {"filename": filename},
            },
        })

        # Update progress so the frontend poll can show "Embedding chunk 3 of 14"
        _progress[document_id] = {"stage": "embedding", "done": i + 1, "total": total}
```

**Why is the text stored in both Postgres AND Qdrant?**
Qdrant stores the text in the point's `payload` for fast retrieval during search —
when Qdrant finds a matching vector, it returns the text immediately without a second
database query. Postgres stores it too for non-search lookups (e.g. "show me all chunks
from document X").

**What `_chunk_id_to_qdrant_id` does:**
Qdrant needs integer IDs. `chunk_id` is a string like `"doc_a3f9b1_chunk_0"`.
The function hashes it to a consistent integer using SHA256, so the same chunk always
gets the same ID — safe to re-run if processing crashes halfway.

```python
def _chunk_id_to_qdrant_id(chunk_id: str) -> int:
    return int.from_bytes(hashlib.sha256(chunk_id.encode()).digest()[:8], "big")
```

---

### Step 8: All chunks are sent to Qdrant in one batch

```python
# documents.py
await qdrant.upsert_points(qdrant_points)   # one HTTP call with all 14 chunks

# Mark complete in Postgres
await postgres.execute(
    "UPDATE documents SET processing_status='complete', word_count=$1, chunk_count=$2 "
    "WHERE document_id=$3",
    word_count, total, document_id,
)

_progress.pop(document_id, None)   # remove from progress tracking — it's done
```

The 3-second poll in `DocumentList` will pick up `processing_status='complete'` and
the UI updates to show "Ready" with the chunk count.

---

## Walkthrough 2 — Progress Tracking

**Files involved:**
```
backend/app/api/documents.py       — _progress dict, GET /{id}/progress
frontend/components/documents/DocumentList.tsx   — two polling useEffects
```

### The backend side — in-memory dict

```python
# documents.py
_progress: dict[str, dict] = {}
# This is a plain Python dictionary at module level.
# It lives in memory — it's wiped if the server restarts.
```

At each stage of processing, `_progress[document_id]` is overwritten:

```python
{"stage": "extracting", "done": 0,  "total": 0}   # Stage 1
{"stage": "chunking",   "done": 0,  "total": 0}   # Stage 2
{"stage": "embedding",  "done": 1,  "total": 14}  # Stage 3, after chunk 1
{"stage": "embedding",  "done": 2,  "total": 14}  # Stage 3, after chunk 2
# ... etc
# When done: _progress.pop(document_id) — entry is deleted
```

The progress endpoint just reads from that dict:

```python
@router.get("/{document_id}/progress")
async def get_document_progress(document_id: str, ...):
    prog = _progress.get(document_id)
    if prog is not None:
        return {**prog, "active": True}   # spreading the dict adds "active": True to it
    # If not in _progress, fall back to the DB status
    row = await postgres.fetch_one(
        "SELECT processing_status FROM documents WHERE document_id = $1", document_id
    )
    return {"stage": row["processing_status"], "done": 0, "total": 0, "active": False}
```

### The frontend side — two polling loops

```typescript
// DocumentList.tsx

// Loop 1: every 3 seconds, re-fetch the whole document list
// This catches when status changes from 'processing' → 'complete'
useEffect(() => {
  const hasPending = documents.some(
    (d) => d.processing_status === 'processing' || d.processing_status === 'pending'
  );
  if (!hasPending) return;           // stop polling if nothing is processing
  const t = setInterval(fetchDocuments, 3000);
  return () => clearInterval(t);     // cleanup when component unmounts
}, [documents]);

// Loop 2: every 800ms, fetch /progress for each processing document
// This shows the "Embedding chunk X of Y" detail
useEffect(() => {
  const processingDocs = documents.filter((d) => d.processing_status === 'processing');
  if (processingDocs.length === 0) {
    setProgressMap({});    // clear progress when nothing is processing
    return;
  }
  const poll = () => {
    processingDocs.forEach((doc) => {
      fetch(`/api/documents/${doc.document_id}/progress`, { headers })
        .then((r) => r.json())
        .then((data) => {
          setProgressMap((prev) => ({ ...prev, [doc.document_id]: data }));
          // ↑ merge into the map, don't replace the whole thing
        });
    });
  };
  poll();                            // run immediately, don't wait 800ms for first update
  const t = setInterval(poll, 800);
  return () => clearInterval(t);
}, [documents]);
```

`progressMap` is a `Record<string, Progress>` — an object keyed by document_id.
When the component renders the list, it reads `progressMap[doc.document_id]` to decide
what to show in the progress bar.

---

## Walkthrough 3 — RAG (Retrieval-Augmented Generation)

**Files involved:**
```
backend/app/core/rag.py
backend/app/db/qdrant.py
backend/app/core/context.py
backend/app/api/chat.py
```

RAG is the reason the model can answer questions about your documents instead of just
making things up. Here's the full flow every time you send a message.

### Step 1: Embed the user's question

```python
# rag.py — retrieve()
async def retrieve(query: str, top_k: int = 6) -> list[dict]:
    vector = await embed_text(query)
    # ↑ sends "what is gradient descent?" to nomic-embed-text
    # gets back 768 numbers that mathematically represent the meaning
```

```python
# rag.py — embed_text()
async def embed_text(text: str) -> list[float]:
    resp = await client.post(
        f"{settings.ollama_base_url}/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text},
    )
    return resp.json()["embedding"]   # list of 768 floats
```

This is the same model and same process used when ingesting documents.
The whole point is that the query vector and the chunk vectors were made
by the same model, so "similar meaning" = "similar numbers."

---

### Step 2: Search Qdrant for nearby vectors

```python
# qdrant.py — search()
body = {
    "vector": vector,        # the 768 numbers from the query
    "limit": top_k,          # return top 6 matches
    "with_payload": True,    # include the text and metadata, not just the ID
}
resp = await client.post(
    f"{base}/collections/athena_knowledge/points/search",
    json=body,
)
return resp.json().get("result", [])
```

Qdrant compares the query vector against every stored chunk vector and returns the
6 closest ones. "Closest" means highest cosine similarity score (0.0–1.0).
A score of 0.9 means very similar meaning. A score of 0.3 means barely related.

---

### Step 3: Format the results into readable text

```python
# rag.py — back in retrieve()
sources = []
for r in results:
    payload = r.get("payload", {})
    sources.append({
        "text": payload.get("text", ""),               # the actual chunk text
        "filename": payload.get("metadata", {}).get("filename", "unknown"),
        "score": round(r.get("score", 0.0), 3),        # e.g. 0.847
        "chunk_index": payload.get("chunk_index", 0),
        "document_id": payload.get("document_id", ""),
    })
return sources
```

Then `format_rag_context` turns the list into a string:

```python
# rag.py — format_rag_context()
header = "Relevant information from the user's documents:\n"
# Then for each source:
snippet = f'\n[Source: {src["filename"]}]\n{src["text"]}\n'
```

Final result looks like:
```
Relevant information from the user's documents:

[Source: machine-learning-notes.pdf]
Gradient descent is an optimization algorithm that minimizes a loss function
by iteratively moving in the direction of steepest descent...

[Source: lecture-slides.pdf]
The learning rate controls how large each step is during gradient descent.
Too large and the model overshoots...
```

---

### Step 4: Inject context into the system prompt

```python
# context.py — build_system_prompt()
def build_system_prompt(rag_context: str | None = None) -> str:
    base = (
        "You are Athena, a personal AI assistant. "
        "You help the user learn, research, and build. "
        "Be concise, precise, and adapt your explanation depth to the conversation."
    )
    if rag_context:
        return f"{base}\n\n{rag_context}"   # append the document excerpts
    return base
```

The assembled messages array that gets sent to Ollama looks like:

```python
[
    {
        "role": "system",
        "content": "You are Athena...\n\nRelevant information...\n[Source: notes.pdf]\n..."
    },
    {
        "role": "user",
        "content": "what is gradient descent?"
    }
]
# (plus any previous messages from the conversation history)
```

The model reads the system prompt first, sees the document excerpts, and uses them to
answer your question. It's not magic — it's just text passed in at the top.

---

### Step 5: Token budget accounting

The context window is 8,192 tokens total. RAG context takes up space.

```python
# context.py — build_messages()
rag_tokens = count_tokens_text(rag_context) if rag_context else 0

history_budget = (
    TOTAL_BUDGET        # 8192
    - SYSTEM_BUDGET     # 1000  (base system prompt)
    - GENERATION_BUDGET # 1192  (reserved for the model's response)
    - current_tokens    # however long your message is
    - rag_tokens        # however long the retrieved chunks are
)
# Whatever's left goes to conversation history
```

If your retrieved chunks are 1,500 tokens, there's 1,500 fewer tokens available for
conversation history. The context manager automatically summarizes old messages to make room.

---

### Step 6: Sources are sent to the frontend

```python
# chat.py — done_event
done_event = {
    "type": "done",
    "model": model,
    "latency_ms": latency_ms,
    "rag_sources": [
        {
            "filename": s["filename"],
            "score": s["score"],
            "chunk_index": s["chunk_index"],
            "document_id": s["document_id"],
            "text": s["text"],         # the actual chunk text
        }
        for s in rag_sources
    ],
}
```

The frontend stores these on the assistant message object, and `Message.tsx` shows
them in the collapsible "N sources ▾" panel below the response.

---

## Walkthrough 4 — Chat Streaming

**Files involved:**
```
backend/app/api/chat.py
frontend/hooks/useSSEChat.ts
frontend/stores/chat.store.ts
frontend/components/chat/MessageList.tsx
```

### Step 1: Frontend sends the request

```typescript
// useSSEChat.ts
const response = await apiClient.postStream('/chat', {
  message: content,
  conversation_id: convId ?? null,
  knowledge_tier: 'ephemeral',
});
// postStream uses fetch() with no response parsing — it returns the raw Response object
// so we can read the body as a stream
```

A temp conversation and user message are added to the store immediately (optimistic UI)
so the message appears on screen before the server responds.

---

### Step 2: Backend streams tokens

```python
# chat.py — inside stream_response() generator
async with client.stream("POST", f"{ollama_url}/api/chat",
    json={"model": model, "messages": chat_messages, "stream": True}
) as resp:
    async for line in resp.aiter_lines():
        chunk = json.loads(line)
        token = chunk.get("message", {}).get("content", "")
        if token:
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        if chunk.get("done"):
            break
```

Ollama sends one JSON line per token. The backend immediately `yield`s it to the
browser as an SSE event. There's no buffering — each token hits the browser within
milliseconds of Ollama generating it.

---

### Step 3: Frontend reads the stream

```typescript
// useSSEChat.ts
const reader = response.body?.getReader();  // raw byte stream from fetch()
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();   // read a chunk of bytes
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';   // keep the last incomplete line in the buffer

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));   // strip "data: " prefix

    if (event.type === 'token') {
      appendStreamToken(event.content);   // adds to store.streamingContent
    }
  }
}
```

**Why the buffer?**
Network packets don't align to SSE event boundaries. One `reader.read()` call might
return half an event. The buffer accumulates bytes, splits on newlines, processes
complete lines, and holds the incomplete last line for the next read.

---

### Step 4: Streaming content appears on screen

```typescript
// MessageList.tsx
{isStreaming && streamingContent && (
  <div className="flex gap-3">
    <div>A</div>   {/* avatar */}
    <div className="glass-subtle rounded-xl px-4 py-3 text-sm">
      {streamingContent}
      <span className="animate-pulse">|</span>   {/* blinking cursor */}
    </div>
  </div>
)}
```

`streamingContent` is in the Zustand store. Every `appendStreamToken` call adds
a token to it, which triggers a re-render, which updates what's on screen.

---

### Step 5: Stream ends — message is finalized

```typescript
// useSSEChat.ts — when event.type === 'done'
const assistantMsg: Message = {
  message_id: `msg_${Date.now()}`,
  role: 'assistant',
  content: useChatStore.getState().streamingContent,  // grab the full accumulated text
  model_used: event.model,
  rag_sources: event.rag_sources,
};

// Replace temp conversation and temp messages with real IDs from the server
setConversations([newConv, ...conversationsWithoutTemp]);
setMessages(realId, [
  { ...tempUserMsg, conversation_id: realId },
  assistantMsg,
]);
setActiveConversation(realId);
```

`isStreaming` is set to `false`, the streaming bubble disappears, and the real
`assistantMsg` (with sources) appears in the message list via `messages[realId]`.

---

## Quick Reference — Where Things Live

| What you want to find | File |
|---|---|
| All API routes | `backend/app/api/` |
| Document processing pipeline | `backend/app/api/documents.py` — `_process_document()` |
| Text extraction (PDF, DOCX, etc.) | `backend/app/core/ingestion.py` — `extract_text()` |
| Chunking logic | `backend/app/core/ingestion.py` — `chunk_text()` |
| RAG retrieval | `backend/app/core/rag.py` — `retrieve()` |
| Token budget management | `backend/app/core/context.py` — `build_messages()` |
| Qdrant queries | `backend/app/db/qdrant.py` |
| Postgres queries | `backend/app/db/postgres.py` |
| Database schema | `backend/sql/schema.sql` |
| Chat streaming (frontend) | `frontend/hooks/useSSEChat.ts` |
| Global state | `frontend/stores/chat.store.ts` |
| Document list + polling | `frontend/components/documents/DocumentList.tsx` |
| Upload staging + button | `frontend/components/documents/UploadZone.tsx` |
| Chat message + sources | `frontend/components/chat/Message.tsx` |
