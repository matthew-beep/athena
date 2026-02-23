# Athena Codebase Handoff — Document Pipeline & RAG

**Phase:** 1 (Foundation complete)
**Stack:** FastAPI · asyncpg · Qdrant (REST) · Ollama · Next.js 15 App Router · Zustand

---

## 1. Service Topology

Four Docker Compose services are running. The backend depends on postgres being healthy before starting; Qdrant has no health check.

```
Browser  ──→  Next.js :3000 (dev) or Nginx :80 (prod)
                   │  next.config.mjs rewrites /api/* → localhost:8000/api/*
                   ▼
              FastAPI :8000
              ├── asyncpg pool → PostgreSQL :5432
              ├── httpx (REST) → Qdrant :6333
              └── httpx (REST) → Ollama :11434
```

The frontend never talks to Postgres, Qdrant, or Ollama directly. Everything goes through FastAPI. `next.config.mjs` is the only place the proxy is configured — if those rewrites change, the frontend breaks.

**On startup** (`main.py:lifespan`):
```python
await postgres.create_pool()      # asyncpg connection pool, min=2 max=10
await seed_admin_user()           # inserts admin user if not exists
await qdrant.ensure_collection()  # creates athena_knowledge collection if missing
```

The Qdrant call is wrapped in try/except — Qdrant being down doesn't prevent boot. The collection will be created on the first document upload instead.

---

## 2. Document Upload — Front End

The entry point is `DocumentsPanel.tsx`, which owns all upload state and coordinates between two child components.

### `UploadZone.tsx` — file staging and HTTP upload

The component has a two-step model: **stage first, upload on click**.

```typescript
// UploadZone.tsx:46 — files are added to a local staged[] array, no upload yet
const stageFiles = (files: File[]) => {
  const next = files.map((f) => ({ file: f, id: `${f.name}-${f.size}-${Date.now()}` }));
  setStaged((prev) => {
    const existingNames = new Set(prev.map((s) => s.file.name));
    return [...prev, ...next.filter((n) => !existingNames.has(n.file.name))]; // dedup by name
  });
};
```

When the user clicks "Upload N files", `handleUpload` fires. It iterates the queue **sequentially** (not parallel — intentional, avoids hammering Ollama with concurrent embedding jobs):

```typescript
// UploadZone.tsx:72
for (let i = 0; i < toUpload.length; i++) {
  const { file, id } = toUpload[i];
  const tempId = `upload-${id}`;
  onUploadStart?.({ file, tempId });      // ① notify parent to show placeholder

  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.ok) {
    const data = await res.json();        // ② 202 response with document_id
    onUploadComplete?.({ tempId, doc: data });
  } else {
    onUploadFailed?.(tempId);
  }
  setStaged((prev) => prev.filter((s) => s.id !== id)); // remove from queue
}
```

The three callbacks (`onUploadStart`, `onUploadComplete`, `onUploadFailed`) are defined in `DocumentsPanel.tsx` and control the live-tracking list.

### `DocumentsPanel.tsx` — live tracking state

```typescript
// DocumentsPanel.tsx:31
const onUploadStart = useCallback((payload: { file: File; tempId: string }) => {
  setProcessingDocs((prev) => [...prev, {
    document_id: payload.tempId,   // temp ID, replaced on complete
    filename: payload.file.name,
    status: 'uploading',
    progress: 0, chunks: 0, concepts: 0,
  }]);
}, []);

const onUploadComplete = useCallback((payload: { tempId: string; doc: UploadedDocument }) => {
  // Drop the upload placeholder entirely.
  // The real DB row (status: 'processing') will appear via the 3s poll in DocumentList.
  setProcessingDocs((prev) => prev.filter((d) => d.document_id !== payload.tempId));
}, []);
```

When `processingDocs.length` drops, this effect fires:
```typescript
// DocumentsPanel.tsx:116
useEffect(() => {
  if (processingDocs.length < prevLengthRef.current) setRefreshKey((k) => k + 1);
  prevLengthRef.current = processingDocs.length;
}, [processingDocs.length]);
```

That `refreshKey` increment triggers `DocumentList` to immediately re-fetch from the API so the real DB row appears.

---

## 3. Document Upload — Backend

### Route handler: `POST /api/documents/upload`

