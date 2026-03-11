# Athena

A self-hosted personal AI infrastructure platform built on local hardware. Athena is a persistent intelligence layer that remembers conversations, ingests documents, and answers questions using a hybrid RAG pipeline — all running locally with no cloud dependencies.

---

## What's Working

- **Streaming chat** — SSE-based token streaming with real-time UI, stop button, and TTFT measurement
- **Hybrid RAG** — vector search (Qdrant) + BM25 keyword search combined via Reciprocal Rank Fusion (k=60)
- **Document ingestion** — PDF, DOCX, plaintext, markdown, CSV, Python, and video/audio files; sentence-aware chunking (500-token target, 50-token overlap via NLTK)
- **Document scoping** — attach specific documents to a conversation, or toggle search-all to query the full knowledge base; pin documents directly from source citations
- **Conversation history** — full message persistence in PostgreSQL with token budget management and automatic summarization when context overflows (never drops messages)
- **Context window management** — 8,192-token budget split across system prompt, RAG context, history, and current message
- **Collections** — document organization layer; DB schema and API skeleton in place
- **Auth** — JWT-based login, bcrypt password hashing, auto-seeded admin account on first boot
- **System monitor** — persistent footer showing live CPU %, RAM, GPU VRAM, and storage stats

## What's Planned

- **Library view** — two-pane document browser with collections sidebar, file table, and 4-stage upload modal
- **Research pipeline** — multi-stage background synthesis using Celery + Tier 3 model (CPU-only)
- **Quiz generation** — LLM-generated questions with SM-2 spaced repetition
- **Knowledge graph** — concept extraction from research, D3.js visualization
- **Intent router** — ReAct-style classifier for tool selection before every chat message
- **MCP connectors** — Jellyfin, home automation, Seafile
- **Promotion flow** — suggest promoting engaging chat topics into persistent knowledge

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, asyncpg, Python 3.12, Pydantic v2, loguru |
| LLM inference | Ollama (local, GPU or CPU) — default model `qwen3.5:9b` |
| Vector DB | Qdrant |
| Relational DB | PostgreSQL 16 |
| Web scraping | Crawl4AI (Docker sidecar) |
| RAG | nomic-embed-text (768-dim), BM25 via rank-bm25, RRF fusion |
| Document parsing | pypdf, python-docx, faster-whisper (video/audio) |
| Auth | JWT (python-jose), bcrypt |
| Job queue | Redis + Celery *(planned — not yet wired)* |

---

## Architecture

### LLM Tiers

Three Ollama model tiers with defined roles:

| Tier | Model | Purpose |
|------|-------|---------|
| 1 | qwen3.5:9b (default) | All interactive queries — currently the only active tier |
| 2 | qwen2.5:30b | Quiz generation, complex reasoning, concept extraction *(planned)* |
| 3 | llama3.1:70b | Research synthesis only — always CPU (`num_gpu=0`), always background *(planned)* |

### Hybrid RAG Pipeline

Each chat message:
1. Embeds query via `nomic-embed-text` → searches Qdrant (cosine similarity)
2. Runs BM25 keyword search over pre-computed per-document indexes in PostgreSQL
3. Merges both result sets via Reciprocal Rank Fusion (k=60)
4. Scopes to attached documents or full knowledge base depending on conversation mode
5. Caps RAG context at 2,000 tokens; auto-summarizes oldest history when over 8,192 total

### Sentence-Aware Chunking

- NLTK sentence tokenizer determines boundaries
- 500-token target with ~50-token overlap
- Handles PDF hyphenated line breaks
- Never splits mid-sentence; oversized sentences emitted alone

---

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ and npm
- NVIDIA GPU with `nvidia-container-toolkit` (optional — CPU fallback works)

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd athena
cp .env.example .env
```

Open `.env` and set a real `JWT_SECRET_KEY`. Everything else works as-is for local development.

### 2. Start backend services

```bash
docker compose up -d
```

Starts PostgreSQL, Ollama, Qdrant, Crawl4AI, and the FastAPI backend. On first run, `init-ollama` pulls the configured LLM and embedding model — this takes a few minutes. Subsequent starts skip the download.

Check everything is up:

```bash
docker compose ps
curl http://localhost:8000/api/system/health
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default credentials: `admin` / `athena` (set by `SEED_ADMIN_PASSWORD` in `.env`)

---

## GPU Support

GPU passthrough is enabled by default in `docker-compose.yml` via the `deploy` block on the Ollama service. Requires `nvidia-container-toolkit` on the host.

To verify GPU is active after startup:
```bash
docker compose exec ollama nvidia-smi
```

To run CPU-only (MacBook or no GPU):
```bash
docker compose -f docker-compose.mac.yml up -d
```

---

## Resetting the Database

```bash
docker compose down
docker volume rm athena_postgres_data
docker compose up -d
```

This drops all data and re-runs the schema from scratch. Qdrant data persists separately in `athena_qdrant_data`.

---

## Project Structure

