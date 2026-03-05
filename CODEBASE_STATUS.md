# Athena — Codebase Status
## 2026-03-04

---

## Codebase Metrics

| Metric | Value |
|---|---|
| Backend Python LOC | ~2,250 |
| Frontend TypeScript/TSX LOC | ~3,400 |
| Total Code LOC | ~5,650 |
| Backend Python files | 24 |
| Frontend TS/TSX files | 50 |
| API endpoints | 27 |
| Database tables | 7 |
| SQL migrations | 4 |

### Backend File Breakdown

| File | Lines | Notes |
|---|---|---|
| `api/chat.py` | 390 | SSE streaming, conv management, doc attach/detach/batch |
| `api/documents.py` | 296 | Upload, ingestion, progress, delete |
| `api/system.py` | 85 | Health, resources, models |
| `api/auth.py` | 29 | Login, /me |
| `api/research.py` | 20 | Stub |
| `api/quizzes.py` | 20 | Stub |
| `api/graph.py` | 20 | Stub |
| `core/context.py` | 336 | Token budget, summarization, history |
| `core/rag.py` | 272 | BM25 + vector hybrid search, RRF |
| `core/ingestion.py` | 209 | Chunking, embedding, Qdrant upsert |
| `core/security.py` | 65 | JWT auth |
| `core/bm25.py` | 55 | Per-document BM25 index cache |
| `db/qdrant.py` | 95 | httpx Qdrant REST client |
| `db/postgres.py` | 60 | asyncpg pool + query helpers |
| `main.py` | 94 | FastAPI app, lifespan, admin seed |
| `config.py` | 58 | Pydantic settings |
| `models/chat.py` | 50 | ChatRequest (+ document_ids), BatchAttachRequest, ConversationOut, MessageOut (+ rag_sources) |
| `models/auth.py` | 18 | Token, UserOut |
| `models/system.py` | 21 | ResourceStats, HealthResponse |

---

## What Was Worked On This Session (2026-03-04)

### Sentence-Aware Chunking
- **`core/ingestion.py`** — replaced naive 512-token sliding window with sentence-boundary-aware chunker.
  Uses `nltk.sent_tokenize`, 500-token target chunks, ~50-token sentence-level overlap. PDF hyphenated
  line breaks (`word-\nword`) normalized before tokenizing. Oversized single sentences emitted as their
  own chunk (no mid-sentence splits ever). Token counts pre-computed once per sentence via `tiktoken`.
- **`requirements.txt`** — added `nltk>=3.9`.
- **Impact**: all RAG results will now be coherent, readable excerpts. Previously could split mid-word.
  Existing documents should be re-ingested to benefit.

### Search-All Globe Toggle
- **`components/chat/MessageInput.tsx`** — added `Globe` icon button left of the textarea. Reads
  `conversationSearchAll[activeConversationId]` for existing conversations, `pendingSearchAll` for
  new ones. Toggle calls `setSearchAll` or `setPendingSearchAll` accordingly.

### Scope Bar
- **`components/chat/ScopeBar.tsx`** (new file) — compact bar between `MessageList` and `MessageInput`.
  Three states: hidden (no docs, search_all off), "Searching all documents" pill with × (search_all on),
  document chips with × to detach (docs attached). Handles pending state (store) and existing
  conversation state (API) transparently.
- **`components/chat/ChatWindow.tsx`** — `refetchDocs` callback (wrapped in `useCallback`) now runs on
  every `activeConversationId` change, not just on `DocumentBar` mount. This means `ScopeBar` has data
  even when the right panel is closed. `<ScopeBar />` inserted between `<MessageList />` and
  `<MessageInput />`. `CommandPalette` receives `refetchDocs` directly instead of via a ref antipattern.

### ConversationDocuments Store
- **`stores/chat.store.ts`** — added `conversationDocuments: Record<string, ConversationDocument[]>`
  with three actions: `setConversationDocuments`, `addConversationDocument`, `removeConversationDocument`.
- **`types/index.ts`** — added `ConversationDocument` interface (`document_id`, `filename`, `file_type?`,
  `word_count?`, `added_at?`).

### Pin / Attach Button on Source Cards
- **`components/chat/Message.tsx`** — `SourcesPanel` now reads `activeConversationId`,
  `conversationDocuments`, `addConversationDocument`, `setSearchAll` from store via `useShallow`.
  Each source card has a `Pin` icon button: POSTs to batch attach endpoint, updates store,
  disables search_all. Disabled/dimmed when document already in scope.

