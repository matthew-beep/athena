# Athena — Current Codebase Status

This document describes what is **actually implemented** in the Athena monorepo as of the current state. It is intended to complement `CLAUDE.md` (which defines the target architecture and phases). Use this for onboarding, planning, or gap analysis.

---

## 1. Overview

| Area | Status | Notes |
|------|--------|--------|
| **Backend** | Phase 1 partial | Auth + chat (Ollama streaming) + Postgres; documents/research/quizzes/graph are API shells only |
| **Frontend** | Phase 1 partial | Login, chat (SSE), sidebar/conversations, documents upload UI, system stats; Research/Graph/Quizzes are placeholders |
| **Database** | Minimal schema | `users`, `conversations`, `messages` only — no documents, graph, research, quizzes, or learning tables |
| **Infrastructure** | Not in code | No Redis, Qdrant, Celery, or MCP in backend; Docker Compose present at repo root |

**Reference:** Full target design and phase order are in `CLAUDE.md`.

---

## 2. Backend

### 2.1 Directory layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan, CORS, router includes
│   ├── config.py            # Pydantic Settings (DB, Ollama, JWT, app)
│   ├── api/
│   │   ├── auth.py          # Login, JWT, GET /me
│   │   ├── chat.py          # Conversations, messages, SSE stream to Ollama
│   │   ├── documents.py     # Route shells only
│   │   ├── research.py      # Route shells only
│   │   ├── quizzes.py       # Route shells only
│   │   ├── graph.py         # Route shells only
│   │   └── system.py        # Health (real), resources (mock), models (static)
│   ├── core/
│   │   └── security.py      # JWT + bcrypt only
│   ├── db/
│   │   └── postgres.py      # asyncpg pool, fetch_one/fetch_all/execute
│   └── models/
│       ├── auth.py
│       ├── chat.py
│       └── system.py
├── sql/
│   └── schema.sql           # users, conversations, messages only
├── requirements.txt
└── Dockerfile
```

**Not present (vs CLAUDE.md):** `core/` (router, rag, ingestion, research, quiz, graph, context), `db/redis.py`, `db/qdrant.py`, `tasks/`, `mcp/`.

### 2.2 Implemented vs stubbed

| Module | Implemented | Stubbed / placeholder |
|--------|-------------|------------------------|
| **main.py** | Lifespan (Postgres retry 10×, seed admin), CORS, routers, `GET /` | — |
| **Auth** | Login, JWT issue, `GET /me`, bcrypt, `get_current_user` | — |
| **Chat** | Create/get conversation by user, save messages, load last 40 messages, fixed system prompt, **SSE stream to Ollama**, list conversations, get messages | No RAG, no router, no promotion, no Qdrant/Redis; single model from config |
| **Documents** | Route shapes + auth | All handlers: empty list, fake IDs, or “not yet implemented” |
| **Research** | Route shapes + auth | Fake `research_id`, “Research pipeline not yet implemented” |
| **Quizzes** | Route shapes + auth | Empty lists / “not yet implemented” |
| **Graph** | Route shapes + auth | Empty `nodes` / `edges` / `gaps` |
| **System** | Health (real), version | Resources: mock (random CPU/RAM); models: hardcoded list |
| **DB** | PostgreSQL pool, helpers | No Redis, no Qdrant |
| **Core** | JWT + bcrypt in `security.py` | No router, RAG, ingestion, research, quiz, graph, context |

### 2.3 API routes (summary)

All under `/api/`. Auth routes are public for login; all others require `Authorization: Bearer <token>` unless noted.

| Method | Path | Behavior |
|--------|------|----------|
| **Auth** | | |
| POST | `/api/auth/login` | Body: `{ username, password }`. Returns JWT. 401 if invalid. |
| GET | `/api/auth/me` | Returns current user (id, username, created_at). |
| **Chat** | | |
| POST | `/api/chat` | Body: `message`, `conversation_id?`, `knowledge_tier`. Streams SSE from Ollama; final `done` event with conversation_id, model_tier=1, model, latency_ms. |
| GET | `/api/chat/conversations` | List conversations for current user. |
| GET | `/api/chat/conversations/{id}/messages` | Messages for that conversation (404 if not owned). |
| **Documents** | | |
| GET | `/api/documents` | Returns `{ documents: [], total: 0 }`. |
| POST | `/api/documents/upload` | Accepts file; returns fake document_id + “Document processing not yet implemented”. |
| POST | `/api/documents/url` | Body: `{ url }`; returns fake document_id + “URL ingestion not yet implemented”. |
| GET | `/api/documents/{id}` | Returns `{ document_id, status: "not_found" }`. |
| DELETE | `/api/documents/{id}` | Returns `{ deleted: id }` (no real DB delete). |
| **Research** | | |
| GET | `/api/research` | `{ sessions: [], total: 0 }`. |
| POST | `/api/research` | Fake `research_id`, status `pending`, “Research pipeline not yet implemented”. |
| **Quizzes** | | |
| GET | `/api/quizzes/due` | `{ quizzes: [], total: 0 }`. |
| POST | `/api/quizzes/generate` | “Quiz generation not yet implemented”. |
| GET | `/api/quizzes/concepts/mastery` | `{ concepts: [] }`. |
| **Graph** | | |
| GET | `/api/graph/visualize` | `{ nodes: [], edges: [] }`. |
| GET | `/api/graph/nodes` | `{ nodes: [] }`. |
| GET | `/api/graph/gaps` | `{ gaps: [] }`. |
| **System** | | |
| GET | `/api/system/health` | No auth. `{ status: "ok", version: "0.1.0" }`. |
| GET | `/api/system/resources` | Mock CPU/RAM/GPU/NVMe/HDD. |
| GET | `/api/system/models` | Hardcoded list (e.g. one model: `llama3.2:3b`, tier 1). |

### 2.4 Database schema (current)

**File:** `backend/sql/schema.sql`

- **users:** `id`, `username`, `hashed_password`, `created_at`
- **conversations:** `id`, `conversation_id`, `user_id` (FK users), `title`, `knowledge_tier`, `started_at`, `last_active`
- **messages:** `id`, `message_id`, `conversation_id` (FK conversations), `role`, `content`, `model_used`, `timestamp`

No tables yet for: documents, document_chunks, graph_nodes, graph_edges, research_sessions, quizzes, quiz_questions, concept_mastery, learning_signals, topic_engagement, promotion_events.

### 2.5 Config and dependencies

- **config.py:** Postgres (host, port, db, user, password), Ollama (host, port, model default `llama3.2:3b`), JWT (secret, algorithm, expire_days), seed_admin_password.
- **requirements.txt:** fastapi, uvicorn, asyncpg, pydantic, pydantic-settings, python-jose, bcrypt, httpx, loguru, python-multipart. No Redis, Qdrant, Celery, Crawl4AI, yt-dlp, Whisper, SerpAPI, or MCP.

---

## 3. Frontend

### 3.1 Directory layout

```
frontend/src/
├── App.tsx
├── main.tsx
├── index.css
├── api/
│   └── client.ts            # BASE_URL /api, Bearer, get/post/delete/postStream; 401 → logout
├── components/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── MessageInput.tsx
│   │   └── TierBadge.tsx
│   ├── documents/
│   │   ├── DocumentsPanel.tsx
│   │   ├── UploadZone.tsx
│   │   └── DocumentList.tsx   # Stub: always “No documents yet”
│   ├── graph/
│   │   └── KnowledgeGraph.tsx  # Placeholder + small dummy viz
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TabBar.tsx
│   │   └── SystemFooter.tsx
│   ├── quizzes/
│   │   └── QuizzesPanel.tsx   # “Coming in Phase 3”
│   ├── research/
│   │   └── ResearchPanel.tsx   # “Coming in Phase 5”
│   ├── settings/
│   │   └── SettingsPanel.tsx
│   └── ui/
│       ├── GlassCard.tsx
│       ├── GlassButton.tsx
│       ├── GlassInput.tsx
│       ├── Badge.tsx
│       └── Spinner.tsx
├── hooks/
│   ├── useSSEChat.ts         # POST /api/chat, parse SSE token/done/error, update chat store
│   └── useSystemStats.ts     # GET /api/system/resources on interval → system store
├── stores/
│   ├── auth.store.ts         # token, user, setAuth, logout (persisted athena-auth)
│   ├── chat.store.ts         # conversations, activeConversationId, messages, streaming, setters
│   ├── system.store.ts       # stats, lastUpdated, setStats
│   └── ui.store.ts           # activeTab, sidebarOpen
├── types/
│   └── index.ts              # User, TokenResponse, Conversation, Message, stream types, ResourceStats, etc.
└── utils/
    └── cn.ts