The critical design decision here: **respond 202 immediately and do all work in a background task**. The original implementation blocked the request handler — which hit the Next.js proxy's 30-second timeout on large PDFs.

```python
# documents.py:180
@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    filename = file.filename or ""
    mime = _resolve_mime(file.content_type or "", filename)  # fix ambiguous browser MIME types

    if mime not in ALLOWED_TYPES:
        return JSONResponse(status_code=415, content={...})

    body = await file.read()   # read the bytes NOW, in the request handler
    if not body:
        return JSONResponse(status_code=400, ...)

    document_id = f"doc_{uuid.uuid4().hex[:12]}"
    file_type = _MIME_TO_TYPE.get(mime, "unknown")

    # Insert the DB row immediately so DocumentList polling sees it right away
    await postgres.execute(
        "INSERT INTO documents (document_id, filename, file_type, processing_status, word_count) "
        "VALUES ($1, $2, $3, 'processing', 0)",
        document_id, filename, file_type,
    )

    # Schedule background work — returns immediately
    background_tasks.add_task(_process_document, document_id, body, mime, filename, file_type)

    return JSONResponse(status_code=202, content={
        "document_id": document_id,
        "filename": filename,
        "file_type": file_type,
        "status": "processing",
    })
```

**Why `body = await file.read()` before the background task?** FastAPI's `UploadFile` is tied to the request lifecycle. Once the handler returns, the file object is closed. The background task receives plain `bytes` that it owns.

**MIME type resolution** (`ingestion.py:97`): browsers often send `application/octet-stream` for files they don't recognise (.md, .py, .csv). The resolver checks the extension first:

```python
def _resolve_mime(mime_type: str, filename: str) -> str:
    ambiguous = {"application/octet-stream", "application/unknown", ""}
    if not mime_type or mime_type in ambiguous:
        ext = os.path.splitext(filename)[1].lower()
        return _EXT_MIME.get(ext, mime_type)
    return mime_type
```

---

## 4. Background Processing Pipeline

`_process_document` runs in FastAPI's background task executor. The in-memory `_progress` dict is updated at every stage so the frontend can poll for fine-grained status.

```python
_progress = {}   # module-level dict, keyed by document_id
```

### Stage 1 — Extract (`ingestion.py:extract_text`)

```python
# documents.py:75
_progress[document_id] = {"stage": "extracting", "done": 0, "total": 0}
text, error = await asyncio.to_thread(extract_text, BytesIO(body), mime, filename)
```

`asyncio.to_thread` is essential — `pypdf` and `python-docx` are synchronous and CPU-bound. Calling them directly in an async function blocks the entire event loop.

`extract_text` (`ingestion.py:127`) handles four cases:

- **PDF** (`application/pdf`): `PdfReader(strict=False)` with per-page error handling. Skips unreadable pages rather than failing the whole document. Returns an error if zero pages extracted.
- **DOCX**: `python-docx`, joins paragraphs with `\n\n`
- **Text types** (markdown, txt, csv, python, etc.): `file_obj.read().decode("utf-8", errors="replace")`
- **Video/audio**: `faster_whisper.WhisperModel("base")` — writes to a temp file (Whisper needs a path, not a stream), transcribes, deletes temp

### Stage 2 — Chunk (`ingestion.py:chunk_text`)

```python
# documents.py:87
_progress[document_id] = {"stage": "chunking", "done": 0, "total": 0}
chunks = chunk_text(text)
word_count = len(text.split())
```

```python
# ingestion.py:71
CHUNK_SIZE = 512    # tokens
CHUNK_OVERLAP = 64  # tokens

def chunk_text(text: str) -> list[dict]:
    tokens = enc.encode(text)   # tiktoken cl100k_base
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunks.append({
            "text": enc.decode(tokens[start:end]),
            "token_count": end - start,
            "chunk_index": len(chunks),
        })
        if end >= len(tokens): break
        start += CHUNK_SIZE - CHUNK_OVERLAP   # sliding window
    return chunks
```

A 10-page PDF (~5,000 words, ~6,500 tokens) produces roughly 14 chunks with 64-token overlap between adjacent chunks. The overlap prevents a sentence from being split across two chunks with zero shared context.

### Stage 3 — Embed + Store

