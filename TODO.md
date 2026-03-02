# Athena — TODO

Current phase: **Phase 1 / Phase 2 boundary** — basic RAG chat works, document ingestion works,
JWT auth works, SSE streaming works. Everything below is what's missing or broken.

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
- [ ] **Vector dimension mismatch** — `db/qdrant.py` has `VECTOR_SIZE = 768` with a comment saying
  "spec says 384, actual is 768". Verify which dimension `nomic-embed-text` actually produces via
  Ollama, update `VECTOR_SIZE` to match, and correct `CLAUDE.md`. A mismatch silently returns empty
  search results — no error is thrown.
- [ ] **Wrong Ollama model** — current backend uses `llama3.2:3b`. Spec requires `qwen2.5:7b` (Tier 1)
  for all interactive queries. Update `OLLAMA_MODEL` env var and `init-ollama` container.
- [ ] **Naive token chunking** — `ingestion.py` uses a sliding token window with no sentence awareness.
  Mid-sentence splits degrade retrieval quality. Needs sentence-boundary-aware chunking (nltk or spaCy).
- [x] **RAG threshold incompatible with hybrid search** — duplicate of item above; confirmed fixed.
- [ ] **URL ingestion returns 501** — `POST /api/documents/url` is a stub. Crawl4AI not wired up yet.
- [ ] **No deduplication in RAG** — can return near-identical chunks from the same document. Add a
  minimum chunk distance check or a per-document chunk cap before returning sources.

---

## Backend

### Phase 1 Completion

- [ ] **Sentence-aware chunking** — replace naive `chunk_text()` with sentence-boundary-aware splitting.
  Target: 500 tokens per chunk, 50-token overlap, never split mid-sentence.
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

- [ ] **Web URL scraping** — wire Crawl4AI into `POST /api/documents/url`. Background Celery task.
  Returns document_id immediately, processing happens async.
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

Full approach agreed: URL params carry `doc_id`+`filename` as a one-time init hint. Document scope
is stored in `conversation_documents` on the backend — the backend is the source of truth after the
first message. No `mode` field anywhere.

**Flow:**
```
Click "Chat" on document
  → fetch GET /api/chat/conversations?document_id=X
  → 0 results  → navigate to /chat?doc_id=X&filename=paper.pdf (no popover)
  → 1+ results → show inline popover on the button:
                    "summarize this paper"  · 2h ago  [navigate to /chat?conversation_id=X]
                    "what does section 3…"  · yesterday
                    + Start new conversation           [navigate to /chat?doc_id=X&filename=Y]

Chat page mounts with doc_id param
  → show pill immediately: "Chatting with: paper.pdf [×]"
  → user sends first message
  → POST /api/chat { message, document_ids: ["X"] }   ← no conversation_id yet
  → backend: create conv → attach doc → RAG scoped to doc → stream
  → done event returns conversation_id
  → URL → /chat?conversation_id=conv_abc              ← drop doc_id + filename
  → subsequent messages: { message, conversation_id } — no document_ids needed
```

**Backend:**
- [ ] **`GET /api/chat/conversations?document_id=`** — new route returning the 3 most recent
  conversations that have this document attached for the current user. Query:
  `SELECT c.conversation_id, c.title, c.last_active FROM conversations c JOIN conversation_documents cd ... WHERE cd.document_id = $1 AND c.user_id = $2 ORDER BY c.last_active DESC LIMIT 3`.
  Must be defined before the `/{conversation_id}/documents` parameterised route.
- [ ] **Add `document_ids` to `ChatRequest`** — add `document_ids: list[str] | None = None` to
  `models/chat.py`. In `api/chat.py`, after `_get_or_create_conversation` and before `stream_response`
  is defined, call `await attach_documents(conversation_id, body.document_ids)` if set. This ensures
  `get_conversation_document_ids()` inside the generator sees the attached doc on the very first message.