### Clear Pending Docs on New Chat
- **`components/layout/Sidebar.tsx`** — `handleNewChat` now calls `setPendingDocuments([])` so stale
  staged documents don't carry over when starting a fresh conversation.

### Documents → Conversations Endpoint
- **`api/documents.py`** — added `GET /api/documents/{document_id}/conversations`. Returns the 3 most
  recent conversations that have this document attached (via `conversation_documents` join). Used by
  `DocumentList` chat modal to skip the "fetch all conversations" approach.

### Docker Compose Fixes
- **`docker-compose.yml`** — removed deprecated `version: "3.9"`, changed GPU `count: 1` → `count: all`,
  removed stray `qdrant: service_started` from `init-ollama` depends_on.
- **`docker-compose.mac.yml`** (new) — standalone CPU-only compose for MacBook. No `deploy` block on
  ollama. Default model `qwen2.5:7b`. Usage instructions in file header.
- Deleted `docker-compose.gpu.yml` and `docker-compose.override.yml.example` (redundant/conflicting).

---

## What Was Worked On This Session (2026-03-02)

### RAG Sources Persistence
- **`core/context.py`** — `save_message()` now accepts `rag_sources: list | None` and writes it to `messages.rag_sources` (JSONB). Import `json` added.
- **`api/chat.py`** — passes `rag_sources` list to `save_message()` for assistant messages.
- **`models/chat.py`** — `MessageOut` gains `rag_sources: list[Any] | None` with a `model_validator` that handles asyncpg returning JSONB as either a Python object or raw string.
- **`api/chat.py`** — `get_messages` SELECT now includes `rag_sources` column.
- **`sql/migrations/003_messages_rag_sources.sql`** — `ALTER TABLE messages ADD COLUMN IF NOT EXISTS rag_sources JSONB`.
- **`sql/schema.sql`** — `rag_sources JSONB` added to `messages` table definition.
- **Result**: RAG source citations now persist across page reloads and conversation switches.

### Document–Conversation Scoping — Full Rework
#### Batch attach endpoint
- **`models/chat.py`** — added `BatchAttachRequest(document_ids: list[str])`.
- **`api/chat.py`** — added `POST /{conversation_id}/documents` batch attach endpoint (defined before the single-doc route to avoid path conflicts). Replaces serial for-loop with one DB call.

#### First-message document scoping
- **`models/chat.py`** — re-added `document_ids: list[str] = []` to `ChatRequest`.
- **`api/chat.py`** — before `stream_response()` starts, calls `attach_documents(conversation_id, body.document_ids)` if any provided. This means the first message both attaches the docs AND searches them in the same request — the backend's `get_conversation_document_ids()` sees them immediately.

#### PendingDocument store state
- **`stores/chat.store.ts`** — replaced `pendingDocumentIds: string[]` with `pendingDocuments: PendingDocument[]` (full objects: `document_id`, `filename`, `file_type`). This lets the DocumentBar display them before any conversation exists.
- **`hooks/useSSEChat.ts`** — reads `pendingDocuments` from store, sends `document_ids` in the request body for new conversations, clears `pendingDocuments` on `done`.
- **`components/chat/CommandPalette.tsx`** — when no active conversation, builds full `PendingDocument` objects from `allDocs` and calls `setPendingDocuments`. Uses batch endpoint when conversation exists. Fixed `useShallow` selector and `useCallback` deps.
- **`components/documents/DocumentList.tsx`** — all three "Chat" click paths fixed:
  - No existing conversations → `setPendingDocuments([{ doc }])` then navigate
  - "Start new chat" from modal → same
  - Pick existing conversation → immediately calls batch attach API

#### DocumentBar pending state display
- **`components/chat/DocumentBar.tsx`** — reads `pendingDocuments` + `setPendingDocuments` from store. `displayDocuments` computed: when `activeConversationId` is null, uses `pendingDocuments`; otherwise uses DB-fetched `documents`. `handleRemoveDoc` removes from pending list (no API call) when no conversation exists yet.

#### Auto-open context panel
- **`components/chat/ChatWindow.tsx`** — `useEffect` watches `pendingDocuments.length`: when > 0 and no active conversation, automatically opens the context panel and collapses the sidebar so the user sees staged documents immediately.

