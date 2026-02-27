# Athena — Codebase Status
## 2026-02-26

---

## Codebase Metrics

| Metric | Value |
|---|---|
| Backend Python LOC | ~2,125 |
| Frontend TypeScript/TSX LOC | ~3,120 |
| Total Code LOC | ~5,245 |
| Backend Python files | 24 |
| Frontend TS/TSX files | 48 |
| API endpoints | 25 |
| Database tables | 7 |
| SQL migrations | 3 |

### Backend File Breakdown

| File | Lines | Notes |
|---|---|---|
| `api/chat.py` | 346 | SSE streaming, conv management, doc attach/detach |
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
| `models/chat.py` | 26 | ChatRequest, ConversationOut, MessageOut |
| `models/auth.py` | 18 | Token, UserOut |
| `models/system.py` | 21 | ResourceStats, HealthResponse |

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
           ├─ chunk_text() — sliding 512-token window, 64-token overlap (no sentence awareness yet)
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
| `messages` | Individual messages — role, content, model_used, timestamp |
| `documents` | Uploaded documents — status, chunk_count, user_id, error_message |
| `document_chunks` | Chunks — text, token_count, qdrant_point_id, user_id |
| `conversation_documents` | Junction table — scopes documents to conversations |
| `bm25_indexes` | Per-document BM25 corpus — chunk_ids, corpus JSON |

---

## API Endpoints (25 total)

| Method | Path | Status |
|---|---|---|
| POST | `/api/auth/login` | ✅ |
| GET | `/api/auth/me` | ✅ |
| POST | `/api/chat` | ✅ SSE streaming |
| GET | `/api/chat/conversations` | ✅ |
| GET | `/api/chat/conversations/{id}/messages` | ✅ |
| GET | `/api/chat/{id}/documents` | ✅ |
| POST | `/api/chat/{id}/documents/{doc_id}` | ✅ |
| DELETE | `/api/chat/{id}/documents/{doc_id}` | ✅ |
| GET | `/api/documents` | ✅ |
| POST | `/api/documents/upload` | ✅ |
| POST | `/api/documents/url` | ❌ 501 stub |
| GET | `/api/documents/{id}` | ✅ |
| GET | `/api/documents/{id}/progress` | ✅ (per-doc only, bulk TBD) |
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
| 1 | High | Wrong LLM — `llama3.2:3b` in use, spec requires `qwen2.5:7b` (Tier 1). Update `OLLAMA_MODEL` env var and `init-ollama` | `config.py`, `docker-compose.yml` |
| 2 | High | Vector dimension unverified — `VECTOR_SIZE = 768` but spec says 384. Run `curl` check below to confirm | `db/qdrant.py` |
| 3 | Medium | Per-document progress polling — `DocumentList.tsx:117` fires N fetches/cycle. Need `GET /api/documents/progress?ids=...` bulk endpoint | `api/documents.py`, `DocumentList.tsx` |
| 4 | Medium | Naive chunking — no sentence-boundary awareness; splits mid-sentence | `core/ingestion.py` |
| 5 | Medium | Summarization in hot path — `_generate_and_cache_summary()` blocks the next user request | `core/context.py` |
| 6 | Medium | No Celery/Redis — background processing uses FastAPI `BackgroundTasks`; no retries, no persistence | `api/documents.py` |
| 7 | Low | `contextBudget` wrong in frontend store — hardcoded 4096, backend uses 8192 | `stores/chat.store.ts` |
| 8 | Low | No stream abort — `Square` icon shown in `MessageInput` but no `AbortController` wired | `hooks/useSSEChat.ts`, `api/client.ts` |

---

## Docker Compose — Current vs Target

| Service | Current | Target |
|---|---|---|
| postgres | ✅ Running | ✅ |
| ollama | ✅ Running | ✅ |
| init-ollama | ✅ (pulls llama3.2:3b) | Update to pull qwen2.5:7b |
| backend | ✅ Running | ✅ |
| qdrant | ❌ Missing | Add to compose |
| redis | ❌ Missing | Add to compose |
| celery worker | ❌ Missing | Add (Phase 2) |
| celery beat | ❌ Missing | Add (Phase 2) |
| nginx | ❌ Missing | Add for prod |
| frontend | ❌ Not containerized | Add for prod |

---

## Phase Status

| Phase | Status | Blocker |
|---|---|---|
| Phase 1: Foundation | ~75% | Missing: Celery, Redis, sentence-aware chunking, correct model, bulk progress endpoint |
| Phase 2: Document Processing | ~10% | Crawl4AI, video/Whisper, Celery all missing |
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
| Stream abort / stop button | ❌ |
| Token flush throttle (50ms buffer) | ❌ |
| Auto-scroll at-bottom detection | ❌ |
| Suggestion/recommendation pills | ❌ |
| Document attachment UI in chat | ❌ |
| "Chat about this" button in Documents tab | ❌ |
| Chat mode selector (ephemeral / search-all) | ❌ |
| URL ingestion input | ❌ |
| Delete confirmation | ❌ |
| Bulk document progress (frontend) | ❌ |
| PromotionCard + StreamDone.promotion_suggestion | ❌ |
| Message list virtualization | ❌ |
| Research tab (beyond stub) | ❌ |
| Quizzes tab (beyond stub) | ❌ |
| Knowledge Graph tab (beyond stub) | ❌ |
| Settings tab (beyond stub) | ❌ |

---

*Athena · Codebase Status · 2026-02-26*