**Frontend:**
- [ ] **DocumentList "Chat" button — fetch + popover** — replace the current `<Link>` with a button.
  On click: fetch `GET /api/chat/conversations?document_id={doc.id}`. If 0 results → navigate
  immediately (`router.push('/chat?doc_id=X&filename=Y')`). If 1+ results → show a small inline
  popover listing existing conversations (each navigates to `/chat?conversation_id=X`) plus a
  "+ Start new conversation" option. Popover closes on outside click. Only show Chat button for
  docs with `processing_status === 'complete'`.
- [ ] **Chat page: Suspense + URL param reading** — wrap `chat/page.tsx` in `<Suspense>`. Create
  inner client component that reads `doc_id`, `filename`, and `conversation_id` via `useSearchParams()`.
  Pass `{ docId, filename }` as props to `ChatWindow` when present. Load existing conversation on
  mount when `conversation_id` param is present.
- [ ] **Scope pill above MessageInput** — when `docId` prop is set (pre-first-message), show pill:
  `"Chatting with: paper.pdf [×]"`. × clears pending doc state and calls `router.replace('/chat')`.
  When a conversation is loaded via `conversation_id` param, fetch `GET /api/chat/{id}/documents`
  and show the same pill for attached docs; × calls `DELETE /api/chat/{id}/documents/{doc_id}` then
  refetches.
- [ ] **`useSSEChat` sends `document_ids` on first message** — add optional `documentIds?: string[]`
  param to `sendMessage`. Include in POST body only when `isNewConversation` and `documentIds` is set.
  On `done` event for a new conversation, call `router.replace('/chat?conversation_id=' + realId)`
  to drop the `doc_id`/`filename` params. Subsequent messages send only `{ message, conversation_id }`.

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

### Chat: Stream Abort (Stop Button)

- [ ] **`AbortController` in `useSSEChat`** — add `abortRef = useRef<AbortController | null>(null)`.
  Create a new controller before each `fetch`, store it in ref, pass `signal` to `postStream`.
  On `done`/`error` events, set ref to null.
- [ ] **`postStream` signal parameter** — `api/client.ts:postStream` doesn't accept `AbortSignal`.
  Add optional `signal?: AbortSignal` param and pass it to `fetch`.
- [ ] **Wire Square button in `MessageInput`** — `Square` icon is imported and shown during
  streaming but `handleSend` is disabled — no stop action exists. Add `onStop` prop, call
  `abortRef.current?.abort()` from the hook, expose it via `useSSEChat` return value.
- [ ] **Handle abort in stream loop** — catch `AbortError` in `useSSEChat` and set `isStreaming`
  to false without showing an error message to the user.

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
- [ ] **Search all toggle in chat UI** — globe icon button near the input or scope bar. Active state
  reflects `conversationSearchAll[activeConversationId]`. Disabled when documents are already attached
  (scoped takes priority — no point searching everything when scope is already set).
- [ ] **"Attach" button on source cards in `SourcesPanel`** — when a message has `rag_sources`,
  each source card gets a small pin/attach icon. On click: call `POST /api/chat/{conv_id}/documents/{doc_id}`,
  update `conversationDocuments` in store, set `conversationSearchAll[convId] = false`. Show a
  brief confirmation (e.g. filename chip appears in the scope bar).
- [ ] **Scope bar above message input** — shows the current conversation's retrieval context at a
  glance. Three states:
  - No documents, search_all off → nothing shown (general chat)
  - `search_all` on → "Searching all documents" pill with globe icon and × to disable
  - Documents attached → one chip per document with × to detach each
  Attaching a document from a source card automatically transitions from search-all pill to document chips.
- [ ] **`conversationDocuments` in store** — `Record<string, ConversationDocument[]>` keyed by
  `conversation_id`. Load via `GET /api/chat/{conv_id}/documents` when switching conversations.
  Add `setConversationDocuments`, `addConversationDocument`, `removeConversationDocument` actions.

### Chat: Document Attachment Sidebar + Palette (Existing Conversations)

