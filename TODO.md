# Athena → Virgil — Roadmap

## Where We Are

A well-built RAG chat app with solid foundations: hybrid search (vector + BM25 via ParadeDB), SSE streaming, document management, collections, Celery background processing, JWT auth. The core loop works — upload documents, chat against them, get sourced responses.

What it isn't yet: proactive. It waits to be asked. The jump from "good RAG chat" to "goal-driven OS" happens in the next few milestones.

---

## Phase 3: Chat Refinement ← IN PROGRESS

### Completed
- ~~`isStreaming` scoped per-conversation~~ ✓ — `isStreaming: Record<string, boolean>` keyed by conv ID, all consumers updated
- ~~Custom markdown renderer (AthenaMarkdown)~~ ✓ — streaming + committed paths, inline `[N]` citation chips via `CitationChip.tsx` with hover tooltips
- ~~Chat suggestions end-to-end~~ ✓ — backend `POST /api/chat/suggestions`, per-conv store state, `SuggestionsBar` pills, called after `done` event
- ~~Sidebar conversation list polish~~ ✓ — `SidebarConversationRow` with hover menu, active state, truncated titles

### Remaining

#### 1. Delete Conversation
- [x] **Backend `DELETE /api/chat/conversations/{id}`** — implemented, returns 200 with message
- [x] **Frontend wiring** — implemented, removes from store, clears active if deleted
- [ ] **Remove and recreate DBs** — cascade constraint exists in schema but DB was created from old schema, needs wipe and recreate

#### 2. Rename Conversation
- [ ] **Backend `PATCH /api/chat/conversations/{id}`** — update `title` field. Body: `{ "title": str }`.
- [ ] **Frontend** — inline edit or pencil icon in `SidebarConversationRow`. PATCH on blur/enter, update store.

#### 3. Message Utility Bar
- [ ] **Per-message action bar** — `Message.tsx` has a placeholder `<p>Message Utility Bar</p>`. Implement: copy raw text to clipboard on hover. Clean icon row, no labels.

#### 4. DocumentBar Rework
- [ ] **Reconsider DocumentBar purpose** — currently shows attached docs + mute toggles. Decide: show active sources for selected message, act as scoping tool, or both. Decide before building further.

#### 5. Emit `rag_sources` Before First Token
- [ ] **Backend** — currently `rag_sources` sent in the `done` event. Emit a `sources` SSE event before first token instead. Update `useSSEChat` to handle `sources` event type.

#### 6. Model + System Stats — Move to Conversation Header
- [ ] **Remove stats from footer** — move model info and key system stats to top of conversation view.
- [ ] **Conversation header bar** — active model (tier badge), compact GPU VRAM readout.

**Exit criteria:** Delete conversation works end-to-end, message copy button functional, DocumentBar decision made.

---

## Phase 4: Projects Layer ← NEXT

This is the pivotal milestone. Once Projects exists, the app reframes from "chat tool with documents" to "goal-driven workspace." Collections stay as document folders — a project is a higher-level umbrella that owns documents (individually or whole collections), tasks, surfaces, and a scoped chat.

### Schema + Migration
- [ ] **Add tables** — `projects`, `project_documents`, `project_tasks`, `surfaces`. Add `project_id FK` to `conversations` and `research_sessions`.
- [ ] **Write migration** — `sql/migrations/004_projects.sql`.

### Backend
- [ ] **`api/projects.py`** — full CRUD for projects, project documents, project tasks, surfaces.
- [ ] **Wire `project_id` to conversations** — when chat is opened from a project, `conversation.project_id` is set.
- [ ] **Scoped RAG** — if `conversation.project_id` is set and no explicit document scope, RAG filters to `project_documents` only.
- [ ] **Attach collection to project** — convenience endpoint: `POST /api/projects/{id}/collections/{collection_id}` adds all collection documents to `project_documents` in one shot.
- [ ] **Register router** in `main.py`.

### Frontend
- [ ] **Projects store** — Zustand store for projects list, active project, surfaces.
- [ ] **Project dashboard** — default view (replaces conversation list). Project cards showing goal, surface inbox count, last active.
- [ ] **Project detail** — goal, constraints, attached documents (with collection grouping), surfaces inbox.
- [ ] **Create project flow** — name + goal input. Simple modal.
- [ ] **Attach documents/collections to project** — reuse CommandPalette pattern.

**Exit criteria:** Create a project → attach documents → open scoped chat → RAG only retrieves from project documents.

---

## Auth Refinement

Currently JWT access tokens only — no refresh mechanism, so sessions expire and require re-login.

