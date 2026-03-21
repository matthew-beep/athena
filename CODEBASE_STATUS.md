# Athena — Codebase Status
## 2026-03-21

---

## Codebase Metrics

| Metric | Value |
|---|---|
| Backend Python LOC | ~2,500 |
| Frontend TypeScript/TSX LOC | ~3,800 |
| Total Code LOC | ~6,300 |
| Backend Python files | 26 |
| Frontend TS/TSX files | 57 |
| API endpoints | 30 |
| Database tables | 8 |

### Backend File Breakdown

| File | Lines | Notes |
|---|---|---|
| `api/chat.py` | ~390 | SSE streaming, conv management, doc attach/detach/batch |
| `api/documents.py` | ~300 | Upload, ingestion, progress, delete, conversations |
| `api/collections.py` | ~175 | Fully complete — 6 endpoints, Pydantic models, response_model |
| `api/system.py` | ~85 | Health, resources, models |
| `api/auth.py` | ~29 | Login, /me |
| `api/research.py` | ~20 | Stub |
| `api/quizzes.py` | ~20 | Stub |
| `api/graph.py` | ~20 | Stub |
| `core/context.py` | ~336 | Token budget, summarization, history |
| `core/rag.py` | ~272 | BM25 + vector hybrid search, RRF |
| `core/ingestion.py` | ~209 | Chunking, embedding, Qdrant upsert |
| `core/security.py` | ~65 | JWT auth |
| `core/bm25.py` | ~55 | Per-document BM25 index cache |
| `db/qdrant.py` | ~95 | httpx Qdrant REST client |
| `db/postgres.py` | ~60 | asyncpg pool + query helpers |
| `main.py` | ~94 | FastAPI app, lifespan, admin seed |
| `config.py` | ~58 | Pydantic settings |
| `models/chat.py` | ~50 | ChatRequest, ConversationOut, MessageOut |
| `models/auth.py` | ~18 | Token, UserOut |
| `models/system.py` | ~21 | ResourceStats, HealthResponse |
| `models/collections.py` | ~60 | CollectionNameRequest, CollectionDocumentsRequest, CollectionItem, CollectionsListResponse, CollectionMutateResponse, CollectionDocumentsMutateResponse |

---

## What Was Worked On This Session (2026-03-21)

### Upload Modal — API Wiring

**`frontend/api/client.ts` — `postForm` method added:**
- New method sends `FormData` without setting `Content-Type` — browser sets `multipart/form-data; boundary=...` automatically
- Auth header still applied from `useAuthStore.getState().token`
- Error handling via shared `handleResponse` (401 → logout, non-2xx → throw)
- Why this was needed: existing `apiClient.post` hardcodes `Content-Type: application/json`, which overrides the boundary and breaks multipart parsing

**`backend/app/api/documents.py` — `collection_id` form field:**
- Added `from fastapi import Form` to imports
- Added `collection_id: str | None = Form(None)` param to `upload_document`
- Updated INSERT to include `collection_id` column, passes `collection_id or None` to ensure empty string becomes NULL in Postgres

**`frontend/components/documents/UploadModal.tsx` — two-step workaround removed:**
- `runImportFromQueue` now appends `collection_id` to FormData before upload (only if set)
- Second API call `POST /api/collections/{id}/documents` removed — collection assignment is now atomic
- Switched from raw `fetch` to `apiClient.postForm` — auth handled centrally, manual `useAuthStore` import removed
- `assignedToCollection` derived from `!!(options.collectionId && documentIds.length > 0)` — no longer depends on a second API call succeeding

### Collection Colors — Added to TODO

- Reopened old "decided no color field" closed bug
- Added 5-item "Collection Colors" section to Next Up in TODO.md covering: DB migration, Pydantic model updates, PUT endpoint recolor, frontend `CollectionItem` type, remove static `COLLECTION_COLORS` array

### Glass Audit (Phase F2) — Completed (carried from 2026-03-21 session)

