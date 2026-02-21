# Athena

Self-hosted personal AI infrastructure. Athena is a persistent intelligence layer that runs entirely on local hardware — it remembers conversations, ingests documents, compounds knowledge over time, and routes queries to local models via a multi-tier LLM architecture.

**Current state:** Phase 1 partial — auth, streaming chat, conversation history, and the full UI shell are working. RAG, vector search, document ingestion, research pipeline, quizzes, and knowledge graph are not yet implemented.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, asyncpg, Python 3.11+ |
| Database | PostgreSQL 16 |
| LLM inference | Ollama (local) |
| Vector DB | Qdrant *(planned)* |
| Cache / jobs | Redis + Celery *(planned)* |

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

Edit `.env` and set a real `JWT_SECRET_KEY` (any long random string). Everything else can stay as-is for local dev.

### 2. Start backend services

```bash
docker compose up -d
```

This starts Postgres, Ollama, and the FastAPI backend. On first run, `init-ollama` pulls `llama3.2:3b` automatically — this takes a few minutes depending on connection speed. Subsequent starts skip the download.

Check that everything is up:

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

## GPU support

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

Requires `nvidia-container-toolkit` installed on the host. Verify with `nvidia-smi` inside the container after enabling.

---

## Switching machines (dev workflow)

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

Postgres data persists in a named Docker volume (`postgres_data`). To reset the database completely:

```bash
docker compose down -v   # destroys volumes
docker compose up -d
```

---

## Project structure

```
athena/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point, lifespan, router includes
│   │   ├── config.py        # Pydantic Settings (reads from .env)
│   │   ├── api/             # Route handlers
│   │   ├── core/            # Business logic (security; router/RAG/etc. planned)
│   │   ├── db/              # asyncpg pool + helpers
│   │   └── models/          # Pydantic schemas
│   ├── sql/
│   │   └── schema.sql       # Applied automatically on first Postgres start
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # Next.js app
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # UI components (chat, documents, layout, etc.)
│   ├── hooks/               # useSSEChat, useSystemStats
│   ├── stores/              # Zustand stores (auth, chat, ui, system)
│   ├── api/                 # API client wrapper
│   └── types/
├── docker-compose.yml
├── .env.example
├── init-ollama.sh           # Pulls LLM model on first Ollama start
└── CLAUDE.md                # Full architecture spec and phase plan
```

---

## Environment variables

See `.env.example` for all options. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | (weak default) | **Change this.** Signs auth tokens. |
| `SEED_ADMIN_PASSWORD` | `athena` | Password for the auto-created admin account |
| `DB_PASSWORD` | `changeme` | Postgres password |
| `LOG_LEVEL` | `INFO` | Backend log verbosity |
| `SERP_API_KEY` | *(empty)* | SerpAPI key for web search (leave empty to disable) |

---

## Architecture notes

For the full design — LLM tiers, two-tier knowledge model, research pipeline, schema, and phase plan — see [`CLAUDE.md`](./CLAUDE.md).