For managing document scope inside an open conversation. Distinct from "start chat from document"
(Priority 1) — this is for attaching/detaching documents while already in a conversation.

**API calls for this entire flow:**
```
On sidebar mount:   GET  /api/chat/{conv_id}/documents        ← what's currently attached
On palette open:    GET  /api/documents                       ← full library, fetched once
On keystroke:       nothing                                   ← client-side filter only
On "Add to chat":   POST /api/chat/{conv_id}/documents        ← batch attach (new endpoint)
On × remove:        DELETE /api/chat/{conv_id}/documents/{id} ← already exists
```

**Backend:**
- [ ] **`POST /api/chat/{conversation_id}/documents` — batch attach** — new endpoint accepting
  `{ document_ids: list[str] }`. Verifies conversation ownership, calls `attach_documents()` for
  all IDs in one pass, returns updated `{ document_ids: list[str] }`. The existing single-doc
  `POST /{conv_id}/documents/{doc_id}` stays as-is for the source-card pin flow.

**Frontend — three components:**
- [ ] **`DocumentSidebar` component** — collapsible right panel in `ChatWindow`. Fetches
  `GET /api/chat/{conv_id}/documents` on mount and when `conversationId` changes. Shows attached
  docs with × to remove each (calls `DELETE`, updates local state). Shows "+ Add documents" button
  that opens `DocumentPalette`. When palette closes with newly added docs, appends them to local
  state without refetching. Empty state: "No documents — general chat mode".
- [ ] **`DocumentPalette` component** — command palette overlay. On open: fetches `GET /api/documents`
  once, filters out already-attached IDs client-side. Auto-focuses search input. Shows up to 10
  recent docs by default (no search typed). Filters client-side on keystroke — no API calls.
  Multi-select with toggle. Footer shows selected count + "Add to chat" button (only when ≥1
  selected). On confirm: single `POST /api/chat/{conv_id}/documents` with all selected IDs, then
  calls `onClose(selectedDocs)`. Outside-click closes without adding.
- [ ] **Wire `DocumentSidebar` into `ChatWindow`** — the existing `contextPanelOpen` toggle button
  already collapses the sidebar. Replace the current `<DocumentBar />` (which uses mock data) with
  `<DocumentSidebar conversationId={activeConversationId} />`.

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

- [ ] **URL ingestion UI** — `UploadZone.tsx` only handles file upload. Add a URL input field
  (tab or second section) that POSTs to `POST /api/documents/url`. Show the submitted URL as a
  processing item with the same progress tracking as file uploads. Blocked on backend Crawl4AI
  wiring.
- [ ] **Video file support in UploadZone** — `accept=".pdf,.txt,.md,.docx"` excludes video.
  Add video MIME types once Faster-Whisper pipeline is wired backend-side.
- [ ] **Delete confirmation** — delete in `DocumentList.tsx:133` fires immediately on click with
  no confirmation. Add inline "Are you sure?" state per item (show confirm/cancel on first click,
  execute on second). Hold-to-confirm is an alternative.
- [ ] **Search filter edge cases** — `DocumentList.tsx:337` uses `indexOf` and only filters
  `uploadedItems`, not `processingItems`. Fix: also filter processing items; handle empty query
  (show all) and special regex chars gracefully.

### Web Scraping Integration

- [ ] **Backend: wire Crawl4AI into `POST /api/documents/url`** — currently returns 501. Implement
  async URL fetch via Crawl4AI, extract markdown, pass through the normal chunk→embed→Qdrant
  pipeline as a background task. Return `document_id` immediately.
- [ ] **Backend: SearXNG client** — for research pipeline Stage 1, add SearXNG as an alternative
  to SerpAPI (self-hosted, no API key required). Read `SEARXNG_URL` from env; fall back to
  SerpAPI if set, skip web search if neither is configured.
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

- [ ] **Full Docker Compose** — current compose has 4 services (postgres, ollama, init-ollama, backend).
  Missing: Qdrant, Redis, Celery worker, Celery beat, Nginx, frontend container.
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
