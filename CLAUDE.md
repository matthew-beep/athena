# Athena — Claude Code Context Document
## For AI Agent Reference
*Read this document in full before touching any code.*

---

## What This Project Is

**Athena is a proactive personal operating system.** It is not a chatbot. The organizing primitive is not a conversation — it is a **Project**.

You define goals. Athena works on them in the background, keeps its context current with real fetched data, and surfaces findings when your input is actually needed. Chat exists but is demoted — it is a tool for refining goals or asking follow-ups, not the primary mode of work.

The core shift: most AI tools are reactive and stateless. They wait to be asked. Athena is push-based and persistent. It works while you're doing other things.

**What "backed by real data" means here:** every meaningful claim traces to a source fetched at research time, not recalled from training. When data is uncertain, Athena says so. You can see exactly where any piece of information came from.

---

## Repository Structure

```
athena/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── api/                     # Route handlers
│   │   │   ├── chat.py
│   │   │   ├── documents.py
│   │   │   ├── collections.py
│   │   │   ├── projects.py          # ← to be built
│   │   │   ├── research.py
│   │   │   ├── system.py
│   │   │   └── auth.py
│   │   ├── core/                    # Business logic
│   │   │   ├── router.py            # Intent classification + routing
│   │   │   ├── rag.py               # Vector search + context assembly
│   │   │   ├── ingestion.py         # Document chunking + embedding
│   │   │   ├── research.py          # Multi-stage research pipeline
│   │   │   ├── crawler.py           # Crawl4AI integration
│   │   │   └── context.py           # Context window management
│   │   ├── models/                  # Pydantic schemas
│   │   ├── db/                      # Database clients + queries
│   │   │   ├── postgres.py
│   │   │   ├── qdrant.py
│   │   │   └── redis.py
│   │   ├── tasks/                   # Celery background tasks
│   │   │   ├── ingestion.py
│   │   │   ├── research.py
│   │   │   ├── backup.py
│   │   │   └── maintenance.py
│   │   ├── mcp/                     # MCP client + server
│   │   │   ├── client.py
│   │   │   ├── router.py
│   │   │   └── servers/
│   │   └── utils/
│   ├── sql/
│   │   ├── schema.sql               # Full PostgreSQL schema
│   │   └── migrations/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── celeryconfig.py
├── frontend/
│   ├── components/
│   │   ├── chat/
│   │   ├── projects/                # ← to be built
│   │   ├── research/
│   │   ├── documents/
│   │   └── settings/
│   ├── stores/
│   ├── hooks/
│   ├── api/
│   └── app/                        # Next.js App Router
├── docker-compose.yml
├── docker-compose.mac.yml
├── .env.example
└── nginx.conf
```

---

## Architecture

### Services (Docker Compose)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| backend | custom | 8000 | FastAPI application |
| frontend | custom | 3000 | React application |
| qdrant | qdrant/qdrant | 6333 | Vector database |
| postgres | paradedb/paradedb:latest-pg16 | 5432 | Relational DB + BM25 (pg_search) |
| redis | redis:7-alpine | 6379 | Cache + Celery broker |
| ollama | ollama/ollama | 11434 | Local LLM inference |
| crawl4ai | custom | 11235 | Web scraping |
| nginx | nginx:alpine | 80/443 | Reverse proxy (production only) |

### Three-Tier LLM Architecture

Athena uses three model tiers via Ollama. Never deviate from this without explicit instruction:

| Tier | Model | Quantization | VRAM | RAM | Speed | When to Use |
|------|-------|-------------|------|-----|-------|-------------|
| 1 | qwen2.5:7b | Q4_K_M | 4 GB | 1 GB | 45-55 tok/s | All interactive queries, routing, classification |
| 2 | qwen2.5:30b | Q5_K_M | 4-9 GB | 2-7 GB | 8-20 tok/s | Complex reasoning, concept extraction |
| 3 | llama3.1:70b | Q4_K_M | 0 GB | 20 GB | 2-4 tok/s | Research synthesis only, always CPU, always background |