### Model Update: qwen3.5:9b
- **`backend/app/config.py`** — default `ollama_model` → `qwen3.5:9b`
- **`init-ollama.sh`** — default `MODEL` → `qwen3.5:9b`
- **`.env.example`** — both `OLLAMA_MODEL` and `NEXT_PUBLIC_OLLAMA_MODEL` → `qwen3.5:9b`
- **`docker-compose.yml`** — `OLLAMA_MODEL` passed explicitly to `init-ollama` and `backend` services
- **`stores/chat.store.ts`** — fallback model name → `qwen3.5:9b`

---

## What Was Worked On This Session (2026-02-26)

### Backend Fixes Applied

#### `core/rag.py`
- **Removed dead branch** in `find_referenced_document` — the `if document_ids is not None and len(document_ids) == 0: return None` guard was unreachable because the outer `if document_ids:` already handled the empty case. Removed.
- **Fixed RRF attribute access bug** — `hit.payload["chunk_id"]` crashed because Qdrant returns plain JSON dicts, not objects. Fixed to `hit.get("payload", {}).get("chunk_id")` with a `None` guard.
- **Added `user_id` guard to chunk text fetch** — the Postgres query fetching chunk text from `document_chunks` had no ownership check. Added `AND d.user_id = $2` to the `JOIN documents` clause and passed `user_id` as the second bind parameter. Defense-in-depth against cross-user data leakage.
- **Removed stray comment** — cleaned up a `# Should be` comment left over from an earlier refactor.

#### `api/chat.py`
- **Removed `resolve_mode` and `_sync_conversation_mode`** — these were dead code once the DB became the source of truth for document scope. Also removed `resolve_mode` calls from `attach_document` and `detach_document` responses.
- **Simplified `_get_or_create_conversation`** — now returns `str` only (the conversation ID), not a dict. `get_conversation` is called separately after for the title check.
- **DB is source of truth for `document_ids`** — `doc_ids` is now fetched inside `stream_response()` from the `conversation_documents` join table via `get_conversation_document_ids(conversation_id)`. The frontend no longer sends `document_ids` in the chat POST body.

#### `models/chat.py`
- **Removed `document_ids` from `ChatRequest`** — frontend never sends doc IDs in chat body. Ownership and scoping is enforced entirely via the `conversation_documents` join table in Postgres.

### Documentation Updated
- **`TODO.md`** — rewrote the entire Frontend section with verified status of each item; marked already-implemented items as `[x]`; added stream abort, suggestion pills, document attachment UI, bulk progress, web scraping, SearXNG, and contextBudget bug
- **`backend.md`** — added `## Current Implementation State` section with what's working, known gaps, Docker Compose status table, phase status table
- **`frontend.md`** — added `## Current Implementation State` section with actual vs planned tech stack, Precision Glass v2.1 design notes, implemented vs not-implemented feature lists, actual file structure

---

## Architecture As-Built

### Chat + RAG Pipeline

```
POST /api/chat
    │
    ├─ token check (reject if > 5500 tokens)
    ├─ _get_or_create_conversation() → str (conversation_id)
    ├─ _update_title() if still "New Conversation"
    ├─ attach_documents(conversation_id, body.document_ids)  ← if any provided (first-message flow)
    │
    └─ stream_response() [generator]
           │
           ├─ get_conversation_document_ids(conversation_id)  ← DB source of truth
           │
           ├─ [if doc_ids] retrieve(query, user_id, document_ids=doc_ids)
           │       ├─ embed query → nomic-embed-text via Ollama
           │       ├─ find_referenced_document() → fuzzy filename match in scope
           │       ├─ asyncio.gather(
           │       │     qdrant.search(vector, filters=user+doc_ids),
           │       │     _bm25_search(query, doc_ids)
           │       │   )
           │       ├─ reciprocal_rank_fusion(vector_hits, bm25_hits)[:top_k]
           │       └─ batch fetch chunk text from document_chunks WHERE user_id = $2
           │
           ├─ build_messages(conversation_id, message, rag_context)
           │       ├─ count tokens, check budget
           │       ├─ get_managed_history() → trim/summarize if over budget
           │       └─ assemble [system, ...history, user]
           │
           ├─ POST ollama /api/chat stream=True
           │       └─ yield SSE token events
           │
           ├─ save_message(user) + save_message(assistant)
           └─ yield SSE done event {conversation_id, model, latency_ms, rag_sources}
```

### Document Ingestion Pipeline