```

### 3.2 Routing and layout

- **Routes:** `/login` → `LoginPage`; all other paths → `ProtectedRoute` → `AppShell`. No path-based sub-routes; content is tab-driven.
- **AppShell:** Sidebar (conversations) + TabBar (Chat, Research, Knowledge, Quizzes, Documents, Settings) + tab content + SystemFooter.

### 3.3 Implemented vs stubbed (frontend)

| Area | Implemented | Stubbed / partial |
|------|-------------|-------------------|
| **Auth** | Login form → POST login, GET me → setAuth → navigate | — |
| **Chat** | SSE send, token stream, done event, store update, MessageList, MessageInput, TierBadge | TierBadge tier hardcoded 1; latency/tier from `done` not on message |
| **Sidebar** | Load conversations, select conversation, load messages | — |
| **Documents** | UploadZone → POST upload (shows “processing not yet implemented”) | DocumentList does not call GET /api/documents; always empty state |
| **Research / Graph / Quizzes** | Tab + panel UI | “Coming in Phase X”; no API calls |
| **Settings** | Uses system store (resources from API) | Model/embedding/vector DB lines static; no settings API |
| **Footer** | NVMe/HDD/CPU/GPU from `/api/system/resources` | Version/health static |

### 3.4 Backend connections

| Frontend feature | Backend endpoint(s) | Status |
|------------------|---------------------|--------|
| Login | `POST /api/auth/login`, `GET /api/auth/me` | ✅ |
| Chat stream | `POST /api/chat` (streaming) | ✅ |
| Conversation list | `GET /api/chat/conversations` | ✅ |
| Messages | `GET /api/chat/conversations/:id/messages` | ✅ |
| Document upload | `POST /api/documents/upload` | ✅ (backend returns placeholder message) |
| Document list | `GET /api/documents` | ❌ Not used (DocumentList is stub) |
| System resources | `GET /api/system/resources` | ✅ |
| Research / Graph / Quizzes | Various API routes | ❌ Panels are stubs, no calls |

### 3.5 Stack and build

- **Dependencies:** React 18, react-router-dom 7, Zustand 5, Framer Motion 11, Lucide React, Tailwind 3.4.
- **Build:** TypeScript 5.6, Vite 6, @vitejs/plugin-react. Scripts: `dev`, `build` (tsc && vite build), `preview`.
- **Dev proxy:** `/api` → `http://localhost:8000`.