**Critical rules:**
- Tier 1 is always loaded, always reserved 4 GB VRAM
- Tier 3 ALWAYS runs on CPU (num_gpu=0). Never load it on GPU.
- Never load Tier 2 and Tier 3 simultaneously
- Tier 3 is only ever called from background Celery tasks, never from a synchronous request handler

### Hardware Context

```
CPU:    AMD Ryzen 7 7700X (8 cores / 16 threads)
RAM:    96 GB DDR5
GPU:    NVIDIA RTX 5060 Ti
VRAM:   16 GB GDDR7

Storage:
├── 1TB NVMe  → /          (OS, Docker)
├── 4TB NVMe  → /mnt/data  (databases, models, vectors)
└── 8TB HDD   → /mnt/storage (documents, media, backups)
```

---

## Core Concepts

### Projects
A project is a goal with context, constraints, and active tasks attached. The user defines what they're trying to accomplish. Athena figures out what to track, research, and monitor.

Projects are the organizing primitive. **All research sessions, documents, and background tasks are scoped to a project.** Nothing meaningful exists globally — it belongs to a project.

### Background Tasks
Tasks are things Athena runs without being asked — web research, source aggregation, monitoring. Defined per-project, scheduled via Celery beat. Task types: `research`, `monitor`, `aggregate`.

### Surfaces
A surface is a moment where Athena brings something to the user's attention because a decision or review is needed. Not a notification feed — a specific, actionable item. High signal, low noise. Surface types: `finding`, `decision`, `update`.

### Profile
A behavioral model that compounds over time from project activity. Domains, preferences, constraints, working style. Reduces the steering required from the user over time.

### Chat (demoted)
Chat is still present but is a secondary interface. When opened in the context of a project, it scopes RAG to that project's documents. It is for refining goals and asking follow-ups — not the primary way work gets done.

---

## Database

### PostgreSQL Schema (authoritative)

```sql
-- Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    filename VARCHAR(255),
    file_type VARCHAR(50),
    source_url TEXT,
    upload_date TIMESTAMP DEFAULT NOW(),
    content_hash VARCHAR(64),
    chunk_count INTEGER DEFAULT 0,
    word_count INTEGER,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    collection_id VARCHAR(255) REFERENCES collections(collection_id) ON DELETE SET NULL,
    metadata JSONB
);

CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(255) UNIQUE NOT NULL,
    document_id VARCHAR(255) REFERENCES documents(document_id),
    user_id INTEGER REFERENCES users(id),
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    filename_normalized TEXT,
    token_count INTEGER,
    qdrant_point_id VARCHAR(255),
    metadata JSONB
);

-- Collections
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    collection_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects (the organizing primitive)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    goal TEXT NOT NULL,
    constraints TEXT,
    status VARCHAR(50) DEFAULT 'active',   -- active | paused | archived
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE TABLE project_documents (
    project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE CASCADE,
    document_id VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (project_id, document_id)
);

-- Background Tasks (per-project)
CREATE TABLE project_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,       -- research | monitor | aggregate
    description TEXT,
    schedule VARCHAR(100),               -- cron expression or null for one-off
    status VARCHAR(50) DEFAULT 'pending', -- pending | running | complete | failed
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    result JSONB,
    celery_task_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Surfaces (proactive output)
CREATE TABLE surfaces (
    id SERIAL PRIMARY KEY,
    surface_id VARCHAR(255) UNIQUE NOT NULL,
    project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE CASCADE,
    surface_type VARCHAR(50) NOT NULL,    -- finding | decision | update
    title VARCHAR(255),
    body TEXT,
    source_task_id VARCHAR(255) REFERENCES project_tasks(task_id),
    status VARCHAR(50) DEFAULT 'unread', -- unread | read | acted | dismissed
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    metadata JSONB
);

-- Conversations (scoped to project or standalone)
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    title VARCHAR(255),
    token_count INTEGER DEFAULT 0,
    summary TEXT,
    summarized_up_to_id VARCHAR(255),
    mode VARCHAR(20) DEFAULT 'general',
    metadata JSONB
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    model_used VARCHAR(100),
    rag_sources JSONB,
    metadata JSONB
);

CREATE TABLE conversation_documents (
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    document_id VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (conversation_id, document_id)
);

-- Research Sessions (project-scoped)
CREATE TABLE research_sessions (
    id SERIAL PRIMARY KEY,
    research_id VARCHAR(255) UNIQUE NOT NULL,
    project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE SET NULL,
    topic VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    approval_required BOOLEAN DEFAULT TRUE,
    approved_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    search_queries TEXT[],
    urls_scraped TEXT[],
    sources_processed INTEGER DEFAULT 0,
    synthesis_text TEXT,
    synthesis_model VARCHAR(100),
    metadata JSONB
);
```