- [ ] **Add `refresh_tokens` table** — store hashed refresh token, user_id, expires_at, revoked bool. Index on token hash.
- [ ] **Issue refresh token on login** — return both `access_token` (short-lived, 15-30min) and `refresh_token` (long-lived, 7-30 days) from `POST /api/auth/login`.
- [ ] **`POST /api/auth/refresh`** — validate refresh token from DB, issue new access token, rotate refresh token on use, revoke old one.
- [ ] **`POST /api/auth/logout`** — revoke refresh token in DB.
- [ ] **Frontend: refresh token in httpOnly cookie** — access token in memory (Zustand). On 401, auto-call `/api/auth/refresh` and retry original request.
- [ ] **Frontend: silent refresh on app load** — if no access token in memory, attempt refresh before redirecting to login.

---

## Phase 5: Rebrand to Virgil

Do this after Projects lands — rebrand when the app actually feels like what Virgil is supposed to be.

- [ ] **Rename directory and repo** — `athena/` → `virgil/`
- [ ] **Find and replace all "Athena"/"athena"** — backend, frontend, docker-compose, env vars, SQL schema, nginx, package.json, component names (`AthenaMarkdown` → `VirgilMarkdown`, etc.)
- [ ] **Update UI branding** — wordmark, "A" avatars in chat bubbles, page titles, meta tags
- [ ] **Update CLAUDE.md**

---

## Phase 6: Research Pipeline

What makes Virgil genuinely different from every other RAG chat app. Background tasks running against project goals, surfaces coming back with findings.

- [ ] **SearXNG** — self-hosted search. Add to Docker Compose.
- [ ] **5-stage Celery pipeline** — web search → fast filtering (Tier 1) → knowledge base check → deep synthesis (Tier 3, CPU only) → knowledge ingestion + surface creation.
- [ ] **WebSocket progress** — per-stage updates to frontend during research.
- [ ] **Approval flow** — research requires user approval before executing unless `require_approval=False`.
- [ ] **Research scoped to project** — all research sessions have a `project_id`. Findings create surfaces on that project.

---

## Phase 7: Surfaces + Background Tasks

- [ ] **Per-project task scheduling** — dynamic Celery schedules per project task. Types: `research`, `monitor`, `aggregate`.
- [ ] **Surface inbox UI** — list of unread surfaces per project. Dismiss / act / read state transitions.
- [ ] **Surface detail view** — body, source task, metadata.
- [ ] **Celery beat** — add `celery-beat` service to both compose files.

---

## Phase 8: Production Polish

- [ ] **Storage stats** — Celery beat task every 5 min → Redis cache → `GET /api/system/storage` reads cache only.
- [ ] **RAG deduplication** — per-document chunk cap or minimum distance to avoid near-identical chunks in sources.
- [ ] **Normalize RRF scores** — normalize against top result so scores span 0.0–1.0.
- [ ] **Docling** — replace pypdf + python-docx. Unified extraction for PDF, DOCX, PPTX, HTML with built-in OCR.
- [ ] **Video/audio ingestion** — yt-dlp + Faster-Whisper into Celery pipeline. Already stubbed in `ingestion.py`.
- [ ] **Library search + pagination** — `search`, `limit`, `offset` on `GET /api/documents`. Debounced frontend controls.

---

## Bugs / Active Issues

- ~~**Suggestions bar inconsistent**~~ — root cause: CPU-only Ollama on Mac dev environment. Resolves on Linux build with GPU.
- [ ] **Muting docs is UI-only** — `mutedIds` in `DocumentBar` never sent to backend.
- [ ] **Summarization in hot path** — `_generate_and_cache_summary()` can block next request (`core/context.py`). Move to background or add per-conversation lock.
- [ ] **Storage stats return 0** — NVMe/HDD percentages hardcoded to 0 in `GET /api/system/resources`. Needs Redis cache wired.

---

## Completed

~~Docker Compose stack~~ ✓
~~Document upload → chunking → embedding → Qdrant~~ ✓
~~Hybrid search (vector + BM25, RRF fusion)~~ ✓
~~Basic chat with RAG + SSE streaming~~ ✓
~~Conversation history in PostgreSQL~~ ✓
~~Auth (JWT)~~ ✓
~~Collections CRUD (backend + frontend)~~ ✓
~~Upload modal (stages 1–3)~~ ✓
~~URL ingestion via Crawl4AI~~ ✓
~~Background processing via Celery~~ ✓
~~Progress tracking via Redis~~ ✓
~~pg_search migration (ParadeDB BM25)~~ ✓
~~RAG scoring display (hybrid/vector badge + breakdown)~~ ✓
~~Context window management (3 bugs fixed)~~ ✓
~~RAG sources persisting across page reload~~ ✓
~~Stream abort / stop button~~ ✓
~~CSS design system (Structural Glass)~~ ✓
~~`selectedMessageId` per-conversation Record in chat store~~ ✓
~~Custom markdown renderer (AthenaMarkdown) with streaming path~~ ✓
~~Inline `[N]` citation chips (CitationChip) with hover tooltips~~ ✓
~~Chat suggestions — backend endpoint + SuggestionsBar pills~~ ✓
~~`isStreaming` keyed per-conversation~~ ✓
~~Sidebar conversation list polish (SidebarConversationRow)~~ ✓