---

## 4. Gaps vs CLAUDE.md (concise)

- **Auth:** Implemented (JWT + admin seed); CLAUDE.md says “No authentication in Phase 1” — already ahead.
- **Schema:** Only 3 tables; full Athena schema (documents, chunks, graph, research, quizzes, learning_signals, etc.) not applied.
- **Chat:** No RAG, router, promotion, token budgeting, or summarization; single model; no Qdrant/Redis.
- **Documents:** No storage, chunking, embeddings, or Qdrant; API returns placeholders.
- **Research:** No Celery, stages, WebSocket, SerpAPI/Crawl4AI/synthesis.
- **Quizzes / Graph:** No backend logic or DB tables; API returns empty data.
- **System:** Resources mock; models static; no storage stats or Prometheus.
- **Missing backend modules:** core (router, rag, ingestion, research, quiz, graph, context), db (redis, qdrant), tasks, mcp.

---

## 5. Suggested next steps (for Phase 1 completion)

1. **Schema:** Add `documents`, `document_chunks` (and optionally keep current users/conversations/messages as-is for Phase 1).
2. **Documents:** Implement upload → store file → chunk → embed → Qdrant (add Qdrant + embedding client); wire GET/DELETE to real DB.
3. **Chat:** Add RAG: embed query, search Qdrant, inject context into system prompt; keep single model for Phase 1.
4. **Frontend:** DocumentList to call `GET /api/documents` and show list; optionally wire TierBadge/latency from stream `done` to message.
5. **System:** Replace mock resources with real stats (or leave mock until Prometheus/agents exist); optional: call `/api/system/health` in footer.