### Qdrant

One collection: `athena_knowledge`

```python
VectorParams(size=768, distance=Distance.COSINE)

# Point payload structure
{
    "document_id": "doc_123",
    "chunk_id": "chunk_456",
    "chunk_index": 0,
    "user_id": 1,
    "filename": "example.pdf",
    "normalized_filename": "example",
    "source_type": "pdf",        # pdf | web | video | research
    "created_at": "2026-04-01T10:00:00Z"
}
```

Embedding model: `nomic-embed-text` via Ollama (768 dimensions). Text is NOT stored in Qdrant — `chunk_id` bridges back to `document_chunks` in Postgres.

BM25 index: ParadeDB `pg_search` extension on `document_chunks(chunk_id, text, filename_normalized)`.

---

## API Endpoints

All prefixed with `/api/`. Auth via JWT Bearer token.

### Projects (to be built)

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
PUT    /api/projects/{project_id}
DELETE /api/projects/{project_id}

GET    /api/projects/{project_id}/documents
POST   /api/projects/{project_id}/documents        # { document_ids: list }
DELETE /api/projects/{project_id}/documents/{id}

GET    /api/projects/{project_id}/tasks
POST   /api/projects/{project_id}/tasks
DELETE /api/projects/{project_id}/tasks/{task_id}

GET    /api/projects/{project_id}/surfaces
POST   /api/projects/{project_id}/surfaces/{surface_id}/dismiss
POST   /api/projects/{project_id}/surfaces/{surface_id}/act
```

### Chat (existing)

```
POST /api/chat
Body: {
    "message": str,
    "conversation_id": str | null,
    "document_ids": list[str],
    "search_all": bool,
    "knowledge_tier": "ephemeral" | "persistent"
}
Response: SSE stream — token events + done event with rag_sources

GET /api/chat/conversations
GET /api/chat/conversations/{id}/messages
GET /api/chat/{id}/documents
POST /api/chat/{id}/documents      # batch attach
DELETE /api/chat/{id}/documents/{doc_id}
```

### Documents (existing)

```
POST /api/documents/upload           # multipart, files + urls
GET  /api/documents                  # ?search=&limit=&offset=&collection_id=&file_type=
GET  /api/documents/{id}
DELETE /api/documents/{id}
GET  /api/documents/{id}/progress
GET  /api/documents/progress/active  # bulk active progress
GET  /api/documents/{id}/conversations
```

### Collections (existing)

```
GET    /api/collections
POST   /api/collections
PUT    /api/collections/{id}
DELETE /api/collections/{id}
POST   /api/collections/{id}/documents
DELETE /api/collections/{id}/documents
```

### Research (project-scoped, to be built)

```
POST /api/research
Body: { "project_id": str, "topic": str, "require_approval": bool }
POST /api/research/{research_id}/approve
POST /api/research/{research_id}/cancel
GET  /api/research/{research_id}/status
GET  /api/research/{research_id}/synthesis