All components migrated off `.glass-subtle`/`.glass-strong`/`.glass`:
- `GlassCard.tsx`, `GlassButton.tsx`, `ChatWindow.tsx`, `MessageList.tsx`, `MessageInput.tsx`
- `Message.tsx`, `DevModeOverlay.tsx`, `DocumentBar.tsx`, `Sidebar.tsx`
- `SystemFooter.tsx`, `MobileHeader.tsx`, `BottomNav.tsx`, `DocumentList.tsx`, `SettingsPanel.tsx`

### Route Ordering Fix (carried from 2026-03-21 session)

- `GET /api/documents/progress/active` moved above `GET /api/documents/{document_id}/progress` in `documents.py` — FastAPI was matching `/progress/active` with `document_id="progress"` and returning 404

---

## What Was Worked On This Session (2026-03-16)

### Collections API — Now Fully Correct

**`api/collections.py` — all 6 endpoints hardened:**
- Fixed `PUT /{collection_id}` — was missing `body: dict` param entirely; `name` was undefined, would `NameError` on any rename call. Rewritten with `CollectionNameRequest` body.
- Fixed `POST /{collection_id}/documents` — was missing `@` decorator (route never registered with FastAPI); was using wrong SQL (`INSERT INTO collection_documents` join table doesn't exist); `document_id` undefined. Replaced with correct `UPDATE documents SET collection_id = $1 WHERE document_id = ANY($2) AND user_id = $3`.
- Fixed `DELETE /{collection_id}/documents` — WHERE clause missing `AND collection_id = $3`. Without it, passing doc IDs from a different collection would silently unassign them from the wrong collection.
- Fixed `DELETE /{collection_id}` — documents UPDATE was missing `AND user_id = $2`, allowing a crafted request to NULL docs from any collection by ID.
- Added `_get_collection(collection_id, user_id)` private helper — used by both document endpoints for 404 checking before mutation.
- Added `_parse_update_count(status)` helper — parses asyncpg `"UPDATE 3"` string to int for `updated` field in responses.

**`models/collections.py` — Pydantic models wired throughout:**
- Merged `CreateCollectionRequest` + `UpdateCollectionRequest` into single `CollectionNameRequest` (were identical).
- All endpoints now use `response_model=` on decorators.
- All request bodies use Pydantic models — no more `body: dict`.
- Create endpoint uses `RETURNING collection_id, name, created_at` to get `created_at` from DB without a second query.
- Decided: no `color` field — removed from spec and schema.

### Upload Modal — Stage 1 Styled Per Spec

**`components/ui/Modal.tsx`:**
- Default width: `max-w-[520px]`
- Animation: scale `0.95 → 0.97`, easing `cubic-bezier(0.4,0,0.2,1)`
- Header: padding `16px 20px 14px`, `align-items: flex-start` (title has two lines)
- Close button: now has `border: 1px solid var(--border)`, `background: var(--raised)`, `width/height: 28px`, `border-radius: 8px`
- Footer: padding `12px 20px`

**`components/documents/UploadModal.tsx` — Stage 1 fully implemented:**
- Dynamic stage title (`"Add Files"` / `"Save to Collection"` / `"Indexing…"` / `"Import Complete"`) with progress dots below
- Drop zone: flex row layout — icon box left, label + format pills center, Browse button right. `isDragOver` state for blue border/tint.
- Format pills: monospace font, `border-radius: 4px`, values PDF/MD/DOCX/TXT
- URL input: inset `<Link2>` icon absolutely positioned at left 10px
- File queue empty state: centered "No files added yet"
- File queue rows: full cards with colored `TypeBadge` (PDF=red, MD=blue, DOC=purple, TXT=green), filename, file size (`formatSize()`), per-item remove button with staggered `animate-fade-up`
- Footer: left side = dynamic status text, Next disabled (`opacity: 0.45, pointerEvents: none`) when queue empty, correct labels per stage (Next/Start Import/Close)
- Stages 2 and 3 remain placeholders

**`app/globals.css` — missing utility classes added:**
- `.btn-g` and `.btn-p` — spec aliases for ghost and primary buttons
- `.inp` — input shorthand matching spec exactly
- `.slabel` — section label (10px/700/uppercase/0.08em tracking/`--t4`)
- `.df` — display font utility (`--fd`/800/−0.025em tracking)
- `.glass-modal` box-shadow updated to deeper spec value: `0 24px 60px rgba(0,0,0,0.5)`

### DEPLOYMENT.md Updated
- Two deployment paths: Mac (`docker-compose.mac.yml`) and GPU desktop (`docker-compose.yml`)
- Removed outdated `docker-compose.gpu.yml` reference

---

## What Was Worked On This Session (2026-03-12)

### Critical Bug Fixes
- **`backend/app/main.py`** — added `import httpx`. Model warmup was silently failing every boot with a masked `NameError`.
- **`backend/app/core/rag.py`** — removed `MAX_RRF_SCORE` reference. Was raising `NameError` on every hybrid search request, caught by `except Exception` and returning empty results. RRF scores are already `(0,1)` range — no normalization needed.
- **`backend/app/api/collections.py`** — added `asyncpg.UniqueViolationError` catch to `update_collection`. Rename to duplicate name was returning 500 instead of 409.

### Collections — NOW FULLY COMPLETE (2026-03-12)

**Backend (`api/collections.py`) — 6 endpoints, all working:**
- `GET /api/collections` — list with per-collection document count
- `POST /api/collections` — create, 409 on duplicate name (case-insensitive via unique index)
- `PUT /api/collections/{id}` — rename, 409 on duplicate, 404 if not found
- `DELETE /api/collections/{id}` — nulls all document assignments, then deletes
- `POST /api/collections/{id}/documents` — batch assign documents
- `DELETE /api/collections/{id}/documents` — batch remove documents

**Schema (`sql/schema.sql`):**
- `collections` table: `collection_id`, `user_id`, `name`, `created_at`
- Unique index on `(user_id, LOWER(name))` — enforces case-insensitive name uniqueness per user on both create and rename
- `documents.collection_id` FK with `ON DELETE SET NULL`

**Frontend — all wired:**
- `DocumentSideBar.tsx` — create/rename/delete all call API with `CollectionItem` (has `collection_id`). Refetches on every mutation. Rename uses inline edit with Enter/Esc/blur handling.
- `CollectionsList.tsx` — accepts `CollectionItem[]`, uses `collection_id` for keys and selection. Inline rename input per row with `isEditing` prop. Delete styled red. Document count shown as dim number.
- `DocumentsPanel.tsx` — passes full `CollectionItem[]` to sidebar (not name strings).

**Remaining gaps in Library view (not blocking collections itself):**
- `selectedCollections` filter not wired to `DocumentList` — checking a collection doesn't filter the document list
- `DocumentTypeSelector` tab not wired to `DocumentList` — file type filter has no effect
- "X Documents" in header is a hardcoded string, not a real count
- `docTypes` hardcoded to `["PDF", "TXT", "Markdown"]` — not fetched from backend
- No collection assignment during upload — UploadZone doesn't pass `collection_id`
- Debug red border left in `DocumentList.tsx` (line ~403)
- Duplicate `refetchCollections` call in `DocumentsPanel` (lines 101 and 167)
- `DocumentsPanel.tsx` — loads collections on mount, passes to sidebar, filter state tracked in `selectedCollections[]`.

**Not wired / broken:**
- Collections passed to `CollectionsList` as `string[]` (names only) — `collection_id` is lost, making API calls for rename/delete impossible without a name→id lookup.
- Rename/Delete actions in `CollectionsList` fire `onAction` callback, but `DocumentSideBar` handler only `console.log`s — no API calls made.
- `selectedCollections` filter is tracked in state but never passed to `DocumentList` — filtering has no effect on displayed documents.
- Document assignment to collection — no UI at all; user cannot drag/assign docs to a collection from the document list.
- `DocumentTypeSelector` tab state is tracked but not wired to `DocumentList` filtering.
- "X Documents" count in panel header is hardcoded string, not dynamic.

### Frontend Design System — Structural Glass
- **`frontend/app/globals.css`** — complete rewrite. Replaced HSL token system with Structural Glass design tokens:
  - Slate theme as dark default in `:root` — `[data-theme="light"]` for light mode
  - Floor/surface/elevation tokens: `--floor`, `--surface`, `--surface-2`, `--raised`, `--raised-h`, `--raised-a`
  - Border tokens: `--border`, `--border-s`
  - Text hierarchy: `--t1` through `--t4`
  - Full accent palette with alpha variants: `--blue`, `--blue-a`, `--blue-br`, etc.
  - Document reading surface: `--doc-bg`, `--doc-t`, `--doc-t2`, `--doc-border`, `--doc-label`
  - Font variables: `--font-wordmark` (Cormorant Garamond), `--fd` (Plus Jakarta Sans), `--fb` (Poppins), `--font-ai-msg` (Lora), `--fm` (JetBrains Mono)
  - CSS utility classes: `.panel`, `.nav-item`, `.trow`, `.col-header`, `.pill/.pill.on`, `.btn` variants, `.prog-bar/.prog-fill`, `.status-badge` variants, `.toggle`, `.rpanel-tab`, `.input-field`, `.msg-user/.msg-ai`, `.wordmark`, `.glass-overlay/.glass-modal`
  - Animations: `blink`, `shimmerPulse`, `fadeUp` (6px, 0.25s), `scaleIn` (0.97→1, 0.18s), all `cubic-bezier(0.4,0,0.2,1)`
  - Added custom checkbox `.doc-sidebar-checkbox` and `.tabs/.tab` pill tab pattern
- **`frontend/tailwind.config.ts`** — `border` color updated to `hsl(var(--tw-border))` to avoid naming clash with new rgba `--border` token. `display` font updated to Plus Jakarta Sans.
- **`frontend_design_vision.md`** (new file) — complete UI/design handoff document. Covers Structural Glass aesthetic, all theme tokens, typography system, every component pattern, all views (Library, Research, Chat), motion/animation spec, and do/don't rules.

### Documentation
- **`TODO.md`** — major update: Phase F1 marked complete, F2 rewritten as per-component action list with exact replacement instructions for dead glass classes, F3 renamed to Layout Shell Polish, F4 expanded with full collections + library view breakdown, F5–F7 updated with accurate current state. Documents Tab section deduplicated against F4.

---

## What Was Worked On This Session (2026-03-09)

### URL Ingestion — Identified as Non-Functional
- **`api/documents.py`** — `POST /api/documents/url` calls Crawl4AI and returns the raw response payload. No document record is created, no chunking/embedding occurs, nothing enters Qdrant.
- **`components/documents/UploadZone.tsx`** — treats response as markdown preview only.
- **Crawl4AI response shape unverified** — `markdown` field may be string or object. Needs validation before proper ingestion can be written.

### Context Window Display — Three Bugs Identified
- **`chat.store.ts`** — `contextBudget` hardcoded to `4096`. Backend sends `budget: 8192` in `context_debug` SSE. Store has no `setContextBudget` action.
- **`useSSEChat.ts`** — `context_debug` tokens held until `done` fires; context fill only updates after full generation.
- **`conversations.token_count`** — maintained in DB but never returned by conversations list API. Fill can't show before first message.

---

## Architecture As-Built

### Chat + RAG Pipeline

```
POST /api/chat
    │
    ├─ token check (reject if > 5500 tokens)
    ├─ _get_or_create_conversation() → str
    ├─ _update_title() if still "New Conversation"
    ├─ attach_documents(conversation_id, body.document_ids)  ← first-message flow
    │
    └─ stream_response() [generator]
           │
           ├─ get_conversation_document_ids(conversation_id)
           │
           ├─ [if doc_ids or search_all] retrieve(query, user_id, doc_ids, search_all)
           │       ├─ embed query → nomic-embed-text via Ollama
           │       ├─ find_referenced_document() → fuzzy filename match
           │       ├─ asyncio.gather(qdrant.search(), _bm25_search())
           │       ├─ reciprocal_rank_fusion(vector_hits, bm25_hits)[:top_k]
           │       └─ batch fetch chunk text from document_chunks WHERE user_id = $2
           │
           ├─ build_messages(conversation_id, message, rag_context)
           │       ├─ count tokens, check budget
           │       ├─ get_managed_history() → trim/summarize if over budget
           │       └─ assemble [system, ...history, user]
           │
           ├─ POST ollama /api/chat stream=True → yield SSE token events
           ├─ save_message(user) + save_message(assistant)
           └─ yield SSE done {conversation_id, model, latency_ms, rag_sources}
```

### Document Ingestion Pipeline

```
POST /api/documents/upload (multipart)
    │
    ├─ save file to disk
    ├─ INSERT documents row (status=pending)
    └─ BackgroundTask: _process_document(document_id, user_id, filename, filepath)
           │
           ├─ extract text (pypdf / python-docx / plain text / faster-whisper for video)
           ├─ chunk_text() — sentence-aware, 500-token chunks, ~50-token overlap
           ├─ build BM25 index → INSERT bm25_indexes (chunk_ids, corpus)
           ├─ embed all chunks → nomic-embed-text via Ollama
           ├─ qdrant.upsert_points() — payload: document_id, chunk_id, user_id, filename
           ├─ INSERT document_chunks rows
           └─ UPDATE documents SET processing_status='complete', chunk_count=N
```

### Qdrant Point Payload

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
  "created_at": "2026-03-11T10:00:00Z"
}
```

Text is **not** stored in Qdrant. `chunk_id` bridges back to `document_chunks` in Postgres.

---

## Database Tables (8)

| Table | Purpose |
|---|---|
| `users` | Auth — username, hashed_password |
| `conversations` | Chat sessions — tier, title, token_count, summary, summarized_up_to_id |
| `messages` | Individual messages — role, content, model_used, timestamp, rag_sources JSONB |
| `documents` | Uploaded documents — status, chunk_count, user_id, error_message, collection_id |
| `document_chunks` | Chunks — text, token_count, qdrant_point_id, user_id |
| `conversation_documents` | Junction — scopes documents to conversations |
| `bm25_indexes` | Per-document BM25 corpus — chunk_ids, corpus JSONB |
| `collections` | User-defined document collections — name, color, user_id |

---

## API Endpoints (30 total)

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
| POST | `/api/documents/url` | ⚠️ scraper preview only |
| GET | `/api/documents/{id}` | ✅ |
| GET | `/api/documents/{id}/progress` | ✅ |
| GET | `/api/documents/progress/active` | ✅ bulk active |
| GET | `/api/documents/{id}/conversations` | ✅ |
| DELETE | `/api/documents/{id}` | ✅ |
| GET | `/api/collections` | ✅ with document_count |
| POST | `/api/collections` | ✅ |
| PUT | `/api/collections/{id}` | ✅ rename, 409 on duplicate |
| DELETE | `/api/collections/{id}` | ✅ nulls documents, then deletes |
| POST | `/api/collections/{id}/documents` | ✅ batch assign |
| DELETE | `/api/collections/{id}/documents` | ✅ batch unassign |
| GET | `/api/system/health` | ✅ |
| GET | `/api/system/resources` | ✅ (storage stats return 0) |
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
| 1 | ~~High~~ | ~~`httpx` not imported in `main.py`~~ | ✅ Fixed |
| 2 | ~~High~~ | ~~`MAX_RRF_SCORE` undefined in `rag.py`~~ | ✅ Fixed |
| 3 | Medium | Summarization in hot path — `_generate_and_cache_summary()` blocks the next user request | `core/context.py` |
| 4 | Medium | No Celery/Redis — background processing uses FastAPI `BackgroundTasks`; no retries, no persistence across restarts | `api/documents.py` |
| 5 | Medium | Context window display broken — (a) `contextBudget` hardcoded 4096 in store; (b) `context_debug` tokens held until `done`, not applied immediately; (c) `token_count` never returned by conversations API | `chat.store.ts`, `useSSEChat.ts`, `api/chat.py` |
| 6 | Medium | URL ingestion non-functional — `POST /api/documents/url` returns Crawl4AI raw payload, creates no DB record, nothing enters Qdrant | `api/documents.py`, `UploadZone.tsx` |
| 7 | Medium | Storage stats return 0.0 — `/api/system/resources` NVMe/HDD percentages hardcoded to 0 (Redis cache not yet wired) | `api/system.py` |
| 8 | ~~Medium~~ | ~~`.glass`/`.glass-subtle`/`.glass-strong` class references on multiple components~~ | ✅ Fixed (F2 complete) |
| 9 | Low | Muting docs is UI-only — `mutedIds` in `DocumentBar` never sent to backend | `DocumentBar.tsx` |
| 10 | Low | `GET /api/documents` missing `collection_id` filter param and doesn't return `collection_id`/`collection_name` per row — frontend can't show collection assignment | `api/documents.py` |
| 11 | ~~Low~~ | ~~`POST /api/documents/upload` doesn't accept `collection_id`~~ | ✅ Fixed |
| 12 | Low | `collections` table has no `color` column — collection pills use static index-based color array, colors shift when collections are deleted/reordered | `api/collections.py`, `UploadModal.tsx` |
| 13 | Low | `/progress/active` route was shadowed by `/{document_id}/progress` — FastAPI treated "progress" as a document_id | ✅ Fixed |

---

## Docker Compose — Current vs Target

| Service | Current | Target |
|---|---|---|
| postgres | ✅ Running | ✅ |
| ollama | ✅ Running (GPU passthrough enabled) | ✅ |
| init-ollama | ✅ (pulls qwen3.5:9b + nomic-embed-text) | ✅ |
| qdrant | ✅ Running | ✅ |
| crawl4ai | ✅ Running | ✅ |
| backend | ✅ Running | ✅ |
| redis | ❌ Missing | Phase 2 |
| celery worker | ❌ Missing | Phase 2 |
| celery beat | ❌ Missing | Phase 2 |
| nginx | ❌ Missing | Production only |
| frontend | ❌ Host-only (npm run dev) | Production only |

---

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| Phase 1: Foundation | ~97% | Core chat, RAG, ingestion, auth all working. Missing: Celery/Redis |
| Phase 2: Document Processing | ~25% | URL ingestion non-functional; collections fully wired (collection_id on upload atomic) |
| Phase F1: Design System | ✅ Done | Structural Glass tokens, Slate default, all CSS utility classes |
| Phase F2: Glass Audit | ✅ Done | All 14 components migrated off glass-subtle/glass-strong |
| Phase F3: Layout Shell Polish | 0% | AppShell, Sidebar, SystemFooter need token updates |
| Phase F4: Library View + Collections | 30% | Collections backend fully complete; upload modal stages 1+2 styled + wired; stage 3 wiring, collection colors, documents.py collection filter, library view layout remain |
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
| Markdown rendering | ✅ |
| Source citations (collapsible) | ✅ |
| Tier badge on messages | ✅ |
| Documents tab (upload, staging, progress, delete) | ✅ |
| System footer (live polling) | ✅ |
| Stream abort / stop button | ✅ |
| Document attachment UI (CommandPalette + DocumentBar) | ✅ |
| Search-all globe toggle | ✅ |
| Scope bar (doc chips + search-all pill) | ✅ |
| Pin/attach button on RAG source cards | ✅ |
| Structural Glass token system (globals.css) | ✅ |
| Glass audit (component rewrites) | ✅ F2 complete |
| Library two-pane layout + collections | ❌ F4 pending |
| 4-stage upload modal — Stage 1 | ✅ styled per spec |
| 4-stage upload modal — Stage 2 | ✅ styled + wired (collection picker, runImportFromQueue, collection_id atomic) |
| 4-stage upload modal — Stage 3 | ⚠️ styled shell only — needs importResult wiring + progress polling |
| 4-stage upload modal — Stage 4 | ⚠️ generic banner only — needs per-file outcomes |
| Chat message anatomy update | ❌ F5 pending |
| System panel (ArcGauge, Sparkline) | ❌ F6 pending |
| URL ingestion (real, not preview) | ❌ blocked on Crawl4AI shape validation |
| Context window display (3 bugs) | ❌ |
| Token flush throttle | ❌ |
| Auto-scroll at-bottom detection | ❌ |
| Suggestion pills | ❌ |
| Delete confirmation | ❌ |
| Research tab | ❌ stub |
| Quizzes tab | ❌ stub |
| Knowledge Graph tab | ❌ stub |
| Settings tab | ❌ stub |

---

*Athena · Codebase Status · 2026-03-21*