This document can be updated as the codebase evolves. For full architecture and phase definitions, see `CLAUDE.md`.


 Overview

  A working look-and-feel prototype with real auth, real streaming chat, and a full UI shell across all 6 tabs. No RAG, no vector database, no background jobs — just the core interaction loop running end to end.

  ---
  Infrastructure

  docker-compose.yml — 4 services:

  ┌────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │      Service       │                                             What it does                                             │
  ├────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ postgres:16-alpine │ Stores users, conversations, messages                                                                │
  ├────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ollama/ollama      │ Serves the LLM locally on port 11434                                                                 │
  ├────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ init-ollama        │ One-shot container that waits for Ollama to be healthy, then pulls llama3.2:3b if not already cached │
  ├────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ backend            │ FastAPI app on port 8000                                                                             │
  └────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘

  The frontend is not in Docker — you run it with npm run dev on your host for fast HMR. Vite proxies all /api/* requests to localhost:8000 so there are no CORS issues.

  .env.example — all configurable values. Copy to .env and change JWT_SECRET_KEY before production use.

  init-ollama.sh — polls GET /api/tags until Ollama responds, then pulls the model. On subsequent starts, it detects the model is already cached and exits immediately.

  ---
  Backend

  Built with FastAPI + asyncpg + python-jose + passlib.

  app/config.py — Pydantic Settings reads all config from environment variables with sensible defaults. Single get_settings() call cached with @lru_cache.

  app/db/postgres.py — asyncpg connection pool. Simple helper functions (fetch_one, fetch_all, execute) used throughout. Pool is created in the FastAPI lifespan and retries up to 10 times with 2s delays so the
  backend doesn't crash if Postgres is still starting.

  app/core/security.py — bcrypt password hashing via passlib, JWT creation/decode via python-jose, and a get_current_user FastAPI dependency that decodes the Bearer token and loads the user from the database. All
  protected routes use Depends(get_current_user).

  app/main.py — lifespan handler creates the DB pool, then calls seed_admin_user() which inserts admin with the bcrypt hash of SEED_ADMIN_PASSWORD (defaults to athena) — but only if the user doesn't already exist.
  Then includes all routers.

  backend/sql/schema.sql — mounted into the Postgres container at /docker-entrypoint-initdb.d/ so it runs automatically on first boot. Three tables: users, conversations, messages.

  API routes

  POST /api/auth/login — verifies username + bcrypt password, returns a 7-day JWT.

  GET /api/auth/me — decodes token, returns user info.

  POST /api/chat — the main endpoint. It:
  1. Gets or creates a conversation in Postgres
  2. Loads conversation history (last 40 messages)
  3. Saves the user message
  4. Updates the conversation title if it's still "New Conversation"
  5. Builds the messages array: system prompt + history + new user message
  6. Streams to Ollama's /api/chat endpoint via httpx
  7. Yields SSE events: {"type": "token", "content": "..."} for each token
  8. When Ollama signals done, saves the full assembled response to Postgres
  9. Yields a final {"type": "done", "conversation_id": "...", "model_tier": 1, "model": "llama3.2:3b", "latency_ms": N}

  GET /api/chat/conversations — lists conversations for the current user, ordered by last active.

  GET /api/chat/conversations/{id}/messages — loads full message history for a conversation.

  GET /api/system/health — unauthenticated health check (used by Docker healthcheck).

  GET /api/system/resources — returns mock CPU/RAM/GPU/storage stats (randomized slightly so the footer looks live).

  All other endpoints (documents, research, quizzes, graph) are stubs that return empty arrays or pending status messages.

  ---
  Frontend

  Built with React 18 + TypeScript + Tailwind CSS v3 + Zustand + Vite.

  Design system (src/index.css)

  All CSS variables defined on :root:
  - --background: 0 0% 4% — near-black zinc
  - --primary: 217 91% 60% — blue-500
  - --accent: 142 71% 45% — emerald

  Utility classes written as plain CSS (not Tailwind plugins): .glass-subtle, .glass, .glass-strong — three blur tiers using backdrop-filter. .btn-glow — primary button with box-shadow glow. .typing-dot — bouncing
  dots for the "thinking" indicator. .animate-fade-up, .animate-scale-in, .animate-float — entrance animations.

  State management (Zustand stores)

  auth.store.ts — token, user, isAuthenticated. Persisted to localStorage via zustand/middleware. On page reload, if a token exists it restores isAuthenticated: true without hitting the server.

  chat.store.ts — conversations[], activeConversationId, messages (keyed by conversation ID), streamingContent (the in-flight token accumulator), isStreaming. The streaming content lives here so both MessageList
  (displays it) and useSSEChat (writes to it) can share it.

  ui.store.ts — activeTab, sidebarOpen.

  system.store.ts — stats (resource numbers), lastUpdated.

  SSE streaming (src/hooks/useSSEChat.ts)

  Uses fetch with apiClient.postStream() (not EventSource — EventSource doesn't support POST or custom headers). Reads the response body as a ReadableStream, decodes chunks with TextDecoder, buffers partial lines,
  and parses each data: {...} line as JSON.

  On a token event: calls appendStreamToken() in the store — the running text appears in real time.

  On the done event: pulls the fully accumulated streamingContent out of the store, creates a Message object, and calls addMessage(). This is the moment the streaming bubble becomes a permanent message.

  Auth flow

  App.tsx renders a ProtectedRoute wrapper. If isAuthenticated is false → redirects to /login. The LoginPage does a plain fetch to /api/auth/login, gets the token, then fetches /api/auth/me to get the user object,
  then calls setAuth(token, user) in the store. The store persists to localStorage. On next visit the auth is restored without re-logging in.

  Any API call that gets a 401 response calls logout() in apiClient.handleResponse(), which clears the store and triggers the redirect.

  Layout

  AppShell is the root component when authenticated:

  ┌────────────────────────────────────────────────────┐
  │ Sidebar (256px)  │ TabBar                          │
  │                  │─────────────────────────────────│
  │ [A] Athena       │                                 │
  │ + New convo      │  <TabContent />                 │
  │                  │                                 │
  │ conv 1           │                                 │
  │ conv 2           │                                 │
  │ ...              │                                 │
  │                  │                                 │
  │ [admin] [logout] │                                 │
  ├──────────────────┴─────────────────────────────────┤
  │ SystemFooter (always visible)                      │
  └────────────────────────────────────────────────────┘

  Sidebar loads conversations from the API on mount. Clicking a conversation loads its messages. "New conversation" sets activeConversationId to null, which makes MessageList show the empty state.

  TabBar switches between the 6 tabs — only Chat is fully wired, the other 5 render stub panels with "coming in Phase X" cards.

  SystemFooter calls useSystemStats which polls /api/system/resources every 10 seconds and renders progress bars for NVMe, HDD, CPU, GPU.

  ---
  What's Not There Yet (by design)

  - No RAG — no Qdrant, no embeddings, no document chunking
  - No background jobs — no Celery, no Redis
  - No Nginx — Vite dev server proxies directly to the backend
  - No Tier 2 or Tier 3 models — only llama3.2:3b via Ollama
  - No knowledge graph, no quizzes, no research pipeline
  - No two-tier ephemeral/persistent distinction (all chat is ephemeral by shape, just stored in Postgres)