```
POST /api/documents/upload (multipart)
    │
    ├─ save file to disk
    ├─ INSERT documents row (status=pending)
    └─ BackgroundTask: _process_document(document_id, user_id, filename, filepath)
           │
           ├─ extract text (pypdf for PDF, plain read for txt/md)
           ├─ chunk_text() — sentence-aware, 500-token chunks, ~50-token sentence-level overlap (nltk)
           ├─ build BM25 index → INSERT bm25_indexes (chunk_ids, corpus)
           ├─ embed all chunks → nomic-embed-text via Ollama
           ├─ qdrant.upsert_points() — payload: document_id, chunk_id, user_id, filename, etc.
           ├─ INSERT document_chunks rows (chunk_id, text, token_count)
           └─ UPDATE documents SET processing_status='complete', chunk_count=N
```

### Qdrant Point Payload (current)

```json
{
  "document_id": "doc_abc123",
  "chunk_id": "doc_abc123_chunk_0",
  "user_id": 1,
  "filename": "paper.pdf",
  "normalized_filename": "paper",
  "chunk_index": 0,
  "source_type": "pdf",
  "knowledge_tier": "persistent",
  "created_at": "2026-02-26T10:00:00Z"
}
```

Text is **not** stored in Qdrant. `chunk_id` bridges back to `document_chunks` in Postgres for the actual text fetch.

### Database Tables

| Table | Purpose |
|---|---|
| `users` | Auth — username, hashed_password |
| `conversations` | Chat sessions — tier, title, token_count, summary, summarized_up_to_id |
| `messages` | Individual messages — role, content, model_used, timestamp, rag_sources JSONB |
| `documents` | Uploaded documents — status, chunk_count, user_id, error_message |
| `document_chunks` | Chunks — text, token_count, qdrant_point_id, user_id |
| `conversation_documents` | Junction table — scopes documents to conversations |
| `bm25_indexes` | Per-document BM25 corpus — chunk_ids, corpus JSON |

---

## API Endpoints (27 total)

| Method | Path | Status |
|---|---|---|
| POST | `/api/auth/login` | ✅ |
| GET | `/api/auth/me` | ✅ |
| POST | `/api/chat` | ✅ SSE streaming |
| GET | `/api/chat/conversations` | ✅ |
| GET | `/api/chat/conversations/{id}/messages` | ✅ |
| GET | `/api/chat/{id}/documents` | ✅ |
| POST | `/api/chat/{id}/documents` | ✅ batch attach |
| POST | `/api/chat/{id}/documents/{doc_id}` | ✅ single attach |
| DELETE | `/api/chat/{id}/documents/{doc_id}` | ✅ |
| GET | `/api/documents` | ✅ |
| POST | `/api/documents/upload` | ✅ |
| POST | `/api/documents/url` | ❌ 501 stub |
| GET | `/api/documents/{id}` | ✅ |
| GET | `/api/documents/{id}/progress` | ✅ per-doc |
| GET | `/api/documents/progress/active` | ✅ bulk active |
| GET | `/api/documents/{id}/conversations` | ✅ |
| DELETE | `/api/documents/{id}` | ✅ |
| GET | `/api/system/health` | ✅ |
| GET | `/api/system/resources` | ✅ |
| GET | `/api/system/models` | ✅ |
| GET/POST | `/api/research` | ❌ stub |
| POST | `/api/quizzes/generate` | ❌ stub |
| GET | `/api/quizzes/due` | ❌ stub |
| GET | `/api/quizzes/concepts/mastery` | ❌ stub |
| GET | `/api/graph/visualize` | ❌ stub |
| GET | `/api/graph/nodes` | ❌ stub |
| GET | `/api/graph/gaps` | ❌ stub |

---

## Known Bugs / Open Issues

