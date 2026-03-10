# Athena

A self-hosted personal AI infrastructure platform built on local hardware. Athena is a persistent intelligence layer that remembers conversations, ingests documents, and serves answers using a hybrid RAG pipeline — all running locally with no cloud dependencies.

---

## What's Working

- **Streaming chat** — SSE-based token streaming with a real-time UI
- **Hybrid RAG** — vector search (Qdrant) + BM25 keyword search combined via Reciprocal Rank Fusion
- **Document ingestion** — PDF, DOCX, plaintext, markdown, CSV, and Python files chunked with sentence-aware boundaries (500-token target, 50-token overlap)
- **Web URL ingestion** — scraping via Crawl4AI
- **Conversation history** — full message persistence in PostgreSQL with token budget management and automatic summarization when context overflows
- **Scoped search** — pin a conversation to specific documents or search across the full knowledge base
- **Context window management** — 8,192-token budget split across system prompt, RAG context, history, and current message; oldest messages summarized (not dropped) when over limit
- **Auth** — JWT-based login, bcrypt password hashing, auto-seeded admin account
- **System monitor** — persistent footer showing CPU %, RAM, GPU VRAM, and storage usage
- **Complete UI shell** — all planned panels exist (chat, documents, research, quizzes, knowledge graph, settings)

## What's Planned

- Research pipeline — multi-stage background synthesis using Celery + Tier 3 model (CPU-only)
- Quiz generation and spaced repetition (SM-2 algorithm)
- Knowledge graph — concept extraction and D3.js visualization
- Intent router — ReAct-style classifier for tool selection
- MCP connectors — Jellyfin, home automation, Seafile
- Promotion flow — UI card to promote engaging chat topics into persistent knowledge

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS, Zustand, Framer Motion |
| Backend | FastAPI, asyncpg, Python 3.11+, Pydantic v2, loguru |
| LLM inference | Ollama (local, GPU or CPU) |
| Vector DB | Qdrant |
| Relational DB | PostgreSQL 16 |
| Web scraping | Crawl4AI |
| RAG | nomic-embed-text (768-dim embeddings), BM25 via rank-bm25, RRF fusion |
| Document parsing | pypdf, python-docx, faster-whisper (optional) |
| Auth | JWT (python-jose), bcrypt |
| Job queue | Redis + Celery *(infrastructure ready, not yet wired)* |

---

## Architecture

### LLM Tiers

Three Ollama model tiers, each with a defined role:

| Tier | Model | Quantization | Purpose |
|------|-------|-------------|---------|
| 1 | qwen2.5:7b | Q4_K_M | All interactive queries, routing, classification |
| 2 | qwen2.5:30b | Q5_K_M | Quiz generation, complex reasoning, concept extraction |
| 3 | llama3.1:70b | Q4_K_M | Research synthesis only — always CPU (`num_gpu=0`), always background |

Tier 3 is never called from a request handler. It only runs inside background Celery tasks.

### Hybrid RAG Pipeline

Each chat message runs through:
1. **Embed query** via `nomic-embed-text` → search Qdrant for top-K chunks (cosine similarity)
2. **BM25 keyword search** over pre-computed per-document indexes cached in PostgreSQL
3. **Reciprocal Rank Fusion** (k=60) merges both result sets
4. **Document scope** — fuzzy-matched against attached documents or full knowledge base depending on conversation mode
5. **Token budget trim** — RAG context capped at 2,000 tokens; oldest history summarized to stay within 8,192 total

### Two-Tier Knowledge Model (in design)

- **Ephemeral** — general chat; stored in PostgreSQL only, never embedded into Qdrant
- **Persistent** — intentional knowledge entered via document upload, research pipeline, or user-accepted promotion; fully indexed in Qdrant and knowledge graph

### Sentence-Aware Chunking

- NLTK sentence tokenizer determines boundaries
- 500-token target with ~50-token overlap
- Handles PDF hyphenated line breaks
- Never splits mid-sentence

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

Open `.env` and set a real `JWT_SECRET_KEY` (any long random string). Everything else works as-is for local development.

### 2. Start backend services

```bash
docker compose up -d
```

This starts PostgreSQL, Ollama, Qdrant, Crawl4AI, and the FastAPI backend. On first run, `init-ollama` pulls the configured LLM model — this takes a few minutes depending on connection speed. Subsequent starts skip the download.

The database schema is applied automatically via the `init_db` lifecycle on first start.

Check that everything is healthy:

```bash
docker compose ps
curl http://localhost:8000/api/system/health
```

### 3. Install and run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default credentials: `admin` / `athena` (set by `SEED_ADMIN_PASSWORD` in `.env`)

---

## GPU Support

