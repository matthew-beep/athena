# Athena — TODO

Current phase: **Phase 2** — RAG chat, hybrid search, document ingestion, scoped retrieval, sentence-aware chunking, scope bar, full collections CRUD (backend + frontend), Structural Glass design system, upload modal stages 1–3 fully wired (stage 4 removed), glass audit (Phase F2) complete, batch upload endpoint (files + URLs in one request), collection_id atomic on upload, single polling loop, library view filtering wired, DocumentsPanel owns document fetch.

~~Fix `MAX_RRF_SCORE` NameError~~ ✓ Done
~~Fix `httpx` missing import in `main.py`~~ ✓ Done
~~Collections backend CRUD~~ ✓ Done (all 6 endpoints, Pydantic models, response_model)
~~Collections frontend~~ ✓ Done (create, rename, delete, selection all wired)
~~Upload modal stage 1~~ ✓ Done (drop zone, type badges, file size, URL icon, empty state, staggered animation)
~~Modal shell styling~~ ✓ Done (520px, correct shadow, close button border, scIn animation)
~~CSS utility classes~~ ✓ Done (.btn-g, .btn-p, .inp, .slabel, .df added to globals.css)
~~Upload modal stage 2 styling~~ ✓ Done (file summary bar, collection pill picker with color dots, inline +New input)
~~Upload modal stage 3 styling~~ ✓ Done (blue status banner, per-file spinner cards, progress bar shell)
~~Glass Audit Phase F2~~ ✓ Done (GlassCard, GlassButton, ChatWindow, MessageList, MessageInput, Message, DevModeOverlay, DocumentBar, Sidebar, SystemFooter, MobileHeader, BottomNav, DocumentList, SettingsPanel all migrated off glass-subtle/glass-strong)
~~Fix `/progress/active` route ordering bug~~ ✓ Done (moved above `/{document_id}/progress` so FastAPI doesn't swallow "progress" as a document_id)
~~Wire `collection_id` to upload API~~ ✓ Done (`Form(None)` param on `POST /api/documents/upload`, written to INSERT, `collection_id or None` ensures NULL in DB)
~~`apiClient.postForm` method~~ ✓ Done (added to `frontend/api/client.ts` — sends FormData without setting Content-Type so browser sets multipart boundary automatically)
~~`runImportFromQueue` two-step workaround removed~~ ✓ Done (collection_id now sent atomically in upload FormData; second `POST /collections/{id}/documents` call eliminated)
~~Batch upload endpoint~~ ✓ Done (`POST /api/documents/upload` now accepts `files: list[UploadFile]` + `urls: list[str]` — one request for the whole queue, per-item errors don't fail the batch)
~~URL queue on upload~~ ✓ Done (URLs get a `documents` row with `processing_status='pending'`, `file_type='web'` — no crawling yet, but they have a real `document_id` and appear in progress tracking)
~~Stage 3 renders from `importResult`~~ ✓ Done (file + URL results from batch response, error state for failed items, spinner for successful ones)
~~Stage 3 footer fix~~ ✓ Done ("Close" calls `handleClose` directly, indexing continues in background)
~~Stage 3 progress polling wired~~ ✓ Done (`progressMap` prop threaded from `DocumentsPanel` → `UploadModal`; `getProgressInfo()` maps stage → label; spinners → green `CheckCircle2` on completion; `shimmerPulse` for extracting/chunking, real % bar for embedding)
~~Stage 4 removed~~ ✓ Done (scrapped — stage 3 already shows completion with green checks; `UploadStage = 1 | 2 | 3`)
~~Auto-select new collection in UploadModal~~ ✓ Done (`onCreateCollection` returns `Promise<string>` (collection_id); modal calls `setSelectedCollection(newId)` after creation)
~~Startup cleanup for stuck processing docs~~ ✓ Done (`main.py` lifespan resets any `processing_status='processing'` docs to `error` on boot)
~~Collapse document polling to one endpoint~~ ✓ Done (`/progress/active` includes `pending` docs + `processing_status` per entry; `DocumentsPanel` drops the 3s `/api/documents` loop; one final `fetchDocuments()` when polling ends)
~~Wire collection filter to DocumentList~~ ✓ Done (`collectionIds: string[]` prop passed from `DocumentsPanel`, client-side `.filter()` in `DocumentList`)
~~Wire DocumentTypeSelector tab to DocumentList~~ ✓ Done (`fileType: string` prop, client-side `.filter()` by `fileType === 'all' || d.fileType === fileType.toLowerCase()`)
~~Remove debug red border in DocumentList~~ ✓ Done
~~`GET /api/documents` — add `collection_id` filter + return `collection_id` per row~~ ✓ Done (optional `collection_id` and `file_type` query params; `collection_id` included in SELECT)
~~Lift document fetch to DocumentsPanel~~ ✓ Done (`DocumentList` is now a pure display component; `DocumentsPanel` owns `GET /api/documents`, passes `documents: DocumentItem[]`, `loading`, `error`, `onDelete` down; `handleDeleteDocument` removes from local state)

---

**Next up (in order):**

### Library View — Remaining Wiring

1. **`GET /api/documents` — return `collection_name` per row** — add JOIN to `collections` table, include `collection_name` nullable in each document row. `DocumentItem` and frontend rendering can then show collection name on each doc.
2. **Fix "X Collections" → "X Documents" header count** — header currently shows collection count. Switch to total doc count or remove subtitle entirely (revisit when pagination lands).
~~3. **Document assign to collection UX**~~ ✓ Done (`•••` menu on each doc row — "Move to collection" submenu (two-state menu, collections list, Unassign option) + "Delete". Same `Menu` component pattern as `CollectionsList`. `handleMoveToCollection` in `DocumentsPanel` handles both POST assign and DELETE unassign.)
~~4. **Remove duplicate `refetchCollections` call**~~ ✓ Already gone — the two call sites (mount `useEffect` + `createCollection`) are both necessary and serve different purposes. No change needed.
5. **Drag doc to collection** — drag a document row onto a collection in the sidebar to assign it. Deferred — do after basic assign UX is stable.
6. **Refetch docs on collection delete** — when a collection is deleted in `DocumentSideBar`, `onCollectionDeleted` removes it from `selectedCollections` but `documents` state is stale — doc rows still show the deleted collection name. Fix: call `fetchDocuments()` from `DocumentsPanel` after a collection is deleted, or optimistically clear `collection_id`/`collection_name` on all docs that had that collection.

### Collection Colors

1. **Backend: add `color` column to `collections` table** — migration: `ALTER TABLE collections ADD COLUMN color VARCHAR(20) NOT NULL DEFAULT 'var(--blue)'`. Auto-assign from a preset palette on CREATE (cycle through blue/purple/green/amber/red/slate by existing row count). Return `color` in `GET /api/collections`, `POST /api/collections`, `PUT /api/collections/{id}` responses.
2. **Backend: update Pydantic models** — add `color: str` to `CollectionItem` and `CollectionMutateResponse` in `models/collections.py`. Add `color` to the SELECT in `get_collections` query.
3. **Backend: `PUT /api/collections/{id}` accepts color** — add optional `color: str | None` to `CollectionNameRequest` (or a new `CollectionUpdateRequest`). Update SQL to set color if provided.
4. **Frontend: add `color` to `CollectionItem` type** — `frontend/types/index.ts`. Remove `COLLECTION_COLORS` array and the index-based `collectionColor()` fallback from `UploadModal.tsx`. Use `c.color` directly everywhere a collection color is needed.
5. **Frontend: wire color into `CollectionsList`** — any component rendering collection pills/dots should read `c.color` from the API response, not derive it locally.


### RAG Scoring Audit
- [ ] **Audit RRF score accuracy** — with scoring unblocked, verify numbers are meaningful. With `k=60` and ~20 results, max RRF score is ~2*(1/61) ≈ 0.033 — too small to display raw. Normalize against top result score so displayed scores span `0.0–1.0`. Add debug log of top-5 chunk_ids + scores in `retrieve()` for validation.
- [ ] **Expose scores in frontend source citations** — `rag_sources` carries `score` and `score_type` but verify `SourcesPanel` in `Message.tsx` actually renders them. Show as a small badge (e.g. `0.87 · hybrid`) next to each source.

### URL Ingestion
~~**Investigate Crawl4AI response shape**~~ ✓ Done — confirmed via live test. Response is `{ success, results: [{ url, html, markdown: { raw_markdown, markdown_with_citations, fit_markdown, references_markdown }, metadata: { title, description, og:* }, links: { internal, external }, media }] }`. Useful fields: `results[0].markdown.raw_markdown` (text to ingest), `results[0].metadata.title` (display name), `results[0].url` (source ref). `fit_markdown` strips nav/footer noise — worth testing vs `raw_markdown` for embedding quality.
- [ ] **Write `core/crawler.py`** — `FetchResult` dataclass (`url`, `markdown`, `title`, `word_count`). `fetch_url(url)` calls `POST /crawl`, extracts `results[0].markdown.raw_markdown`, `results[0].metadata.title`. Raise `HTTPException(502)` on Crawl4AI error.
- [ ] **`_process_url_document()` in `documents.py`** — mirrors `_process_document()` but takes a `FetchResult` instead of `bytes`. Calls `fetch_url()`, then runs chunk → embed → Qdrant → BM25 pipeline. Store `source_url` in Qdrant payload, use `title` as filename.
- [ ] **Wire URL loop in `/upload`** — currently creates a `pending` DB row but never processes it. Add `background_tasks.add_task(_process_url_document, document_id, url, user_id)` after DB insert, set `processing_status='processing'`.
- [ ] **Frontend URL ingestion UX** — loading state, error feedback, clear input on success, wire `onUploadStart`/`onUploadComplete`. Remove raw markdown preview from `UploadZone`.

### Pagination + Search
- [ ] **Backend: search + pagination on `GET /api/documents`** — add `search: str`, `limit: int`, `offset: int` query params. Return `total` count alongside results. Filter: `AND ($n = '' OR filename ILIKE '%' || $n || '%')`.
- [ ] **Frontend: debounced search + pagination controls** — remove client-side `.filter()` in `DocumentList`. Pass `search` as query param (debounced ~300ms). Add prev/next controls, reset offset on search change.

### Infrastructure
- [ ] **Fix context window tracking** — expose `conversations.token_count` in `GET /api/chat/conversations`. Pre-populate `contextTokens[convId]` on load. Apply `context_debug` tokens immediately on SSE event. Fix `contextBudget` hardcoded `4096` in `DevModeOverlay.tsx`.
- [ ] **Add SearXNG to Docker Compose** — self-hosted search, same sidecar pattern as Crawl4AI.
- [ ] **Redis + Celery** — migrate document processing from `BackgroundTasks` to Celery once ingestion paths are stable. Enables retries, parallelism, and survival across restarts. Do this before URL ingestion goes live — URL crawling + file ingestion running concurrently is where sequential BackgroundTasks becomes a real problem.
- [ ] **Document cancel** — add `_cancelled: set[str]` module-level in `documents.py`. `POST /api/documents/{id}/cancel` adds to set. `_process_document` checks at each stage boundary and calls cleanup (DELETE documents row → cascades chunks, delete Qdrant points). Not immediate — stops at next checkpoint. Low priority until Celery (which gives `revoke(terminate=True)` for free).

### pg_search Migration (do before URL ingestion goes live)

- [ ] **Swap Docker image** — `postgres:16-alpine` → `paradedb/paradedb:latest` in both compose files. Drop-in replacement.
- [ ] **Migration `005_pg_search.sql`** — `CREATE EXTENSION IF NOT EXISTS pg_search;`, drop `bm25_indexes` table, create BM25 index on `document_chunks` (key: `chunk_id`, fields: `text` + `filename_normalized` boosted 4×). Verify `filename_normalized` column exists on `document_chunks` — it's in Qdrant payload but may need adding to the table.
- [ ] **Rewrite `bm25_search()` in `core/rag.py`** — replace Python `rank_bm25` scoring with SQL: `WHERE text @@@ $1 ORDER BY paradedb.score(chunk_id) DESC`. Scoped path adds `AND document_id = ANY($2)`, search_all path adds `AND user_id = $2`.
- [ ] **Delete old BM25 plumbing** — remove `core/bm25.py`, remove `build_bm25_index` call from `_process_document`, remove `_bm25_cache` + helpers from `rag.py`, remove `rank-bm25` from `requirements.txt`.
- [ ] **Test** — upload a doc, ask a question, verify hybrid search + RRF still returns results.

---

## Bugs / Active Issues

- [x] **Document progress polling is per-document** — replaced per-document poll loop with
  `GET /api/documents/progress/active` batch endpoint. Single request per 800ms tick regardless
  of how many documents are processing. Completion detected via disappearance from response.
- [x] **BM25 hybrid search** — `rank_bm25` wired into `core/rag.py` with RRF fusion. ~~Imported but unused.~~
- [x] **Dead branch in `find_referenced_document`** — removed unreachable `len(document_ids) == 0` guard.
- [x] **`rag_threshold` incompatible with RRF** — removed cosine threshold filter; RRF rank position gates quality instead.
- [x] **Missing `user_id` guard on chunk text fetch** — added `AND d.user_id = $2` to the Postgres query in `retrieve()`.
- [x] **`reciprocal_rank_fusion` attribute error** — fixed `hit.payload["chunk_id"]` → `hit.get("payload", {}).get("chunk_id")` (Qdrant returns plain dicts from JSON, not objects).
- [x] **`None` in `ranked_ids` for search_all path** — `rag.py` vector-only branch used a bare list
  comprehension with no `chunk_id` guard; `None` values could enter the SQL `ANY($1)` array. Fixed
  with walrus-operator filter: `[cid for h in vector_hits if (cid := ...)]`.
- [x] **Vector dimension mismatch** — verified via Ollama embed API: `nomic-embed-text` produces
  768-dimensional vectors. `VECTOR_SIZE = 768` in `db/qdrant.py` is correct. `CLAUDE.md` updated
  from 384 → 768.
- [x] **Wrong Ollama model** — MacBook uses `qwen2.5:7b` (Docker Desktop memory limit). Desktop
  (RTX 5060 Ti) will use `qwen3.5:4b` via `docker-compose.gpu.yml`. Root `.env` is now the single
  source of truth — `config.py` resolves it via `Path(__file__)`, `next.config.mjs` reads it at
  build time. See `DEPLOYMENT.md` for per-machine instructions.
- [x] **Naive token chunking** — replaced with sentence-aware chunking in `ingestion.py`. Uses nltk
  `sent_tokenize`, 500-token chunks, 50-token sentence-level overlap. PDF hyphenated line breaks normalized.
- [x] **RAG threshold incompatible with hybrid search** — duplicate of item above; confirmed fixed.
- [ ] **URL ingestion is a scraper preview, not real ingestion** — `POST /api/documents/url` calls Crawl4AI and returns the raw markdown payload to the frontend. It never creates a `documents` row, never chunks/embeds, never stores in Qdrant. The frontend renders a markdown preview. Nothing is actually ingested. Additionally, the backend doesn't handle the case where `markdown` is an object (`{ raw_markdown, markdown_with_citations }`) — only the string case works.
- [x] **`MAX_RRF_SCORE` undefined** — removed reference. Fixed.
- [x] **`httpx` not imported in `main.py`** — added import. Fixed.
- [ ] **`collections` color column** — reopened. Add `color VARCHAR(20)` to the `collections` table. See Collection Colors section under Next Up.
- [ ] **No deduplication in RAG** — can return near-identical chunks from the same document. Add a
  minimum chunk distance check or a per-document chunk cap before returning sources.
- [x] **RAG sources not persisting across page reload** — `save_message` never stored `rag_sources`;
  `get_messages` SELECT didn't include the column; `MessageOut` had no field. Fixed: added
  `rag_sources JSONB` column (migration 003), updated `context.py`, `models/chat.py`, `api/chat.py`.
- [x] **RAG scores always 0** — fixed. `vector_scores` map built from Qdrant hits before RRF. Pre-fusion cosine score passed through to each source's `score` field.
- [x] **`/progress/active` route shadowed by `/{document_id}/progress`** — FastAPI was matching `GET /documents/progress/active` against the parameterized route, treating `"progress"` as a `document_id`. Fixed by moving `GET /progress/active` above `GET /{document_id}/progress` in `documents.py`.

---

## Backend

### Phase 1 Completion

- [x] **Sentence-aware chunking** — `chunk_text()` in `ingestion.py` uses nltk `sent_tokenize`.
  500-token chunks, 50-token sentence-level overlap, PDF hyphen normalization. `nltk>=3.9` in requirements.

- [ ] **Replace pypdf + python-docx with Docling** — `extract_text()` in `core/ingestion.py` uses
  `pypdf` (loses layout, fails on scanned PDFs) and `python-docx` (loses tables/heading hierarchy).
  Replace both with `docling` — unified extraction for PDF, DOCX, PPTX, HTML, images. Outputs
  structured markdown so tables/headings/lists survive intact. Built-in OCR handles scanned PDFs.
  `chunk_text()` and everything downstream is unchanged — Docling just produces better input.
  - Remove `pypdf` and `python-docx` from `requirements.txt`, add `docling`
  - Keep extraction inside `asyncio.to_thread` — Docling is compute-heavy
  - Test against: scanned PDF, DOCX with tables, markdown file, plain text

- [ ] **Migrate BM25 to `pg_search` (ParadeDB)** — current `rank_bm25` Python lib is a whitespace
  tokenizer with no stemming, no fuzzy matching, O(N) in-memory scoring, and ~150 lines of manual
  cache/rebuild plumbing. `pg_search` (formerly `pg_bm25`) is a Rust/Tantivy Postgres extension
  with a real inverted index, true BM25 (TF saturation + IDF + length norm), fuzzy matching, and
  automatic index maintenance on INSERT/UPDATE/DELETE. No Python deps, no cache layer, no manual rebuilds.

  **Migration order:**
  1. Swap `postgres:16-alpine` → `paradedb/paradedb:16` in both `docker-compose.yml` and
     `docker-compose.mac.yml`. Drop-in replacement — same env vars, volumes, ports, health check.
  2. Add `CREATE EXTENSION IF NOT EXISTS pg_search;` to init SQL or new migration.
  3. Add `filename_normalized` column to `document_chunks` if not already present; backfill from `documents`.
  4. Write migration: drop `bm25_indexes` table, create BM25 index:
     ```sql
     CREATE INDEX document_chunks_search_idx ON document_chunks
     USING bm25 (chunk_id, text, filename_normalized)
     WITH (key_field = 'chunk_id');
     ```
  5. Rewrite `bm25_search()` in `core/rag.py` — SQL query replaces Python scoring:
     ```python
     WHERE text @@@ $1 OR filename_normalized @@@ paradedb.boost(4.0, $1)
     ORDER BY paradedb.score(chunk_id) DESC LIMIT $2
     ```
  6. Test hybrid search end-to-end, compare RRF output vs baseline.
  7. Delete old BM25 plumbing: `bm25_indexes` table, `_bm25_cache`, `get_or_build_bm25()`,
     `invalidate_bm25_cache()`, `update_bm25_index()`, `rebuild_bm25_for_tag()`.
  8. Remove `rank-bm25` from `requirements.txt`.
  9. Update `find_referenced_document()` — replace exact substring match with `rapidfuzz.fuzz.partial_ratio()`
     threshold ~75, or drop it entirely and rely on `filename_normalized` field boosting in the BM25 query.

  **What stays the same:** `reciprocal_rank_fusion()`, `hybrid_search()` orchestration, Qdrant vector
  leg, `asyncpg` connection, all ingestion code.
- [ ] **Migrate document processing to Celery** — currently using FastAPI `BackgroundTasks`. Move
  `_process_document` into a Celery task in `tasks/ingestion.py`. API returns task ID immediately.
  Requires Redis broker and Celery worker added to Docker Compose.
- [ ] **Redis client** — `db/redis.py` not implemented. Needed for Celery broker, storage stats cache,
  and future session data.
- [ ] **`GET /api/system/health`** — not implemented. Should return service status for all deps
  (Postgres, Qdrant, Ollama, Redis reachability).
- [ ] **`GET /api/system/resources`** — not implemented. Returns live CPU %, GPU VRAM used/total,
  RAM used/total. Frontend system footer polls this every 10s.
- [ ] **`GET /api/system/storage`** — not implemented. Must read from Redis cache only, never compute
  on request. Celery beat job refreshes every 5 min.
- [x] **Conversation list endpoint** — `GET /api/chat/conversations` implemented at `chat.py:272`.
- [x] **Conversation history endpoint** — implemented at `chat.py:287` as
  `GET /api/chat/conversations/{id}/messages`.

### Phase 2: Document Processing

- [ ] **Web URL scraping** — wire Crawl4AI into `POST /api/documents/url`. Currently returns 501.
  Use FastAPI `BackgroundTasks` (same as PDF upload) for now — no Celery needed yet. Crawl4AI fetches
  URL → returns markdown → same chunk → embed → Qdrant pipeline as file upload. Returns `document_id`
  immediately. **This is the #1 priority** — unblocks URL UI and research pipeline Stage 1.
- [ ] **Video/audio ingestion** — Faster-Whisper transcription already stubbed in `ingestion.py` but
  not connected to the Celery pipeline. Wire it up: yt-dlp download → Whisper transcription → chunk → embed.
- [x] **Bulk document progress endpoint** — `GET /api/documents/progress/active` returns a
  map of `{ document_id: { stage, done, total, active } }`. Eliminates per-document polling loop.

### Phase 3: Learning Features

- [ ] **Quiz generation** — `POST /api/quizzes/generate` is a stub. Implement `core/quiz.py`:
  fetch relevant chunks from Qdrant, send to Tier 2 (qwen2.5:30b), parse structured JSON response
  into `quiz_questions` rows.
- [ ] **Quiz answer submission** — `POST /api/quizzes/{quiz_id}/answer` stub. Update `quiz_questions`,
  run SM-2 algorithm, update `concept_mastery`.
- [ ] **SM-2 spaced repetition** — implement `update_sm2()` in `core/quiz.py`. Updates `ease_factor`,
  `interval_days`, `next_review` on `concept_mastery` table after each answer.
- [ ] **`GET /api/quizzes/due`** — return overdue items where `next_review <= NOW()`.
- [ ] **`GET /api/concepts/weak`** — return concepts where `mastery_percentage < 60`.

### Phase 4: Two-Tier Knowledge Model

- [ ] **Enforce ephemeral tier** — current chat code doesn't check `knowledge_tier`. Ephemeral
  conversations must never query or write to Qdrant. Enforce in `core/rag.py` retrieve() and the
  chat handler.
- [ ] **Engagement signal tracking** — after every assistant response, upsert into `learning_signals`
  and `topic_engagement`. Check thresholds (3+ follow-ups same session, 2+ sessions, etc.).
- [ ] **Promotion suggestion logic** — if threshold hit and promotion not already offered this session,
  include `promotion_suggestion: { topic, reason }` in the chat SSE `done` event.
- [ ] **Promotion acceptance endpoint** — `POST /api/chat/promote` — takes topic + conversation_id,
  pulls relevant messages, runs full ingestion pipeline (chunk → embed → Qdrant → concept extraction).

### Phase 5: Research Pipeline

- [ ] **Research Celery pipeline** — 5-stage chain in `tasks/research.py`:
  collect → filter → kb-check → synthesize (Tier 3, num_gpu=0) → ingest.
- [ ] **WebSocket progress endpoint** — `WS /ws/research/{research_id}` pushes stage update events.
  Stages publish to Redis pub/sub; WS handler relays to client.
- [ ] **Research approval flow** — pipeline must not run until `POST /api/research/{id}/approve`.
- [ ] **SerpAPI integration** — Stage 1 web search. Skip gracefully if `SERP_API_KEY` not set.
- [ ] **Knowledge base check (Stage 3)** — embed topic → Qdrant similarity. If > 0.85: skip synthesis.
  0.6–0.85: augment mode. < 0.6: full synthesis mode.

### Phase 6: Knowledge Graph

- [ ] **Concept extraction** — after Stage 4 synthesis, run second Tier 2 call with extraction prompt.
  Parse nodes + edges, upsert to `graph_nodes` / `graph_edges`.
- [ ] **Graph API endpoints** — `GET /api/graph/nodes`, `/edges`, `/visualize`, `/related`, `/gaps`.
- [ ] **Graph decay Celery job** — weekly beat task: nodes not reinforced in 90 days lose 10% weight.
  Minimum 0.1 — never delete.

### Phase 7: Router + MCP

- [ ] **Intent router** — `core/router.py` — Tier 1 LLM call before every chat message. Classifies
  intent, selects tools, determines tier. Fallback to `rag_query + Tier 1` if confidence < 0.7.
- [ ] **MCP connection manager** — `mcp/client.py` — dynamic tool discovery at connection time.
  Router uses tool descriptions to decide invocation, no hardcoded logic.

### Phase 8: Production

- [ ] **Prometheus metrics** — `GET /metrics` endpoint. Track: request latency, LLM generation time,
  RAG search time, Celery queue depth.
- [ ] **Celery beat jobs** — storage stats (5 min), Postgres backup (2am), Qdrant snapshot (3am Sun),
  graph decay (4am Sun), backup cleanup (5am).
- [ ] **Automated backups** — `tasks/backup.py`: pg_dump to `BACKUP_PATH`, Qdrant snapshot API,
  cleanup files older than 30 days.

---

## Frontend

### Already Implemented (verified)
- [x] **SystemFooter** — wired to `useSystemStats` hook, live polling every 10s.
- [x] **Conversation list in sidebar** — `Sidebar.tsx` fetches and renders conversation list.
- [x] **Conversation switching** — clicking a conversation loads its history via
  `GET /api/chat/conversations/{id}/messages` and populates the store.
- [x] **Markdown rendering** — `Message.tsx` uses `react-markdown` + `remark-gfm`.
- [x] **Source citations UI** — `SourcesPanel` in `Message.tsx` is collapsible, deduped by filename.
- [x] **Tier badge** — `TierBadge` rendered in `Message.tsx` when `model_used` is present.
- [x] **API client module** — `frontend/api/client.ts` exists with `get`, `post`, `del`, `postStream`.

### ~~Priority 1: Document Progress Polling~~ ✓ Done

- [x] **Backend bulk progress endpoint** — `GET /api/documents/progress/active` implemented.
- [x] **Frontend: replace per-document poll loop** — `DocumentList.tsx` updated to single fetch.

### Priority 1: Document Chat (Start chat from document)

**Implemented** (2026-03-02) via `pendingDocuments` store pattern — not URL params as originally
planned. The store is the staging area before a conversation exists; backend is source of truth after.

**Actual flow built:**
```
Click "Chat" on document (DocumentList)
  → 0 existing convs  → setPendingDocuments([{ document_id, filename, file_type }])
                         navigate to /chat (sidebar auto-opens, DocumentBar shows pending doc)
  → 1+ existing convs → show inline modal listing existing conversations
                         "Pick existing" → POST /api/chat/{conv_id}/documents (batch attach)
                         "+ Start new"   → setPendingDocuments([...]) + navigate to /chat

Chat page: user sends first message (useSSEChat)
  → reads pendingDocuments from store
  → POST /api/chat { message, document_ids: ["X"] }   ← no conversation_id yet
  → backend: create conv → attach_documents(conv_id, document_ids) → RAG scoped → stream
  → done event: clears pendingDocuments from store, sets activeConversationId
  → subsequent messages: { message, conversation_id } — no document_ids needed
```

**Backend — status:**
- [x] **`GET /api/documents/{document_id}/conversations`** — implemented in `documents.py`. Returns
  3 most recent conversations that have this document attached. Used by `DocumentList` chat modal.
- [x] **`document_ids` in `ChatRequest`** — `models/chat.py` has `document_ids: list[str] = []`.
  `api/chat.py` calls `await attach_documents(conversation_id, body.document_ids)` before
  `stream_response()`, ensuring RAG scope is set on the very first message.

**Frontend — status:**
- [x] **DocumentList "Chat" button** — shows modal with existing conversations + "+ Start new chat"
  option. All three paths (no convs, new from modal, pick existing) now correctly stage or attach docs.
- [x] **`pendingDocuments` in store** — `PendingDocument[]` in `chat.store.ts`. Holds full objects
  (id, filename, file_type) so DocumentBar can display them before a conversation exists.
- [x] **`useSSEChat` sends `document_ids` on first message** — extracts IDs from `pendingDocuments`,
  includes in POST body for new conversations only. Clears `pendingDocuments` on `done`.
- [x] **DocumentBar shows pending docs** — when `activeConversationId` is null, `displayDocuments`
  is derived from `pendingDocuments` store state. Remove (×) updates the store, no API call.
- [x] **Auto-open context panel** — `ChatWindow` `useEffect` opens the right panel and collapses
  the conversation sidebar whenever `pendingDocuments.length > 0 && !activeConversationId`.
- [ ] **Scope pill / proper scoping UX** — DocumentBar shows working memory but there's no
  prominent pill above `MessageInput` confirming scope. Consider adding a compact bar between
  the message list and input showing attached doc chips with × to detach.
- [ ] **`GET /api/chat/conversations?document_id=` popover** — replace the modal with a proper
  inline popover on the Chat button. Requires the backend endpoint above.

### Pagination + Server-Side Search (Documents Tab)

These two are coupled — pagination makes client-side search incorrect, so they must ship together.

- [ ] **Backend: add search + pagination to `GET /api/documents`** — add optional query params:
  `search: str = ""`, `limit: int = 20`, `offset: int = 0`. Filter with
  `AND ($2 = '' OR filename ILIKE '%' || $2 || '%')`. Return `total` count (separate COUNT query)
  alongside the page of results so the frontend can render page controls.
- [ ] **Frontend: debounced search input** — remove client-side `.filter()` from `DocumentList.tsx`.
  Pass `search` term as query param to `fetchDocuments`. Debounce input by ~300ms to avoid
  a DB hit on every keystroke.
- [ ] **Frontend: pagination controls** — track `offset` in state. Add prev/next (or page number)
  controls below the document list. Reset to `offset=0` whenever search term changes or a new
  document is uploaded.

### Chat: Stream Abort (Stop Button) ✓ Done

- [x] **`AbortController` in `useSSEChat`** — `abortRef` created per-request, nulled in `finally`.
- [x] **`postStream` signal parameter** — `api/client.ts:postStream` accepts optional `AbortSignal`.
- [x] **Wire Square button in `MessageInput`** — button splits into stop/send; stop calls `abortRef.current?.abort()` via `stopStreaming` returned from hook.
- [x] **Handle abort in stream loop** — `AbortError` caught silently, `isStreaming` cleared in `finally`.

### Chat: Search All + Document Attachment Flow

These two features are intentionally connected. Search all is the discovery mechanism — the user
searches their entire knowledge base when they don't know which document is relevant. Sources returned
in search-all mode become the attachment point: the user can pin a document to the conversation
directly from the source citation, narrowing to scoped retrieval for subsequent messages.

**Intended UX flow:**
```
User enables search-all toggle
    → asks a question
    → backend searches all ingested documents (vector, user-scoped)
    → response returns with rag_sources showing which documents matched

User sees relevant sources in the SourcesPanel
    → clicks "Attach" on a source
    → document is pinned to the conversation via POST /api/chat/{conv_id}/documents/{doc_id}
    → search-all auto-disables for this conversation (scoped takes over)
    → subsequent messages search only attached documents
    → scope bar shows attached document chips above the input
```

**What's already in place:**
- `retrieve()` in `core/rag.py` already accepts `search_all: bool = False`. When `True` and `doc_ids`
  is empty, it builds a Qdrant filter scoped to `user_id` only and searches the full collection.
- Attach/detach API endpoints already exist: `POST/DELETE /api/chat/{conv_id}/documents/{doc_id}`.

**Backend:**
- [x] **Add `search_all` to `ChatRequest`** — `models/chat.py:10` has `search_all: bool = False`.
- [x] **Pass `search_all` through in `chat.py`** — three-branch logic in `stream_response()` at
  `chat.py:161-168`.
- [x] **BM25 path for search_all** — `rag.py:199` guards BM25 behind `if search_ids:`; search_all
  path sets `search_ids = []` so BM25 is skipped, falls to vector-only.
- [x] **Include `document_id` on every rag_source in the `done` event** — present at `chat.py:253`.

**Frontend:**
- [x] **`search_all` state in store** — `conversationSearchAll: Record<string, boolean>` + `setSearchAll`
  in `chat.store.ts:32-53`. Also added `pendingSearchAll` + `setPendingSearchAll` for new-conversation
  edge case (before a `conversation_id` exists, state is held in `pendingSearchAll` and migrated to
  the real ID on the `done` event).
- [x] **Send `search_all` in chat request** — `useSSEChat.ts:64-71` reads `pendingSearchAll` for new
  conversations and `conversationSearchAll[convId]` for existing ones.
- [x] **Search all toggle in chat UI** — globe icon button in `MessageInput.tsx`. Reflects
  `conversationSearchAll[activeConversationId]` or `pendingSearchAll` for new conversations.
- [x] **"Attach" button on source cards in `SourcesPanel`** — pin icon in `Message.tsx`. POSTs to
  batch attach endpoint, updates `conversationDocuments` store, disables search_all. Disabled when
  doc already attached.
- [x] **Scope bar above message input** — `ScopeBar.tsx` sits between `MessageList` and `MessageInput`
  in `ChatWindow`. Shows "Searching all documents" pill or document chips with × to detach. Hidden
  when no docs and search_all off.
- [x] **`conversationDocuments` in store** — `Record<string, ConversationDocument[]>` in `chat.store.ts`.
  Fetched in `ChatWindow` on every `activeConversationId` change (not just when panel opens). Actions:
  `setConversationDocuments`, `addConversationDocument`, `removeConversationDocument`.

### Chat: Document Attachment Sidebar + Palette (Existing Conversations)

For managing document scope inside an open conversation. Distinct from "start chat from document"
(Priority 1) — this is for attaching/detaching documents while already in a conversation.

**API calls for this entire flow:**
```
On sidebar mount:   GET  /api/chat/{conv_id}/documents        ← what's currently attached
On palette open:    GET  /api/documents                       ← full library, fetched once
On keystroke:       nothing                                   ← client-side filter only
On "Add to chat":   POST /api/chat/{conv_id}/documents        ← batch attach
On × remove:        DELETE /api/chat/{conv_id}/documents/{id} ← already exists
```

**Backend:**
- [x] **`POST /api/chat/{conversation_id}/documents` — batch attach** — implemented. Accepts
  `{ document_ids: list[str] }`, verifies ownership, calls `attach_documents()` in one pass,
  returns `{ conversation_id, document_ids }`.

**Frontend — components (implemented 2026-03-02):**
- [x] **`DocumentBar` component** — right panel in `ChatWindow`. Fetches `GET /api/chat/{conv_id}/documents`
  on mount/conversation change. When `activeConversationId` is null, derives display from
  `pendingDocuments` store. Shows attached docs with × to remove. "+ Add documents" button opens
  `CommandPalette`. Empty state shows "No documents — general chat mode".
- [x] **`CommandPalette` component** — command palette overlay at `components/chat/CommandPalette.tsx`.
  Fetches `GET /api/documents` once on open, filters out already-attached IDs. Auto-focused search.
  Multi-select with toggle checkboxes. "Add to chat" button batch-attaches on confirm.
  - For existing conversations: calls `POST /api/chat/{conv_id}/documents`
  - For new (no conversation yet): updates `pendingDocuments` in store
- [x] **`DocumentBar` wired into `ChatWindow`** — right context panel renders `<DocumentBar />`,
  shown/hidden by `contextPanelOpen` toggle.

**Known issues / remaining work:**
- [ ] **Muting is UI-only** — `DocumentBar` shows a mute toggle but there is no backend concept
  of a muted document. Either wire it (add `muted` flag to `conversation_documents`) or remove the UI.
- [x] **`pendingDocuments` cleared on sidebar new-chat** — `handleNewChat` in `Sidebar.tsx` calls
  `setPendingDocuments([])` before navigating to clear stale staged docs.

### Chat: Document Suggestions (Background Similarity)

- [ ] **Backend: `GET /api/documents/suggest`** — accepts `?query=...&limit=5`. Embeds query,
  searches Qdrant with `user_id` filter only (no document scope), groups hits by `document_id`,
  takes max chunk score per doc, filters by threshold (~0.55), returns
  `[{ document_id, filename, score }]`. Use raw cosine scores — not RRF — so scores are
  meaningful for thresholding. Threshold should be a backend config value.
- [ ] **Frontend: fire suggest on first message** — after the first message in a conversation
  (when `isNewConversation` is true), fire a parallel fetch to `/api/documents/suggest?query=...`.
  Store results in `conversationSuggestions: Record<string, SuggestedDoc[]>` in `chat.store.ts`.
  Re-run on subsequent messages while no documents are in scope. Stop once a document is pinned.
- [ ] **Frontend: Suggested card in right panel** — shows when `conversationSuggestions[convId]`
  is non-empty and no documents are in scope. Each row has filename + score + [+ Pin] button.
  Pinning calls the attach endpoint and moves the doc to the In Scope card.

### Frontend Redesign — Structural Glass

Full design spec in `frontend_design_vision.md`. Two themes: Slate (dark default) + Light.
Glass/blur is restricted to modal overlays only — never panels, tables, nav, or sidebar.

---

#### Phase F1: Token System + Layout Shell ✓ Done
- [x] New Structural Glass token system in `globals.css`: `--floor`, `--surface`, `--surface-2`, `--raised*`, `--border`, `--border-s`, `--t1`–`--t4`, full accent palette with `-a`/`-br` variants
- [x] Slate as dark default in `:root` — `[data-theme="light"]` for light mode
- [x] `tailwind.config.ts`: `border` → `hsl(var(--tw-border))` to avoid clash with rgba `--border` token. `display` font family → Plus Jakarta Sans.
- [x] Body background: `var(--floor)`, mesh gradient system removed
- [x] Scrollbar: `3px`, `rgba(128,128,128,0.25)` thumb
- [x] Font variables: `--font-wordmark` (Cormorant Garamond), `--fd` (Plus Jakarta Sans), `--fb` (Poppins), `--font-ai-msg` (Lora), `--fm` (JetBrains Mono)
- [x] CSS utility classes defined: `.panel`, `.nav-item`, `.trow`, `.col-header`, `.pill/.pill.on`, `.btn/.btn-ghost/.btn-primary/.btn-success/.btn-danger`, `.prog-bar/.prog-fill`, `.status-badge/.status-*`, `.toggle`, `.rpanel-tab`, `.input-field`, `.msg-user/.msg-ai`, `.wordmark`, `.glass-overlay/.glass-modal`
- [x] Animations: `blink`, `shimmerPulse`, `fadeUp` (6px, 0.25s), `scaleIn` (0.97→1, 0.18s), all `cubic-bezier(0.4,0,0.2,1)`

---

#### Phase F2: Glass Audit + Component Rewrites

The old `.glass`, `.glass-subtle`, `.glass-strong` classes are no longer defined — any component referencing them renders with no background. New replacements:
- `.glass-overlay` + `.glass-modal` — modal overlays only (the only blur in the app)
- `bg-[var(--raised)] border border-[var(--border)]` — replaces glass on cards/inputs/panels
- Nothing — replaces glass on sidebar/nav (floor color, hover only)

**UI primitives — update these first, everything else depends on them:**
- [x] **`GlassCard.tsx`** — variants remapped: default/subtle → `bg-[var(--raised)] border border-[var(--border)]`, strong → `bg-[var(--surface-2)] border border-[var(--border-s)]`. `glass-hover` → `hover:bg-[var(--raised-h)]`.
- [x] **`GlassButton.tsx`** — ghost variant: `glass-subtle hover:glass` → `bg-[var(--raised)] border border-[var(--border)] text-[var(--t2)] hover:bg-[var(--raised-h)]`.
- [ ] **`Modal.tsx`** — already using `.glass-overlay` / `.glass-modal` correctly. No change needed.

**Layout:**
- [x] **`AppShell.tsx`** — no glass classes present. Already correct.
- [x] **`Sidebar.tsx`** — all `hover:bg-white/5` → `hover:bg-[var(--raised-h)]`, active conversation `bg-white/5` → `bg-[var(--raised-h)]`.
- [x] **`SystemFooter.tsx`** — `glass-subtle` → `bg-[var(--floor)] border-t border-[var(--border)]`.
- [x] **`MobileHeader.tsx`** — `glass-subtle` → `bg-[var(--surface)] border-b border-[var(--border)]`. `hover:bg-white/5` → `hover:bg-[var(--raised-h)]`.
- [x] **`BottomNav.tsx`** — `glass-strong` → `bg-[var(--surface)] border-t border-[var(--border)]`.

**Chat:**
- [x] **`ChatWindow.tsx`** — `glass-strong shadow-glass` removed from chat panel wrapper.
- [x] **`MessageList.tsx`** — streaming + typing bubbles: `glass-subtle rounded-xl` → `.msg-ai`. Inner prose → `.message-content`.
- [x] **`MessageInput.tsx`** — `glass` → `bg-[var(--raised)]`. `bg-white/10` → `bg-[var(--raised-h)]`.
- [x] **`Message.tsx`** — AI bubble → `.msg-ai`, user bubble → `.msg-user`. Inner prose → `.message-content`.
- [x] **`DocumentBar.tsx`** — all `white/X` opacity classes replaced with `--t3/t4/border/blue/green` tokens.
- [x] **`DevModeOverlay.tsx`** — `glass-subtle` → `bg-[var(--surface-2)] border border-[var(--border)]`.

**Documents:**
- [ ] **`UploadZone.tsx`** — still has `.glass`. Drop zone: `bg-[var(--raised)] border border-dashed border-[var(--border-s)]`. Dragover: `border-[var(--blue-br)] bg-[var(--blue-b)]`. (Low priority — UploadZone is largely superseded by UploadModal)
- [x] **`DocumentList.tsx`** — row cards, icon box, Chat button: `glass`/`glass-subtle` → `bg-[var(--raised/raised-h)] border border-[var(--border)]`.

**Other:**
- [x] **`SettingsPanel.tsx`** — all 4 color mode buttons: `glass-subtle` → `bg-[var(--raised)] border-[var(--border)] text-[var(--t2)]`.
- [ ] **`LoginPage.tsx`** — uses `GlassCard variant="strong"` which now correctly renders `bg-[var(--surface-2)] border border-[var(--border-s)]` via the fixed GlassCard. No further change needed unless visual polish is wanted.

---

#### Phase F3: Layout Shell Polish

- [ ] **`AppShell.tsx`** — sidebar width transition: `width 0.22s cubic-bezier(0.4,0,0.2,1)`, `224px ↔ 56px`. Collapsed: nav labels `opacity: 0 width: 0 overflow: hidden`, icons stay centered.
- [ ] **`Sidebar.tsx`** — section category labels (`LIBRARY`, `COLLECTIONS`) at `10px/700/uppercase/0.08em letter-spacing/var(--t4)`. Dividers: `1px solid var(--border)`. Collections list with color dots (stub entries until F4 wires real data).
- [ ] **`SystemFooter.tsx`** — finalize stat layout: NVMe / HDD / CPU / GPU. Each stat: label `var(--t4)` + value `var(--fm) var(--t2)` + `.prog-bar`. Color threshold on fill: `<65%` blue, `65–85%` amber, `>85%` red.

---

#### Phase F4: Library View + Collections

Full spec in `frontend_design_vision.md` → Library View section.

**Backend — Collections API**
- [ ] Add `collections` table to schema: `(id SERIAL PK, collection_id VARCHAR UNIQUE, user_id INT FK, name VARCHAR, color VARCHAR, created_at TIMESTAMP)`. Add migration `004_collections.sql`.
- [ ] Add `collection_id VARCHAR` nullable FK column to `documents` table. Migration `004`.
- [ ] `GET /api/collections` — list all collections for current user, include `document_count` via COUNT join
- [ ] `POST /api/collections` — create collection `{ name, color }`. Auto-generate `collection_id`. Return full object.
- [ ] `PUT /api/collections/{collection_id}` — rename or recolor
- [ ] `DELETE /api/collections/{collection_id}` — delete collection, set `collection_id = NULL` on all its documents (don't delete docs)
- [ ] `POST /api/collections/{collection_id}/documents` — assign documents `{ document_ids: list[str] }` to collection. Batch update.
- [ ] `DELETE /api/collections/{collection_id}/documents/{document_id}` — remove single doc from collection (sets `collection_id = NULL`)
- [ ] Update `GET /api/documents` — add optional `collection_id` query param to filter. Include `collection_id` + `collection_name` + `collection_color` in each document row response.
- [ ] Update `DocumentOut` model in `models/documents.py` — add `collection_id`, `collection_name`, `collection_color` fields (all nullable)

**Frontend — Layout shell**
- [ ] Rebuild the documents tab as a two-pane layout inside `.panel`:
  - Left pane: fixed `210px`, `background: var(--surface-2)`, right border `1px solid var(--border)`, full panel height
  - Right pane: `flex: 1`, holds header + filter tabs + file table
- [ ] Left pane header: "Library" label (`13px/600/--fd`) + `+` button to create collection (opens inline name+color picker, not a modal)

**Frontend — Collection sidebar (left pane)**
- [ ] Fetch `GET /api/collections` on mount, store in local state alongside a synthetic "All Files" entry
- [ ] Render each collection as a nav row: `7×7px` square dot (`border-radius: 2px`, collection color) + collection name + document count badge
- [ ] "All Files" row is always first, selected by default
- [ ] Active collection row: `background: var(--raised-a)`, `color: var(--t1)`. Inactive: `color: var(--t3)`, hover `var(--raised-h)`
- [ ] Clicking a collection filters the file table to that collection only (client-side filter if all docs loaded, or pass `collection_id` to API if paginated)
- [ ] Inline create: clicking `+` appends an editable row at the bottom of the list with a color swatch strip (6 preset colors: blue, green, amber, red, purple, slate) and a name input. Enter to confirm, Escape to cancel. POST on confirm.
- [ ] Right-click or `•••` on a collection row: rename / delete options. Delete shows inline "Remove collection? Documents will be kept." confirm.

**Frontend — File table (right pane)**
- [ ] Header row: page title "Library" (`15px/--fd/var(--wd)`) + subtitle showing count, search input (right side), "Import" button → upload modal
- [ ] Filter tab strip below header: All Files / PDF / Markdown / Web. Tabs use `.rpanel-tab` pattern. Active tab filters table.
- [ ] Column header row using `.col-header`: Name · Collection · Added · Size · (blank for actions)
- [ ] Rebuild each document row as `.trow` with `grid-template-columns: 1fr 140px 100px 70px 48px`:
  - **Name cell**: `FileTypeBadge` (28×28px, type-colored, mono label) + filename (`13px/500/--t1`) + processing status badge if not complete
  - **Collection cell**: colored `7×7px` dot + collection name (`12px/--t2`), or "—" (`--t4`) if unassigned
  - **Added cell**: relative date (`12px/--t3`, e.g. "3 days ago")
  - **Size cell**: file size in mono (`12px/--fm/--t3`)
  - **Actions cell**: `•••` icon button → dropdown: "Move to collection", "Chat", "Delete"
- [ ] Selected row: `background: var(--raised-a)` + `box-shadow: inset 2px 0 0 var(--blue)`
- [ ] Empty state (no docs): centered upload icon + "No documents yet" + "Import your first document" primary button
- [ ] Empty state (collection has no docs): "No documents in this collection" + "Import" button

**Frontend — FileTypeBadge component**
- [ ] Create `components/library/FileTypeBadge.tsx`: `28×28px`, `border-radius: 7px`, centered label
  - PDF: `bg: var(--red-a)`, `border: 1px solid var(--red-br)`, `color: var(--red)`, label "PDF"
  - MD / TXT: `bg: var(--blue-a)`, `border: 1px solid var(--blue-br)`, `color: var(--blue)`, label "MD" / "TXT"
  - Web: `bg: var(--purple-a)`, `border: 1px solid var(--purple-br)`, `color: var(--purple)`, label "WEB"
  - Video: `bg: var(--amber-a)`, `border: 1px solid var(--amber-br)`, `color: var(--amber)`, label "VID"
  - Font: `var(--fm)`, `8.5px`, `700`

**Frontend — Upload modal (4-stage)**
- [ ] Replace current `UploadZone` flat zone with a proper modal triggered by the "Import" button
- [ ] Modal overlay: `background: rgba(7,7,9,0.72)`, `backdrop-filter: blur(8px)`. Modal card: `background: var(--surface-2)`, `border-radius: 20px`, `box-shadow: var(--panel-shadow)`, `width: 520px`
- [ ] Modal header: "Import Documents" title + 4 small progress bars (3px height, fills blue as stages advance) + × close button
- [ ] **Stage 1 — Drop**: dashed dropzone (`border: 1.5px dashed var(--border-s)`, highlights `var(--blue-br)` on dragover) + "or paste a URL" input below + format pills (PDF / MD / TXT / DOCX / Web / Video)
- [ ] **Stage 2 — Configure**: file list with `FileTypeBadge` + filename + × remove per file. Below: "Save to collection" picker (inline color-dot buttons, one per collection + "No collection"). Three toggle rows using `.toggle`: "Sentence-aware chunking" (on by default), "Auto-tag", "Generate summary". "Start Import" primary button.
- [ ] **Stage 3 — Processing**: per-file row: `FileTypeBadge` + filename + animated progress bar + phase label (`Parsing → Chunking → Embedding`) + mono percentage. Spinner → green check on complete. No close/back while processing.
- [ ] **Stage 4 — Done**: green check circle (32px, `var(--green)`). "Import complete" heading. File list with chunk counts in mono. "View in Library" primary button closes modal + scrolls to new docs. "Import more" ghost button resets to Stage 1.
- [ ] Wire Stage 3 to existing `GET /api/documents/progress/active` polling (same pattern as current `DocumentList`)

#### Phase F5: Chat View Update

Message anatomy classes are now defined in globals.css (`.msg-user`, `.msg-ai`) — components just need to apply them.

- [ ] **`Message.tsx`** — wire `.msg-user` and `.msg-ai` classes (covered in F2 above). Verify asymmetric border-radius: AI `4px 13px 13px 13px`, user `13px 13px 4px 13px`.
- [ ] **Chat header** — add model status indicator: `6px` green pulse dot + model name in `var(--fm)` + tier badge. Sits in the panel header row alongside the "Chat" title.
- [ ] **Suggestion pills** — 3–4 `.pill` buttons above `MessageInput`, adapt to context: no docs → generic ("Summarize my docs", "Quiz me on…"), docs in scope → "Summarize all", "Find contradictions", "Key takeaways", research mode → "Key findings", "Compare sources". Click pre-fills textarea.
- [ ] **Quote block style** — add to `message-content` in globals.css: `blockquote { border-left: 2px solid var(--blue); padding-left: 12px; color: var(--t2); font-style: italic; margin: 0.5rem 0; }`
- [ ] **`ScopeBar.tsx`** — verify pills use `.pill` / `.pill.on` classes and collection color dots are threaded through from document metadata.

---

#### Phase F6: System Panel

- [ ] **`ArcGauge` component** — `components/system/ArcGauge.tsx`. Pure SVG half-circle. Two `<path>` elements: track `rgba(128,128,128,0.12)`, fill `stroke-dasharray` driven by `(percent/100) * circumference`. Color: `<60%` `var(--blue)`, `60–80%` `var(--amber)`, `>80%` `var(--red)`. Props: `value`, `max`, `size`.
- [ ] **`Sparkline` component** — `components/system/Sparkline.tsx`. Pure SVG `<polyline>`. Accept `values: number[]`, normalize to SVG height, `1.5px` colored stroke, no axes, no fill. Props: `values`, `color`, `width`, `height`.
- [ ] **`SystemPanel.tsx`** — rebuild using new components. Sections: Active Model (name `var(--fm)` + Tok/s + TTFT + `<Sparkline>`) · GPU (`<ArcGauge>` + VRAM `.prog-bar` + temp `.prog-bar`) · System RAM (total mono + bar + Ollama/Qdrant/PG breakdown) · Context Window (token count + bar + 4 mini stat cards: System / Docs / History / Buffer) · CPU (percentage + `<Sparkline>`).
- [ ] **Mini stat card** — `48px` wide, `background: var(--raised)`, `border: 1px solid var(--border)`, `border-radius: 6px`. Label `10px/--t4/uppercase`, value `12px/--fm/--t1`.
- [ ] **Backend: `GET /api/system/resources`** — not yet implemented. Returns live CPU %, GPU VRAM used/total/temp, RAM used/total, per-process RAM (Ollama, Qdrant, PG). Frontend polls every 10s.

---

#### Phase F7: Animation Polish ✓ Mostly Done (keyframes updated in F1)
- [x] `fadeUp`: `translateY 6px→0`, `0.25s cubic-bezier(0.4,0,0.2,1)`
- [x] `blink` typing indicator: `opacity 0.2→1→0.2`, `1.2s`, staggered delays (replaces old `bounce-dot`)
- [x] `shimmerPulse`: `opacity 0.5→1→0.5`, `2s` — used on running/scraping status dots
- [x] `scaleIn`: `scale 0.97→1`, `0.18s` — modal open, dropdown appear
- [ ] **List entry stagger** — apply `animationDelay: index * 0.03s` on document rows, conversation list items, and collection nav rows. Add `.animate-fade-up` class to each row on mount/filter-change.
- [ ] **Audit `linear` / `ease` transitions** — grep components for `transition.*linear` or `duration` without explicit easing. Replace with `cubic-bezier(0.4,0,0.2,1)` equivalents. Check: `MessageInput` send button, `ScopeBar` pills, `DocumentBar` shutter.

---

### Chat: Other Modes

- [ ] **Start chat from document** — see "Priority 1: Document Chat" section above.
- [ ] **`contextBudget` hardcoded to 4096** — `chat.store.ts` has `contextBudget: 4096`. Backend
  uses 8192. Fix to 8192 or fetch from backend `context_debug` SSE event (already emitted).

### Chat: UX Polish

- [ ] **Suggestion pills** — no recommendation prompts above the input. Add 3–4 clickable pill
  buttons above `MessageInput` that pre-fill the textarea on click. Suggestions can be static
  (e.g. "Summarize my documents", "Quiz me on…") or context-aware based on attached documents.
- [ ] **Token flush throttle** — `appendStreamToken` in `chat.store.ts` fires a React state update
  per token, causing a re-render on every SSE chunk. Add a ref-based buffer flushed every 50ms
  via `setInterval` in `useSSEChat`, batch tokens before calling store action.
- [ ] **Auto-scroll only when at bottom** — `MessageList.tsx` always calls `scrollIntoView` on
  every token. Add scroll position tracking: only auto-scroll if user is within ~100px of bottom.
- [ ] **`promotion_suggestion` handling** — `StreamDone` type in `types/index.ts` doesn't include
  `promotion_suggestion`. Add it, handle the field in `useSSEChat`'s `done` branch, and create
  `PromotionCard.tsx` that renders below the assistant message (never inline).
- [ ] **Summarization boundary indicator** — when `will_summarize` is signalled by the backend
  `status` SSE event, show a subtle "Older messages summarized" divider in `MessageList`.
- [ ] **Message list virtualization** — long conversations will be slow. Add
  `@tanstack/react-virtual` to `MessageList` before it becomes a real issue.

### Documents Tab

*Library view rebuild and collections are tracked in Phase F4 above. Items below are functional bugs/gaps independent of the redesign.*

- [ ] **URL ingestion UI** — Stage 1 of the F4 upload modal includes a URL input. This is blocked on Crawl4AI backend completing real ingestion (see Web Scraping section).
- [ ] **Video file support** — `accept=".pdf,.txt,.md,.docx"` excludes video. Add video MIME types to the F4 upload modal once Faster-Whisper pipeline is wired backend-side.
- [ ] **Delete confirmation** — delete fires immediately with no confirmation. Add inline confirm state per row in the new `.trow` layout: first click shows "Delete?" confirm + cancel, second click executes. Wire to `DELETE /api/documents/{id}`.
- [ ] **Search debounce edge cases** — current search uses `indexOf` and only filters uploaded items, not processing items. Fix in F4 rebuild: filter both lists, handle empty query (show all), escape regex special chars.

### Web Scraping Integration

- [x] **Crawl4AI Docker sidecar** — `unclecode/crawl4ai:latest` added to `docker-compose.yml`. Backend calls `http://crawl4ai:11235/crawl` via httpx. No Python package needed.
- [x] **`POST /api/documents/url` wired to Crawl4AI** — endpoint exists, calls Crawl4AI, returns raw markdown response. Not real ingestion — see bug above.
- [ ] **Validate Crawl4AI response shape** — add debug endpoint or log raw payload for article/docs/YouTube URLs. Confirm whether `markdown` is always a string or sometimes `{ raw_markdown, ... }`. Do this before writing the ingestion pipeline.
- [ ] **Complete URL ingestion backend** — after shape confirmed: add `BackgroundTasks` + DB INSERT, call `_process_document`, return `document_id`. Extract crawl logic into `core/crawler.py` as `scrape_url(url) -> str`.
- [ ] **Frontend: URL ingestion UX** — loading state on "Ingest URL" button, error feedback card (matches file failed style), clear input on success, integrate `onUploadStart`/`onUploadComplete` so URL docs appear in the processing list with the same progress bar treatment. Add Enter key submit. Remove `urlIngestionResult` debug display.
- [ ] **Frontend: URL zone design** — merge tab strip + content into a single glass card (tabs as header, content below). Remove `cursor-pointer` from outer div. URL icon (Globe) in document list for web-sourced docs.
- [ ] **Backend: SearXNG Docker sidecar + client** — add SearXNG to `docker-compose.yml` (same pattern as Crawl4AI). Add `search(query) -> [urls]` to `core/crawler.py`. Read `SEARXNG_URL` from env; fall back to SerpAPI if set, skip if neither configured.
- [ ] **Frontend: research tab URL/topic input** — Research tab is a stub. Add topic text input +
  "Research" button that POSTs to `POST /api/research`. Show progress via WebSocket
  (`WS /ws/research/{id}`). Display synthesis on completion.

### Other Tabs (Stubs)

- [ ] **Quizzes tab** — stub. Needs quiz generation form, `QuizCard`, scoring, results view,
  spaced repetition queue.
- [ ] **Knowledge Graph tab** — stub. Needs D3 force-directed graph, node click → definition panel,
  type filtering.
- [ ] **Settings tab** — stub. At minimum: model selection, RAG top-K setting, clear conversation
  history option.

### Remaining Recommendations

- [ ] **Ephemeral/persistent indicator in sidebar** — per spec: muted dot for ephemeral, blue dot
  for persistent. Currently no visual distinction between conversation tiers.
- [ ] **Empty state for chat** — when no conversation is selected, show a landing with suggested
  prompts or a "New conversation" CTA instead of a blank panel.
- [ ] **Mobile layout** — sidebar is always visible on narrow screens. Add a hamburger toggle
  and slide-in drawer for mobile.
- [ ] **Error boundaries** — no React error boundaries. A crash in one tab shouldn't take down
  the whole shell.
- [ ] **Toast notifications** — no feedback on document delete, upload errors, or API failures.
  Add a lightweight toast system (e.g. `sonner`).

---

## Infrastructure

- [ ] **Full Docker Compose** — current compose has 5 services (postgres, ollama, init-ollama, qdrant, backend).
  Missing: Redis, Celery worker, Celery beat, Nginx, frontend container.
- [ ] **Nginx config** — `nginx.conf` needs SSE-specific config: `proxy_buffering off`,
  `proxy_cache off`, `chunked_transfer_encoding on` for `/api/chat`.
- [ ] **Volume mounts** — hot storage (`/mnt/data`) and bulk storage (`/mnt/storage`) paths need to
  be properly mounted in compose. Currently not environment-variable driven.
- [ ] **`.env.example`** — update with all variables added since initial setup (JWT_SECRET_KEY,
  RAG_THRESHOLD, etc.).

---

## Recommended Improvements (My Additions)

- [x] **Hybrid BM25 + vector search (RRF)** — implemented in `core/rag.py`.
- [ ] **Insecure default secrets** — `jwt_secret_key` and `seed_admin_password` have known default
  values in `config.py`. Add a startup warning in `main.py` lifespan if either matches the default.
- [ ] **CORS too permissive** — `allow_methods=["*"]` and `allow_headers=["*"]` in `main.py`.
  Fine for local dev; tighten to specific methods/headers before any non-localhost exposure.
- [ ] **Context window display broken in three ways** — (1) `contextBudget: 4096` hardcoded in `chat.store.ts` but backend uses 8192; `context_debug` SSE event sends `budget` but `useSSEChat` never reads it — add `setContextBudget` to store and wire it. (2) `context_debug` tokens are held in `pendingContextTokens` and only committed to the store on `done` — apply them immediately when the event fires so the fill updates as soon as the request starts, not after full generation. (3) `conversations.token_count` is maintained in the DB via `save_message()` but never returned by the conversations list API — add it to `ConversationOut` and pre-populate `contextTokens[convId]` on conversation load so fill is visible before any message is sent.
- [ ] **`token_count` drift** — `save_message` counts only raw content tokens but `count_tokens()` adds 4 tokens overhead per message. Cached `token_count` drifts low over time, causing the fast path to load all history when it may be over budget. Fix: add the 4-token overhead in `save_message`.
- [ ] **`score_type` not forwarded in done event** — `chat.py` builds `rag_sources` for the SSE `done` event but omits `score_type`. Add it so the frontend can label hybrid vs vector scores differently.
- [ ] **Summarization blocks the next message** — `_generate_and_cache_summary()` in `context.py`
  runs in the hot path of the user's next request. Fire it as a background task after the previous
  assistant response completes instead.
- [ ] **Chunk deduplication in RAG results** — before returning sources, filter out chunks with
  cosine similarity > 0.95 to each other. Prevents near-identical excerpts filling the context.
- [ ] **Structured logging with request_id** — every log line in the chat pipeline should carry
  `request_id`, `conversation_id`, `latency_ms`, `tier_used`. Currently missing from most log calls.
- [ ] **Conversation title generation** — new conversations have no title beyond "New Conversation".
  After the first assistant response, run a quick Tier 1 call (3–5 words) to generate a title.
- [ ] **Document re-ingestion** — no way to re-process a document that errored. Add
  `POST /api/documents/{id}/retry` that resets status to `pending` and re-queues the task.
- [ ] **`get_current_user` DB round-trip on every request** — `security.py` fetches the full user
  row from Postgres on every authenticated request. For now this is fine; once load increases,
  cache the user row in the JWT payload or a short-lived Redis key.