```
athena/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point, lifespan, router includes
│   │   ├── config.py            # Pydantic Settings (reads .env)
│   │   ├── api/
│   │   │   ├── chat.py          # SSE streaming, conversation management, doc attachment
│   │   │   ├── documents.py     # Upload, ingestion, progress tracking, delete
│   │   │   ├── collections.py   # Collections CRUD (skeleton)
│   │   │   ├── auth.py          # Login, /me
│   │   │   ├── system.py        # Health, resource stats, model list
│   │   │   ├── research.py      # Stub
│   │   │   ├── quizzes.py       # Stub
│   │   │   └── graph.py         # Stub
│   │   ├── core/
│   │   │   ├── rag.py           # Hybrid search: vector + BM25 + RRF
│   │   │   ├── ingestion.py     # Chunking, embedding, Qdrant upsert, BM25 indexing
│   │   │   ├── context.py       # Token budget, conversation summarization
│   │   │   ├── security.py      # JWT, bcrypt
│   │   │   └── bm25.py          # Per-document BM25 index cache
│   │   ├── db/
│   │   │   ├── postgres.py      # asyncpg pool + query helpers
│   │   │   └── qdrant.py        # Qdrant REST client (httpx)
│   │   └── models/              # Pydantic schemas
│   ├── sql/
│   │   └── schema.sql           # 8 tables: users, conversations, messages, documents,
│   │                            #   document_chunks, conversation_documents,
│   │                            #   bm25_indexes, collections
│   ├── requirements.txt
│   ├── Dockerfile
│   └── celeryconfig.py          # Beat schedule defined; not yet wired
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── globals.css          # Structural Glass design system
│   │   ├── login/
│   │   └── (app)/               # Auth-protected layout
│   │       ├── chat/
│   │       ├── documents/
│   │       ├── research/
│   │       ├── quizzes/
│   │       ├── graph/
│   │       └── settings/
│   ├── components/
│   │   ├── chat/                # ChatWindow, MessageList, Message, MessageInput,
│   │   │                        #   ScopeBar, DocumentBar, CommandPalette, TierBadge
│   │   ├── documents/           # DocumentsPanel, UploadZone, DocumentList
│   │   ├── layout/              # AppShell, Sidebar, SystemFooter, ThemeProvider
│   │   └── ui/                  # GlassCard, GlassButton, Modal, Spinner, Badge
│   ├── hooks/
│   │   ├── useSSEChat.ts        # Streaming send, event parsing, TTFT measurement
│   │   ├── useSystemStats.ts    # Polls /api/system/resources every 5s
│   │   └── useHealthCheck.ts    # Service health polling
│   ├── stores/                  # Zustand: auth, chat, ui, system, theme
│   └── api/
│       └── client.ts            # Fetch wrapper with JWT auth + SSE support
├── docker-compose.yml
├── docker-compose.mac.yml       # CPU-only variant for MacBook
├── .env.example
├── init-ollama.sh               # Pulls LLM + embedding model on first start
├── frontend_design_vision.md    # Full UI/design system reference
└── CLAUDE.md                    # Architecture spec and phase plan
```

---

## API Endpoints

### Working

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Get JWT token |
| `GET` | `/api/auth/me` | Current user info |
| `POST` | `/api/chat` | SSE streaming chat with RAG |
| `GET` | `/api/chat/conversations` | List conversations |
| `GET` | `/api/chat/conversations/{id}/messages` | Message history |
| `POST` | `/api/chat/{id}/documents` | Batch attach documents to conversation |
| `GET` | `/api/chat/{id}/documents` | List attached documents |
| `DELETE` | `/api/chat/{id}/documents/{doc_id}` | Detach document |
| `POST` | `/api/documents/upload` | Upload and ingest file |
| `GET` | `/api/documents` | List documents |
| `GET` | `/api/documents/{id}` | Document metadata |
| `GET` | `/api/documents/{id}/progress` | Ingestion progress |
| `GET` | `/api/documents/progress/active` | Bulk active ingestion status |
| `GET` | `/api/documents/{id}/conversations` | Conversations using this document |
| `DELETE` | `/api/documents/{id}` | Delete from Qdrant + PostgreSQL |
| `GET` | `/api/system/health` | Service health check |
| `GET` | `/api/system/resources` | CPU, RAM, GPU stats |
| `GET` | `/api/system/models` | Available Ollama models |

### Partial / Skeleton

| Method | Path | Status |
|--------|------|--------|
| `POST` | `/api/documents/url` | Crawl4AI wired — returns preview, not real ingestion |
| `GET` | `/api/collections` | Returns rows, full CRUD not implemented |

### Stubbed

`POST /api/research`, `GET /api/research`, `POST /api/quizzes/generate`, `GET /api/graph/*`

---

## Environment Variables

See `.env.example` for all options.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | (weak default) | **Change this.** Signs auth tokens. |
| `SEED_ADMIN_PASSWORD` | `athena` | Password for the auto-created admin account |
| `OLLAMA_MODEL` | `qwen3.5:9b` | LLM model to load and use |
| `DB_PASSWORD` | `changeme` | PostgreSQL password |
| `LOG_LEVEL` | `INFO` | Backend log verbosity |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` | Direct backend URL for SSE streaming |
| `SERP_API_KEY` | *(empty)* | SerpAPI key for web search — leave empty to disable |

---

## Full Architecture Spec

For the complete design — LLM tiers, two-tier knowledge model, research pipeline, database schema, Celery beat schedule, and phase plan — see [`CLAUDE.md`](./CLAUDE.md).

For the UI design system — Structural Glass aesthetic, all theme tokens, component patterns, and view specs — see [`frontend_design_vision.md`](./frontend_design_vision.md).