| # | Severity | Description | File |
|---|---|---|---|
| 1 | ~~High~~ ✅ | ~~Wrong LLM~~ — Updated to `qwen3.5:9b` across all config files | `config.py`, `docker-compose.yml`, `.env.example`, `init-ollama.sh` |
| 2 | ~~High~~ ✅ | ~~Vector dimension unverified~~ — confirmed `nomic-embed-text` = 768-dim; `VECTOR_SIZE = 768` is correct | `db/qdrant.py` |
| 3 | ~~Medium~~ ✅ | ~~Per-document progress polling~~ — `GET /api/documents/progress/active` bulk endpoint implemented | `api/documents.py`, `DocumentList.tsx` |
| 4 | ~~Medium~~ ✅ | ~~Naive chunking~~ — replaced with sentence-aware chunking via nltk in `core/ingestion.py` | `core/ingestion.py` |
| 5 | Medium | Summarization in hot path — `_generate_and_cache_summary()` blocks the next user request | `core/context.py` |
| 6 | Medium | No Celery/Redis — background processing uses FastAPI `BackgroundTasks`; no retries, no persistence | `api/documents.py` |
| 7 | Low | `contextBudget` wrong in frontend store — hardcoded 4096, backend uses 8192 | `stores/chat.store.ts` |
| 8 | ~~Low~~ ✅ | ~~No stream abort~~ — `AbortController` wired in `useSSEChat`, Square button in `MessageInput` calls abort | `hooks/useSSEChat.ts`, `api/client.ts` |
| 9 | Low | Muting docs is UI-only — `mutedIds` in `DocumentBar` never sent to backend; all attached docs searched | `DocumentBar.tsx`, `api/chat.py` |
| 10 | ~~Low~~ ✅ | ~~`pendingDocuments` not cleared on new chat~~ — `Sidebar.tsx` `handleNewChat` calls `setPendingDocuments([])` | `Sidebar.tsx` |
| 11 | Low | RAG scores always 0.0 — RRF produces ranks not similarity scores; citation panel shows 0% | `core/rag.py`, `Message.tsx` |

---

## Docker Compose — Current vs Target

| Service | Current | Target |
|---|---|---|
| postgres | ✅ Running | ✅ |
| ollama | ✅ Running | ✅ |
| init-ollama | ✅ (pulls qwen3.5:9b + nomic-embed-text) | ✅ |
| qdrant | ✅ Running (named volume `qdrant_data`) | ✅ |
| backend | ✅ Running | ✅ |
| redis | ❌ Missing | Add to compose |
| celery worker | ❌ Missing | Add (Phase 2) |
| celery beat | ❌ Missing | Add (Phase 2) |
| nginx | ❌ Missing | Add for prod |
| frontend | ❌ Not containerized | Add for prod |

---

## Phase Status

| Phase | Status | Blocker |
|---|---|---|
| Phase 1: Foundation | ~95% | Missing: Celery, Redis |
| Phase 2: Document Processing | ~15% | Crawl4AI (501 stub), video/Whisper, Celery all missing |
| Phase 3: Learning Features | 0% | |
| Phase 4: Two-Tier Knowledge | 0% | |
| Phase 5: Research Pipeline | 0% | |
| Phase 6: Knowledge Graph | 0% | |
| Phase 7: Router + MCP | 0% | |
| Phase 8: Production Polish | 0% | |

---

## Frontend Status

| Feature | Status |
|---|---|
| App shell (Next.js 15 App Router, 6 tabs) | ✅ |
| JWT auth + auth guard | ✅ |
| SSE streaming chat | ✅ |
| Conversation list + switching | ✅ |
| Markdown rendering (react-markdown + remark-gfm) | ✅ |
| Source citations (collapsible SourcesPanel) | ✅ |
| Tier badge on assistant messages | ✅ |
| Documents tab (upload, staging, progress, delete) | ✅ |
| System footer (live polling) | ✅ |
| Typed API client (`api/client.ts`) | ✅ |
| Stream abort / stop button | ✅ |
| Token flush throttle (50ms buffer) | ❌ |
| Auto-scroll at-bottom detection | ❌ |
| Suggestion/recommendation pills | ❌ |
| Document attachment UI in chat (CommandPalette + DocumentBar working memory) | ✅ |
| "Chat about this" from Documents tab (all paths: new/existing/modal) | ✅ |
| Search-all globe toggle in MessageInput | ✅ |
| Scope bar (document chips + search-all pill above input) | ✅ |
| Pin/attach button on RAG source cards | ✅ |
| URL ingestion input | ❌ (blocked on Crawl4AI backend) |
| Delete confirmation | ❌ |
| Bulk document progress (frontend) | ❌ |
| PromotionCard + StreamDone.promotion_suggestion | ❌ |
| Message list virtualization | ❌ |
| Research tab (beyond stub) | ❌ |
| Quizzes tab (beyond stub) | ❌ |
| Knowledge Graph tab (beyond stub) | ❌ |
| Settings tab (beyond stub) | ❌ |

---

*Athena · Codebase Status · 2026-03-04*