WebSocket: /ws/research/{research_id}
```

### System (existing)

```
GET /api/system/health
GET /api/system/resources
GET /api/system/models
GET /metrics
```

---

## Context Window Management

Every chat request must manage context carefully:

1. Load conversation history from PostgreSQL
2. Embed current message → search Qdrant for relevant chunks (top 4-6)
3. If project-scoped: filter RAG to project documents only
4. Build system prompt with RAG context injected
5. Check token budget — trim oldest history messages if over limit
6. Send assembled messages array to Ollama with streaming
7. Stream tokens to client via SSE
8. Save complete response to PostgreSQL

### Token Budget

```
Total context (7B model): ~4,096 tokens
├── System prompt:         500 tokens (reserved)
├── RAG sources:           1,500 tokens (trim chunks if needed)
├── Conversation history:  1,500 tokens (drop oldest if over)
├── Current message:       500 tokens
└── Generation buffer:     596 tokens
```

When history exceeds budget, summarize oldest messages — do not drop them. Summary preserves topics and decision points. Never summarize the 4 most recent exchanges.

---

## The Router

Runs on every message before any response is generated. Uses Tier 1 model. Three-step process: intent classification → tool selection → validation + fallback.

When confidence is below 0.7, default to `rag_search + general_chat`.

```python
class IntentType(str, Enum):
    RAG_QUERY = "rag_query"
    GENERAL_CHAT = "general_chat"
    RESEARCH_REQUEST = "research"
    SERVICE_CONTROL = "service"
    SYSTEM_QUERY = "system"
    MULTI_INTENT = "multi"

# Router output schema
{
    "intent": str,
    "confidence": float,       # 0.0-1.0
    "tools_needed": list[str],
    "rag_needed": bool,
    "tier_required": int,      # 1, 2, or 3
    "reasoning": str
}
```

---

## Research Pipeline

Must run as Celery background tasks. Must send progress via WebSocket. Never block a synchronous request handler. All research sessions belong to a project.

### Stages

```
Stage 1: Data Collection (~30-60s)
- Web search via SerpAPI (skip gracefully if SERP_API_KEY not set)
- Scrape URLs via Crawl4AI
- No LLM used in this stage

Stage 2: Fast Filtering (~20-40s)
- Use Tier 1 (7B) to summarize each source (100 words max)
- Score relevance 0.0-1.0 per source
- Discard sources below 0.6 relevance

Stage 3: Knowledge Base Check (<1s)
- Embed research topic → search Qdrant
- If similarity > 0.85: skip synthesis, return existing knowledge
- If 0.6-0.85: augment mode
- If < 0.6: full synthesis mode

Stage 4: Deep Synthesis (~60-120s)
- Only if Stage 3 requires it
- Tier 3 (70B, CPU only, num_gpu=0)
- Output: comprehensive synthesis with citations

Stage 5: Knowledge Ingestion
- Chunk synthesis + source content
- Embed → Qdrant
- Metadata → PostgreSQL
- Create Surface on project with type=finding
- Update research_session status to complete
```

---

## Storage

All paths are environment-variable driven. Never hardcode paths.

```bash
ATHENA_HOT_BASE=/mnt/data/athena
QDRANT_STORAGE_PATH=${ATHENA_HOT_BASE}/qdrant_storage
POSTGRES_DATA_PATH=${ATHENA_HOT_BASE}/postgres_data
OLLAMA_MODELS_PATH=${ATHENA_HOT_BASE}/models
REDIS_DATA_PATH=${ATHENA_HOT_BASE}/redis_data