```python
# documents.py:103
_progress[document_id] = {"stage": "embedding", "done": 0, "total": total}

async with httpx.AsyncClient() as client:
    for chunk in chunks:
        i = chunk["chunk_index"]
        chunk_id = f"{document_id}_chunk_{i}"

        # Embed via Ollama
        embedding = await _embed(client, chunk["text"])

        # Store text in Postgres (for retrieval metadata)
        await postgres.execute(
            "INSERT INTO document_chunks "
            "(chunk_id, document_id, chunk_index, text, token_count, qdrant_point_id) "
            "VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (chunk_id) DO NOTHING",
            chunk_id, document_id, i,
            chunk["text"], chunk["token_count"],
            str(_chunk_id_to_qdrant_id(chunk_id)),
        )

        qdrant_points.append({
            "id": _chunk_id_to_qdrant_id(chunk_id),    # deterministic uint64
            "vector": embedding,
            "payload": {
                "document_id": document_id,
                "chunk_id": chunk_id,
                "chunk_index": i,
                "text": chunk["text"],
                "source_type": file_type,
                "knowledge_tier": "persistent",
                "metadata": {"filename": filename},
            },
        })

        _progress[document_id] = {"stage": "embedding", "done": i + 1, "total": total}
```

**Embedding call** (`documents.py:58`):

```python
async def _embed(client: httpx.AsyncClient, text: str) -> list[float]:
    settings = get_settings()
    resp = await client.post(
        f"{settings.ollama_base_url}/api/embeddings",
        json={"model": settings.ollama_embed_model, "prompt": text},
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]
```

Model is `nomic-embed-text`, pulled by `init-ollama.sh`. It outputs **768-dimensional** vectors (the CLAUDE.md spec says 384 — incorrect; nomic-embed-text v1 is 768-dim).

**Deterministic Qdrant IDs** (`documents.py:53`):

```python
def _chunk_id_to_qdrant_id(chunk_id: str) -> int:
    return int.from_bytes(hashlib.sha256(chunk_id.encode()).digest()[:8], "big")
```

`chunk_id` is `{document_id}_chunk_{index}`. Because the ID is deterministic, re-processing a document (or retrying after a crash) will `ON CONFLICT DO NOTHING` in Postgres and upsert in Qdrant — safe to re-run.

### Stage 4 — Qdrant Upsert + Mark Complete

```python
# documents.py:144
await qdrant.ensure_collection()
await qdrant.upsert_points(qdrant_points)   # single batch PUT

_progress.pop(document_id, None)  # remove from progress tracking
await postgres.execute(
    "UPDATE documents SET processing_status='complete', word_count=$1, chunk_count=$2 "
    "WHERE document_id=$3",
    word_count, total, document_id,
)
```

`qdrant.upsert_points` (`db/qdrant.py:38`) does a single `PUT /collections/athena_knowledge/points` with all chunks in one payload. For a 14-chunk document, that's one HTTP call.

---

## 5. Progress Tracking & the Document List

### Backend: in-memory `_progress` dict

```python
# documents.py:22
_progress: dict[str, dict] = {}
# Shape at each stage:
# {"stage": "extracting", "done": 0, "total": 0}
# {"stage": "chunking",   "done": 0, "total": 0}
# {"stage": "embedding",  "done": 3, "total": 14}   ← updates after each chunk
```

```python
# documents.py:232
@router.get("/{document_id}/progress")
async def get_document_progress(document_id: str, ...):
    prog = _progress.get(document_id)
    if prog is not None:
        return {**prog, "active": True}
    # Fallback for completed/errored docs
    row = await postgres.fetch_one(
        "SELECT processing_status FROM documents WHERE document_id = $1", document_id
    )
    return {"stage": row["processing_status"], "done": 0, "total": 0, "active": False}
```

> **Limitation:** `_progress` is process-local. If you scale to multiple backend workers or restart the process mid-embedding, progress is lost. The document will still show `processing_status='processing'` in Postgres but the progress endpoint will return `active: False`. The document list falls back gracefully to showing "Processing…" from the DB status.

### Frontend: two polling loops in `DocumentList.tsx`