The Ollama service in `docker-compose.yml` has GPU passthrough commented out. To enable it, uncomment the `deploy` block:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires `nvidia-container-toolkit` on the host. Verify with `nvidia-smi` inside the Ollama container after enabling.

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
│   │   │   ├── documents.py     # Upload, ingestion status, delete
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
│   │   │   └── bm25.py          # Per-document BM25 index cache (PostgreSQL)
│   │   ├── db/
│   │   │   ├── postgres.py      # asyncpg pool + query helpers
│   │   │   └── qdrant.py        # Qdrant REST client (httpx)
│   │   └── models/              # Pydantic schemas
│   ├── sql/
│   │   └── schema.sql           # 7 tables: users, conversations, messages,
│   │                            #   documents, document_chunks,
│   │                            #   conversation_documents, bm25_indexes
│   ├── requirements.txt
│   ├── Dockerfile
│   └── celeryconfig.py          # Beat schedule defined; not yet wired
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── login/
│   │   └── (app)/               # Protected layout
│   │       ├── chat/
│   │       ├── documents/
│   │       ├── research/
│   │       ├── quizzes/
│   │       ├── graph/
│   │       └── settings/
│   ├── components/
│   │   ├── chat/                # ChatWindow, MessageList, Message, MessageInput,
│   │   │                        #   ScopeBar, DocumentBar, TierBadge, DevModeOverlay
│   │   ├── documents/           # DocumentsPanel, UploadZone, DocumentList
│   │   ├── layout/              # AppShell, Sidebar, SystemFooter, ThemeProvider
│   │   └── ui/                  # GlassCard, GlassButton, Modal, Spinner, Badge
│   ├── hooks/
│   │   ├── useSSEChat.ts        # Streaming send, event parsing, TTFT measurement
│   │   ├── useSystemStats.ts    # Polls /api/system/resources every 5s
│   │   └── useHealthCheck.ts    # Service health polling on mount
│   ├── stores/                  # Zustand: auth, chat, ui, system, theme
│   ├── api/
│   │   └── client.ts            # Fetch wrapper with JWT auth + SSE support
│   └── types/
├── docker-compose.yml
├── .env.example
├── init-ollama.sh               # Pulls LLM on first Ollama start
└── CLAUDE.md                    # Full architecture spec and phase plan
```

---

## API Endpoints

### Working

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Get JWT token |
| `GET` | `/api/auth/me` | Current user info |
| `POST` | `/api/chat` | SSE streaming chat |
| `GET` | `/api/chat/conversations` | List conversations |
| `GET` | `/api/chat/conversations/{id}/messages` | Message history |
| `POST` | `/api/chat/{id}/documents` | Attach documents to conversation |
| `GET` | `/api/chat/{id}/documents` | List attached documents |
| `DELETE` | `/api/chat/{id}/documents/{doc_id}` | Detach document |
| `POST` | `/api/documents/upload` | Upload and ingest file |
| `POST` | `/api/documents/url` | Ingest web URL |
| `GET` | `/api/documents` | List documents |
| `GET` | `/api/documents/{id}` | Document metadata |
| `GET` | `/api/documents/{id}/status` | Ingestion progress |
| `DELETE` | `/api/documents/{id}` | Delete from Qdrant + PostgreSQL |
| `GET` | `/api/system/health` | Service health check |
| `GET` | `/api/system/resources` | CPU, RAM, GPU, storage stats |
| `GET` | `/api/system/models` | Available Ollama models |

### Stubbed (endpoints exist, not yet implemented)

`POST /api/research`, `GET /api/research`, `POST /api/quizzes/generate`, `GET /api/graph/*`

---

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | (weak default) | **Change this.** Signs auth tokens. |
| `SEED_ADMIN_PASSWORD` | `athena` | Password for the auto-created admin account |
| `OLLAMA_MODEL` | `qwen2.5:7b` | LLM model to load and use |
| `DB_PASSWORD` | `changeme` | PostgreSQL password |
| `LOG_LEVEL` | `INFO` | Backend log verbosity |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` | Direct backend URL for SSE (bypasses Next.js proxy buffering) |
| `SERP_API_KEY` | *(empty)* | SerpAPI key for web search — leave empty to disable |

---

## Switching Machines / Dev Workflow

```bash
# Pull latest
git pull

# Rebuild backend if requirements or Dockerfile changed
docker compose up -d --build backend

# Update frontend dependencies if package.json changed
cd frontend && npm install

# Start everything
docker compose up -d
cd frontend && npm run dev
```

PostgreSQL data persists in a named Docker volume (`postgres_data`). To reset the database completely:

```bash
docker compose down -v   # destroys all volumes
docker compose up -d
```

---

## Full Architecture Spec

For the complete design — LLM tiers, two-tier knowledge model, research pipeline, database schema, Celery beat schedule, and phase plan — see [`CLAUDE.md`](./CLAUDE.md).