ATHENA_BULK_BASE=/mnt/storage/athena
UPLOADS_PATH=${ATHENA_BULK_BASE}/uploads
PROCESSED_PATH=${ATHENA_BULK_BASE}/processed
RESEARCH_ARCHIVE_PATH=${ATHENA_BULK_BASE}/research_archives
BACKUP_PATH=${ATHENA_BULK_BASE}/backups
```

Storage stats are always cached — never computed on request. Celery beat refreshes every 5 minutes, result stored in Redis.

---

## Celery Tasks and Cron Jobs

```python
CELERYBEAT_SCHEDULE = {
    "refresh-storage-stats": {
        "task": "tasks.maintenance.refresh_storage_stats",
        "schedule": crontab(minute="*/5")
    },
    "daily-postgres-backup": {
        "task": "tasks.backup.backup_postgres",
        "schedule": crontab(hour=2, minute=0)
    },
    "weekly-qdrant-snapshot": {
        "task": "tasks.backup.snapshot_qdrant",
        "schedule": crontab(hour=3, minute=0, day_of_week=0)
    },
    "cleanup-old-backups": {
        "task": "tasks.backup.cleanup_old_backups",
        "schedule": crontab(hour=5, minute=0)
    },
    # Per-project background tasks are scheduled dynamically
    # at project task creation time, not via beat schedule
}
```

---

## MCP Integration

MCP servers are optional. Core Athena must work without any MCP connections.

```python
class MCPServer:
    name: str
    endpoint: str
    enabled: bool
    tools: list[MCPTool]

class MCPTool:
    name: str
    description: str    # used by router for tool selection
    parameters: dict    # JSON schema
```

**Planned MCP servers (not yet built):**
- `jellyfin` — media control
- `home_automation` — device control
- `seafile` — file access

---

## Frontend Structure

React 18 + TypeScript + Tailwind CSS + Next.js App Router. Structural Glass design system (tokens defined in `globals.css`).

### Tab Structure

```
Projects (default) → Chat → Research → Documents → Settings
```

Projects is the primary view — a dashboard of active projects and their surfaces. Chat is secondary. Knowledge Graph and Quizzes are removed from the tab bar.

### Chat Requirements

- SSE for token streaming
- Optimistic UI — show user message immediately on send
- Source citations collapsible below each response with inline `[n]` chips rendered as clickable components
- Per-message source selection: clicking an assistant bubble updates the DocumentBar to show that message's RAG sources
- Model tier badge on each response
- Conversation list scoped to project when opened from project context

### Persistent Footer

Always visible:
```
NVMe [████░░] 7%    HDD [███░░░░] 16%    CPU 12%    GPU 4.2/16GB
```

---

## Environment Variables

```bash
# Database
DB_PASSWORD=changeme
POSTGRES_DB=athena
POSTGRES_USER=athena

# Service hosts (internal Docker network names)
OLLAMA_HOST=ollama
QDRANT_HOST=qdrant
REDIS_HOST=redis
POSTGRES_HOST=postgres

# Storage paths
ATHENA_HOT_BASE=/mnt/data/athena
ATHENA_BULK_BASE=/mnt/storage/athena

# Optional external services
SERP_API_KEY=                    # leave empty to disable web search

# MCP (all optional)
JELLYFIN_URL=
JELLYFIN_API_KEY=
HOME_AUTO_URL=
SEAFILE_URL=
SEAFILE_API_KEY=