```typescript
// DocumentList.tsx:96 — 3s poll for document list (catches status: complete)
useEffect(() => {
  const hasPending = documents.some(
    (d) => d.processing_status === 'processing' || d.processing_status === 'pending'
  );
  if (!hasPending) return;
  const t = setInterval(fetchDocuments, 3000);
  return () => clearInterval(t);
}, [documents]);

// DocumentList.tsx:106 — 800ms poll per-document for embedding progress
useEffect(() => {
  const processingDocs = documents.filter((d) => d.processing_status === 'processing');
  if (processingDocs.length === 0) { setProgressMap({}); return; }

  const poll = () => {
    processingDocs.forEach((doc) => {
      fetch(`/api/documents/${doc.document_id}/progress`, { headers })
        .then((r) => r.json())
        .then((data: Progress) => {
          setProgressMap((prev) => ({ ...prev, [doc.document_id]: data }));
        });
    });
  };
  poll();
  const t = setInterval(poll, 800);
  return () => clearInterval(t);
}, [documents]);
```

The `allItems` array merges upload placeholders (from the `processingDocs` prop) with real DB docs, deduplicating by ID:

```typescript
// DocumentList.tsx:148
const processingIds = new Set(processingDocs.map((d) => d.document_id));

const allItems = [
  ...processingDocs.map(...),                                              // upload animation
  ...documents.filter((d) => !processingIds.has(d.document_id)).map(...), // real DB rows
];
```

---

## 6. Chat + RAG Pipeline

Every chat message goes through this sequence:

```
User message
    │
    ▼
POST /api/chat  (chat.py:56)
    │
    ├── 1. Token pre-flight check (rejects messages > 5500 tokens before streaming starts)
    ├── 2. Get or create conversation in Postgres
    ├── 3. Update conversation title (first message only)
    │
    └── StreamingResponse (generator runs async)
            │
            ├── A. RAG retrieval  ──→  rag.py:retrieve()
            │       embed query via Ollama nomic-embed-text
            │       search Qdrant top-6
            │       format into context string (≤2000 tokens)
            │
            ├── B. Build messages  ──→  context.py:build_messages()
            │       load conversation history from Postgres
            │       fit history into token budget (subtracts RAG tokens)
            │       assemble: [system + RAG] + [history] + [current message]
            │
            ├── C. Stream from Ollama  (httpx streaming, llama3.2:3b)
            │       yield SSE token events → browser
            │
            ├── D. Save messages to Postgres (after stream complete)
            │
            └── E. yield done event with rag_sources[]
```

### A. RAG Retrieval (`core/rag.py`)

```python
# rag.py:31
async def retrieve(query: str, top_k: int = 6) -> list[dict]:
    try:
        vector = await embed_text(query)        # Ollama nomic-embed-text
        results = await qdrant.search(vector, top_k=top_k)
        return [{
            "text": payload.get("text", ""),
            "filename": payload.get("metadata", {}).get("filename", "unknown"),
            "score": round(r.get("score", 0.0), 3),
            "chunk_index": payload.get("chunk_index", 0),
            "document_id": payload.get("document_id", ""),
        } for r in results]
    except Exception as e:
        logger.warning("[rag] retrieval failed — falling back to no context: {}", e)
        return []   # graceful degradation — chat still works without RAG
```

The Qdrant search (`db/qdrant.py:77`) posts to the REST API:

```python
body = {"vector": vector, "limit": top_k, "with_payload": True}
resp = await client.post(
    f"{base}/collections/athena_knowledge/points/search", json=body
)
return resp.json().get("result", [])
```

Results are scored by cosine similarity. No score threshold is applied — the top-K are always returned regardless of relevance. This means weak queries will still inject loosely-related chunks.

### B. Context Assembly (`core/context.py`)

**Token budget:**

```
Total: 8192
├── System prompt:    1000 (SYSTEM_BUDGET)
├── RAG context:      variable, up to ~2000 (RAG_BUDGET_TOKENS in rag.py)
├── Conversation:     remainder after RAG + current message
├── Current message:  variable (hard-capped at 5500 by MAX_MESSAGE_TOKENS)
└── Generation:       1192 (GENERATION_BUDGET)
```

```python
# context.py:263
rag_tokens = count_tokens_text(rag_context) if rag_context else 0
history, will_summarize = await get_managed_history(
    conversation_id=conversation_id,
    current_message=current_message,
    rag_tokens=rag_tokens,   # subtracted from history budget
)

assembled = [
    {"role": "system", "content": build_system_prompt(rag_context)},  # RAG injected here
    *history,
    {"role": "user", "content": current_message},
]
```

