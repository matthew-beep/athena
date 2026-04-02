# Deployment

## Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| postgres | paradedb/paradedb:latest-pg16 | 5432 | ParadeDB — Postgres + pg_search (BM25) |
| ollama | ollama/ollama:latest | 11434 | Local LLM inference |
| init-ollama | ollama/ollama:latest | — | One-shot model pull on first boot |
| qdrant | qdrant/qdrant:latest | 6333 | Vector database |
| crawl4ai | unclecode/crawl4ai:latest | 11235 | Web scraping |
| redis | redis:7-alpine | 6379 | Celery broker + progress tracking |
| backend | custom | 8000 | FastAPI app |
| celery-worker | custom (same image as backend) | — | Background task worker |

---

## Mac (CPU-only)

Uses `docker-compose.mac.yml` — no GPU config, Ollama runs CPU-only inside Docker.

```bash
cp .env.example .env
# Edit .env if needed (passwords, model selection)
docker compose -f docker-compose.mac.yml up --build
```

Frontend (runs on host, not in Docker):
```bash
cd frontend && npm install && npm run dev
```

---

## PC with NVIDIA GPU

Uses `docker-compose.yml` — includes NVIDIA GPU passthrough for Ollama.

```bash
cp .env.example .env
# Edit .env if needed
docker compose up --build
```

Frontend:
```bash
cd frontend && npm install && npm run dev
```

> `init-ollama` pulls the model automatically on first boot — no manual `ollama pull` needed.

---

## Verifying everything is running

```bash
# All services healthy
docker compose -f docker-compose.mac.yml ps

# Backend API
curl http://localhost:8000/api/system/health

# Celery worker picked up connection to Redis
docker logs celery-worker --tail 20

# Redis is reachable
docker exec -it athena-redis-1 redis-cli ping
# → PONG
```

---

## Rebuilding after code changes

```bash
# Rebuild backend + worker images (after requirements.txt or Dockerfile changes)
docker compose -f docker-compose.mac.yml build backend celery-worker

# Pull latest base images (redis, qdrant, etc.)
docker compose -f docker-compose.mac.yml pull

# Full restart
docker compose -f docker-compose.mac.yml down
docker compose -f docker-compose.mac.yml up --build
```

---

## Switching models

Edit `.env`:

```
OLLAMA_MODEL=<model>
NEXT_PUBLIC_OLLAMA_MODEL=<model>
```

| Machine | Recommended model | Notes |
|---------|-------------------|-------|
| Mac | `qwen2.5:7b` | CPU-only inside Docker |
| Desktop (RTX 5060 Ti) | `qwen2.5:7b` | Runs on GPU |

---

## Fresh start (wipe all data)

```bash
docker compose -f docker-compose.mac.yml down -v
```

> `-v` removes all volumes — Postgres, Qdrant, Redis, Ollama models. Use with caution.
> After this, `init-ollama` will re-pull the model on next boot.