# App config
LOG_LEVEL=INFO
MAX_UPLOAD_SIZE_MB=500
CONTEXT_WINDOW_TOKENS=4096
RAG_TOP_K=6
```

---

## Implementation Phases

Build in this order.

### Phase 1: Foundation ← COMPLETE
- Docker Compose stack (Postgres/ParadeDB, Qdrant, Redis, Celery, Ollama, Crawl4AI)
- Document upload → chunking → embedding → Qdrant
- Hybrid search (vector + BM25 via pg_search, RRF fusion)
- Basic chat with RAG, SSE streaming
- Conversation history in PostgreSQL
- Auth (JWT)
- Collections

### Phase 2: Document Processing ← ~75% COMPLETE
- Sentence-aware chunking ✓
- URL scraping via Crawl4AI ✓
- Background processing via Celery ✓
- Progress tracking via Redis ✓
- Missing: video transcription (Faster-Whisper), Docling for better PDF/DOCX extraction

### Phase 3: Chat Refinement ← IN PROGRESS
- Inline `[n]` citation chips (remark plugin → SourceItem component)
- Per-message source selection in DocumentBar
- `selectedMessageId` per-conversation state in chat store
- Sidebar and conversation list polish

### Phase 4: Projects Layer ← NEXT
- `projects`, `project_documents`, `project_tasks`, `surfaces` tables + schema migration
- Projects CRUD API (`api/projects.py`)
- Project dashboard UI — primary view, replaces conversation list as homepage
- Wire documents to projects (project_documents join)
- Wire research sessions to projects (project_id FK)
- When chat opened from project context, RAG scopes to project documents

**Exit criteria:** User can create a project, attach documents, and open a scoped chat that only retrieves from those documents.

### Phase 5: Background Tasks
- `project_tasks` Celery scheduling — dynamic per-project schedules
- Task types: `research` (run research pipeline for topic), `monitor` (check URL for changes), `aggregate` (collect sources on schedule)
- Task management UI within project view
- Task run history

### Phase 6: Surfaces
- Surface creation from background task output (research complete → surface of type `finding`)
- Surface inbox UI — list of unread surfaces per project
- Dismiss / act / read state transitions
- Surface detail view

### Phase 7: Research Pipeline (project-scoped)
- Full 5-stage Celery pipeline
- Project-scoped: research sessions belong to a project, findings create surfaces
- WebSocket progress updates
- Approval flow before execution
- Stage 4: Tier 3 CPU-only synthesis

### Phase 8: Profile
- User behavioral model — domains, preferences, constraints
- Populated incrementally from project activity
- Informs background task priorities and surface ranking

### Phase 9: MCP Integration
- MCP connection manager
- Router uses tool descriptions for selection
- First server: Jellyfin or home automation

### Phase 10: Production Polish
- Prometheus metrics
- Celery beat backup jobs
- Storage stats Celery task + Redis cache
- Full environment variable configuration
- Nginx + Docker Compose deployment

---

## What NOT to Build

Do not implement any of the following until explicitly instructed:

- **Quiz / spaced repetition** — removed from scope entirely
- **Two-tier knowledge model / promotion flow** — superseded by Projects
- **Knowledge graph as top-level feature** — may revisit as a project-scoped view later, not now
- **Authentication beyond current JWT** — no multi-user, no OAuth
- **Mobile native app**
- **Cloud sync or backup**
- **Voice interface**
- **Image generation**
- **Model fine-tuning**
- **Collaborative features**
- **Email or push notifications**
- **Athena as an MCP server**

---

## Code Standards

- **Python:** Type hints everywhere. Async/await throughout. Pydantic v2 for all schemas.
- **Error handling:** Never swallow exceptions silently. Log with loguru. Return structured error responses.
- **Environment variables:** Never hardcode credentials, paths, or hosts.
- **Database queries:** Use parameterized queries. Never string-format SQL.
- **Background tasks:** All long-running operations go through Celery. Never block a request handler.
- **Logging:** Structured JSON logs via loguru. Include request_id, conversation_id, latency_ms where relevant.

---

## Key Constraints — Never Violate

1. Tier 3 model always runs with `num_gpu=0`. Always CPU. Never GPU.
2. Storage stats are always cached — never computed on request.
3. The router always runs before any LLM call in the chat pipeline.
4. Research pipeline always requires user approval before executing (unless `require_approval=False` explicitly passed).
5. All paths read from environment variables. No hardcoded paths.
6. Never load Tier 2 and Tier 3 models simultaneously.
7. All research sessions must have a `project_id`. Standalone research sessions are not allowed.