The system prompt when RAG context exists:

```
You are Athena, a personal AI assistant. You help the user learn, research, and build.
Be concise, precise, and adapt your explanation depth to the conversation.

Relevant information from the user's documents:

[Source: lecture-notes.pdf]
{chunk text...}

[Source: research-paper.pdf]
{chunk text...}
```

**History management** (`get_managed_history`): three paths:

1. History fits within budget → return all messages (fast path using cached `token_count`)
2. Over budget, cached summary exists → prepend `[Earlier in this conversation]: {summary}` + recent messages only
3. Over budget, no summary → call Ollama to summarize oldest half of messages, cache in `conversations.summary`

The `conversations.token_count` column is incremented on every `save_message` call, so the fast path is a single integer comparison, not a token re-count.

### C. Streaming

```python
# chat.py:109
async with httpx.AsyncClient(timeout=120.0) as client:
    async with client.stream(
        "POST",
        f"{settings.ollama_base_url}/api/chat",
        json={"model": model, "messages": chat_messages, "stream": True},
    ) as resp:
        async for line in resp.aiter_lines():
            chunk = json.loads(line)
            token = chunk.get("message", {}).get("content", "")
            if token:
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            if chunk.get("done"):
                break
```

### D. Done Event with Sources

```python
done_event = {
    "type": "done",
    "conversation_id": conversation_id,
    "model_tier": 1,
    "model": model,
    "latency_ms": latency_ms,
    "rag_sources": [
        {
            "filename": s["filename"],
            "score": s["score"],
            "chunk_index": s["chunk_index"],
            "document_id": s["document_id"],
        }
        for s in rag_sources
    ],
}
```

---

## 7. Front End — Chat & SSE

### `useSSEChat.ts` — SSE consumer

```typescript
// The SSE event stream is parsed line-by-line
if (event.type === 'token') {
  appendStreamToken(event.content);   // → Zustand store.streamingContent

} else if (event.type === 'done') {
  // finalize: move streamingContent into a real Message object
  const assistantMsg: Message = {
    message_id: `msg_${Date.now()}`,
    role: 'assistant',
    content: useChatStore.getState().streamingContent,
    model_used: event.model,
    rag_sources: event.rag_sources,   // ← sources attached here
    ...
  };
  addMessage(event.conversation_id, assistantMsg);
}
```

### `Message.tsx` — sources UI

The `SourcesPanel` component deduplicates chunks from the same file (keeps highest score) and renders a collapsible list:

```typescript
// Message.tsx — only shown on assistant messages with sources
const hasSources = !isUser && (message.rag_sources?.length ?? 0) > 0;

// Deduplicate by filename, sort by score descending
const deduped = useMemo(() => {
  const map = new Map<string, RagSource>();
  for (const s of sources) {
    const existing = map.get(s.filename);
    if (!existing || s.score > existing.score) map.set(s.filename, s);
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}, [sources]);
```

Clicking "N sources ▾" expands a list showing `filename · score%`.

---

## 8. Data Model Summary

### PostgreSQL (tables currently active)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Auth | `id`, `username`, `hashed_password` |
| `conversations` | Chat sessions | `conversation_id`, `user_id`, `token_count`, `summary`, `summarized_up_to_id` |
| `messages` | All chat turns | `message_id`, `conversation_id`, `role`, `content`, `model_used` |
| `documents` | Uploaded files | `document_id`, `filename`, `processing_status`, `chunk_count`, `word_count`, `error_message` |
| `document_chunks` | Chunk text + metadata | `chunk_id`, `document_id`, `chunk_index`, `text`, `qdrant_point_id` |

`document_chunks.document_id` has `ON DELETE CASCADE` — deleting a document removes all its chunks from Postgres automatically. Qdrant cleanup is done explicitly in the delete endpoint.

### Qdrant (one collection)

Collection: `athena_knowledge`, 768-dimensional, Cosine similarity.

Each point:

```json
{
  "id": 14532901234567,
  "vector": ["...768 floats..."],
  "payload": {
    "document_id": "doc_abc123",
    "chunk_id": "doc_abc123_chunk_0",
    "chunk_index": 0,
    "text": "the raw chunk text...",
    "source_type": "pdf",
    "knowledge_tier": "persistent",
    "metadata": { "filename": "lecture-notes.pdf" }
  }
}
```

Point IDs are `uint64` derived from `SHA256(chunk_id)[:8]` — deterministic and safe to re-run.

---

## 9. Delete Flow

```
DELETE /api/documents/{id}
    ├── postgres: DELETE FROM documents WHERE document_id = $1
    │       └── CASCADE → deletes all document_chunks rows
    ├── qdrant: POST /collections/athena_knowledge/points/delete
    │       filter: { must: [{ key: "document_id", match: { value: id } }] }
    └── _progress.pop(document_id, None)
```

The frontend sends the request optimistically — removes the document from local state immediately on success, silently ignores failure (the next poll will re-sync).

---

## 10. Current State

Phase 1 is functionally complete. The full loop works:

> Upload PDF → extract text → chunk (512 tok, 64 overlap) → embed (nomic-embed-text 768-dim) → Qdrant → ask question → embed query → Qdrant search → inject top-6 chunks into system prompt → stream answer → show sources.

### Known Gaps & Rough Edges

| Issue | Location | Impact |
|---|---|---|
| No score threshold on RAG retrieval | `rag.py:retrieve` | Weakly-relevant chunks are always injected even if the question has nothing to do with stored documents |
| `_progress` is process-local | `documents.py:_progress` | Progress lost on restart; doesn't scale past one process |
| No deduplication on upload | `upload_document` route | Uploading the same file twice creates two DB rows and doubles the Qdrant vectors |
| `accept=".pdf,.txt,.md"` in UploadZone | `UploadZone.tsx:129` | File picker shows only 3 types; backend accepts more (.docx, .csv, .py, video) |
| Video transcription untested end-to-end | `ingestion.py:_transcribe_audio_or_video` | `faster-whisper` is in requirements but no test coverage; loading Whisper blocks the event loop |
| All documents share one Qdrant collection | `qdrant.py:COLLECTION` | No per-user isolation — fine for single-user but a hard constraint if multi-user is ever added |
| Conversation `knowledge_tier` is stored but unused | `schema.sql`, `chat.py` | All conversations are `'ephemeral'` but none are treated differently yet |

---

## 11. Next Steps

Listed in priority order for Phase 1 exit criterion ("Upload PDF → ask questions → get accurate answers"):

### Immediate (quality of life)

1. **Add a score threshold to RAG retrieval** — if all returned chunks score below ~0.45, return `[]` rather than injecting irrelevant context. One-line change in `rag.py:retrieve`.

2. **Fix UploadZone `accept` attribute** — change `.pdf,.txt,.md` to include `.docx` and video extensions to match the backend's `ALLOWED_TYPES`.

3. **Upload deduplication** — hash the file body (`sha256`), store in `documents.content_hash`, reject uploads where the hash already exists.

### Phase 2 — Document Processing Improvements

4. **Sentence-aware chunking** — current chunker splits on raw token boundaries, which can cut mid-sentence. Use `spaCy` or `nltk.sent_tokenize` to split on sentence boundaries before token-windowing.

5. **Celery for background processing** — replace FastAPI `BackgroundTasks` with Celery + Redis so processing survives server restarts, can be monitored externally, and supports retries.

6. **Web URL ingestion** (`POST /api/documents/url`) — currently returns 501. Implement with `crawl4ai` or `httpx` + `BeautifulSoup`.

7. **Processing status WebSocket** — replace the 3s + 800ms polling with a server-sent event stream per document so the UI updates instantly without N polling requests.

### Phase 3 — Learning Features

8. **Quiz generation** — the `/api/quizzes` router exists but returns stub responses. Wire it to Tier 2 model (qwen2.5:30b once added to Ollama) with a structured extraction prompt.

9. **Ephemeral vs persistent conversation tiers** — `knowledge_tier` is stored but the chat pipeline doesn't differentiate. Implement the promotion flow per the CLAUDE.md spec.

10. **Knowledge graph** — `graph_nodes` / `graph_edges` tables don't exist in the schema yet. Add them and wire concept extraction into the research pipeline.
