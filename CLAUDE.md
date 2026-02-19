# Athena — Claude Code Context Document
## For AI Agent Reference
*Read this document in full before touching any code.*

---

## What This Project Is

You are working on **Athena**, a self-hosted personal AI infrastructure platform. Athena is not a generic chatbot or a simple RAG application. It is a persistent, compounding intelligence layer that:

- Remembers every conversation and compounds knowledge over time
- Builds a behavioral model of how the user learns and thinks
- Autonomously researches topics and fills knowledge gaps
- Routes prompts to connected external services via MCP
- Runs entirely on local hardware with no cloud dependencies

The project is a **monorepo** with a Python/FastAPI backend and a React/TypeScript frontend. It is containerized with Docker Compose and designed for single-user self-hosted deployment.

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
│   │   │   ├── research.py
│   │   │   ├── quizzes.py
│   │   │   ├── graph.py
│   │   │   └── system.py
│   │   ├── core/                    # Business logic
│   │   │   ├── router.py            # Intent classification + routing
│   │   │   ├── rag.py               # Vector search + context assembly
│   │   │   ├── ingestion.py         # Document chunking + embedding
│   │   │   ├── research.py          # Multi-stage research pipeline
│   │   │   ├── quiz.py              # Quiz generation + scoring
│   │   │   ├── graph.py             # Knowledge graph operations
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
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   ├── Research/
│   │   │   ├── KnowledgeGraph/
│   │   │   ├── Quizzes/
│   │   │   ├── Documents/
│   │   │   └── Settings/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── api/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
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
| postgres | postgres:16-alpine | 5432 | Relational database |
| redis | redis:7-alpine | 6379 | Cache + Celery broker |
| ollama | ollama/ollama | 11434 | Local LLM inference |
| nginx | nginx:alpine | 80/443 | Reverse proxy |

### Three-Tier LLM Architecture

Athena uses three model tiers via Ollama. Never deviate from this without explicit instruction:

| Tier | Model | Quantization | VRAM | RAM | Speed | When to Use |
|------|-------|-------------|------|-----|-------|-------------|
| 1 | qwen2.5:7b | Q4_K_M | 4 GB | 1 GB | 45-55 tok/s | All interactive queries, routing, classification |
| 2 | qwen2.5:30b | Q5_K_M | 4-9 GB | 2-7 GB | 8-20 tok/s | Quiz generation, complex reasoning, concept extraction |
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

## The Most Important Design Decision: Two-Tier Knowledge Model

This is the single most critical concept in Athena. Everything else depends on it being implemented correctly.

### Tier 1: Ephemeral (General Chat)

- Stored in PostgreSQL `conversations` and `messages` tables only
- **NEVER embedded into Qdrant**
- **NEVER triggers concept extraction**
- **NEVER updates the knowledge graph**
- **NEVER updates the learning profile**
- Used only for conversational context within and across sessions

### Tier 2: Persistent (Intentional Knowledge)

Enters the persistent layer through exactly four pathways:

1. User uploads a document (PDF, video URL, web URL)
2. Research pipeline completes and user accepts results
3. User accepts a promotion suggestion from Athena
4. Quiz/review session produces concept mastery data

When content enters persistent tier it triggers the full pipeline:
- Text extraction → chunking (500 tokens, 50 overlap) → embedding → Qdrant
- Concept extraction via Tier 2 model → knowledge graph (PostgreSQL)
- Metadata → PostgreSQL documents table
- Learning profile update if relevant

### The Promotion Flow

When Athena detects engagement signals during ephemeral chat, it offers to promote a topic to persistent knowledge. This appears as a UI card below the assistant response — never inline, never interrupting.

**Engagement signals that trigger promotion offer:**
- 3+ follow-up questions on same topic in one session
- Same topic appears across 2+ separate sessions
- User explicitly says "tell me more" 3+ times
- Quiz score below 60% on a concept repeatedly

**Implementation requirement:** Track these signals in the `learning_signals` table. Check signal thresholds after every assistant response. If threshold met and promotion not already offered this session, include `promotion_suggestion` object in the API response.

---

## Database

### PostgreSQL Schema (authoritative)

```sql
-- Documents (persistent knowledge only)
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255),
    file_type VARCHAR(50),
    source_url TEXT,
    upload_date TIMESTAMP DEFAULT NOW(),
    content_hash VARCHAR(64),
    chunk_count INTEGER DEFAULT 0,
    word_count INTEGER,
    processing_status VARCHAR(50) DEFAULT 'pending',
    knowledge_tier VARCHAR(20) DEFAULT 'persistent',
    metadata JSONB
);

CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(255) UNIQUE NOT NULL,
    document_id VARCHAR(255) REFERENCES documents(document_id),
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER,
    qdrant_point_id VARCHAR(255),
    metadata JSONB
);

-- Conversations (both tiers)
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    title VARCHAR(255),
    knowledge_tier VARCHAR(20) DEFAULT 'ephemeral',
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
    tier_used INTEGER,
    services_invoked TEXT[],
    rag_sources JSONB,
    latency_ms INTEGER,
    metadata JSONB
);

CREATE TABLE promotion_events (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    topic VARCHAR(255),
    offered_at TIMESTAMP DEFAULT NOW(),
    user_response VARCHAR(20),
    research_session_id VARCHAR(255)
);

-- Knowledge Graph (research-scoped only)
CREATE TABLE graph_nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) UNIQUE NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    definition TEXT,
    confidence DECIMAL(4,3) DEFAULT 1.0,
    mention_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_reinforced TIMESTAMP DEFAULT NOW(),
    decay_weight DECIMAL(4,3) DEFAULT 1.0,
    source_research_ids TEXT[],
    properties JSONB
);

CREATE TABLE graph_edges (
    id SERIAL PRIMARY KEY,
    edge_id VARCHAR(255) UNIQUE NOT NULL,
    source_node_id VARCHAR(255) REFERENCES graph_nodes(node_id),
    target_node_id VARCHAR(255) REFERENCES graph_nodes(node_id),
    edge_type VARCHAR(50) NOT NULL,
    weight DECIMAL(4,3) DEFAULT 1.0,
    confidence DECIMAL(4,3) DEFAULT 1.0,
    reinforcement_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_reinforced TIMESTAMP DEFAULT NOW(),
    source_research_ids TEXT[],
    properties JSONB
);

-- Quizzes
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    quiz_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    source_document_ids TEXT[],
    source_research_ids TEXT[],
    question_count INTEGER,
    difficulty VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    question_id VARCHAR(255) UNIQUE NOT NULL,
    quiz_id VARCHAR(255) REFERENCES quizzes(quiz_id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50),
    options JSONB,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    concept_tested VARCHAR(255),
    difficulty_rating DECIMAL(3,2),
    answered_at TIMESTAMP,
    time_taken_seconds INTEGER
);

CREATE TABLE concept_mastery (
    concept_name VARCHAR(255) PRIMARY KEY,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    mastery_percentage DECIMAL(5,2) DEFAULT 0,
    streak_current INTEGER DEFAULT 0,
    streak_best INTEGER DEFAULT 0,
    last_tested TIMESTAMP,
    next_review TIMESTAMP,
    ease_factor DECIMAL(4,3) DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1
);

-- Research
CREATE TABLE research_sessions (
    id SERIAL PRIMARY KEY,
    research_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50),
    trigger_context JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    approval_required BOOLEAN DEFAULT TRUE,
    approved_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    search_queries TEXT[],
    urls_scraped TEXT[],
    sources_processed INTEGER DEFAULT 0,
    sources_accepted INTEGER DEFAULT 0,
    documents_created INTEGER DEFAULT 0,
    concepts_extracted INTEGER DEFAULT 0,
    synthesis_text TEXT,
    synthesis_model VARCHAR(100),
    metadata JSONB
);

-- Behavioral signals
CREATE TABLE learning_signals (
    id SERIAL PRIMARY KEY,
    signal_type VARCHAR(50) NOT NULL,
    topic VARCHAR(255),
    signal_value JSONB,
    recorded_at TIMESTAMP DEFAULT NOW(),
    conversation_id VARCHAR(255),
    session_context JSONB
);

CREATE TABLE topic_engagement (
    topic VARCHAR(255) PRIMARY KEY,
    question_count INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    first_engaged TIMESTAMP DEFAULT NOW(),
    last_engaged TIMESTAMP DEFAULT NOW(),
    avg_question_sophistication DECIMAL(4,3),
    follow_up_rate DECIMAL(4,3),
    promotion_offered INTEGER DEFAULT 0,
    promotion_accepted INTEGER DEFAULT 0,
    quiz_score_avg DECIMAL(5,2)
);
```

### Qdrant

One collection: `athena_knowledge`

```python
VectorParams(size=384, distance=Distance.COSINE)

# Point payload structure
{
    "document_id": "doc_123",
    "chunk_id": "chunk_456",
    "chunk_index": 0,
    "text": "chunk content",
    "source_type": "pdf",        # pdf | web | video | research
    "knowledge_tier": "persistent",
    "research_session_id": None,
    "metadata": {
        "filename": "example.pdf",
        "page": 12,
        "url": None
    },
    "created_at": "2026-02-18T10:00:00Z"
}
```

Embedding model: `nomic-embed-text` via Ollama (384 dimensions)

---

## API Endpoints

All prefixed with `/api/`. No authentication in Phase 1.

### Chat

```
POST /api/chat
Body: {
    "message": str,
    "conversation_id": str | null,   // null = new conversation
    "knowledge_tier": "ephemeral" | "persistent"
}
Response: {
    "message_id": str,
    "conversation_id": str,
    "response": str,
    "model_tier": int,
    "rag_sources": list,
    "services_invoked": list,
    "promotion_suggestion": {         // null if no suggestion
        "topic": str,
        "reason": str
    },
    "latency_ms": int
}

WebSocket: /ws/chat
// Streams tokens. Final message includes full metadata.
// Send: { "message": str, "conversation_id": str, "knowledge_tier": str }
// Receive stream: { "type": "token", "content": str }
// Receive final: { "type": "done", "sources": list, "promotion_suggestion": obj }
```

### Documents

```
POST /api/documents/upload           // multipart/form-data, file field
POST /api/documents/url              // { "url": str }
GET  /api/documents                  // ?limit=20&offset=0&status=str
GET  /api/documents/{document_id}
DELETE /api/documents/{document_id}
GET  /api/documents/{document_id}/status
```

### Research

```
POST /api/research
Body: { "topic": str, "trigger": str, "max_sources": int, "require_approval": bool }
Response: { "research_id": str, "status": str, "proposed_plan": obj }

POST /api/research/{research_id}/approve
POST /api/research/{research_id}/cancel
GET  /api/research/{research_id}/status
GET  /api/research                   // ?status=str&limit=int
GET  /api/research/{research_id}/synthesis

WebSocket: /ws/research/{research_id}
// Server pushes stage updates throughout pipeline execution
```

### Quizzes

```
POST /api/quizzes/generate
Body: { "source_ids": list, "question_count": int, "difficulty": str, "question_types": list }

GET  /api/quizzes/{quiz_id}
POST /api/quizzes/{quiz_id}/answer
Body: { "question_id": str, "answer": str }

GET  /api/quizzes/{quiz_id}/results
GET  /api/quizzes/due                // spaced repetition queue
GET  /api/concepts/mastery
GET  /api/concepts/weak
```

### Knowledge Graph

```
GET  /api/graph/nodes                // ?type=str&limit=int
GET  /api/graph/edges                // ?source_id=str
GET  /api/graph/visualize            // full graph for D3
GET  /api/graph/related              // ?concept=str&depth=int
GET  /api/graph/gaps
```

### System

```
GET  /api/system/health
GET  /api/system/storage
GET  /api/system/resources
GET  /api/system/models
GET  /metrics                        // Prometheus metrics
```

---

## Context Window Management

Every chat request must manage context carefully. The request lifecycle:

1. Load conversation history from PostgreSQL
2. Embed current message → search Qdrant for relevant chunks (top 4-6)
3. Build system prompt with RAG context injected
4. Check token budget — trim oldest history messages if over limit
5. Send assembled messages array to Ollama with streaming
6. Stream tokens to client via SSE or WebSocket
7. Save complete response to PostgreSQL
8. Check engagement signals → determine if promotion should be offered
9. Return final metadata with response

### Token Budget

```
Total context (7B model): ~8,192 tokens
├── System prompt:         1,000 tokens (reserved)
├── RAG sources:           2,000 tokens (trim chunks if needed)
├── Conversation history:  3,500 tokens (drop oldest if over)
├── Current message:         500 tokens
└── Generation buffer:     1,192 tokens
```

### Summarization

When conversation history exceeds budget, compress oldest messages:

```python
# Do not drop messages — summarize them
# Summary goes at top of history as a special system context block
# Summary must preserve: topics discussed, follow-up counts, engagement signals
# Never summarize the 4 most recent exchanges
```

---

## The Router

The router runs on every message before any response is generated. It is a three-step process using the Tier 1 model:

**Step 1: Intent classification**
**Step 2: Tool selection reasoning**
**Step 3: Validation + fallback**

The router must never be a simple pattern matcher. It uses structured prompting to reason about intent. When confidence is below 0.7, default to `rag_search + general_chat`.

### Intent Types

```python
class IntentType(str, Enum):
    RAG_QUERY = "rag_query"
    GENERAL_CHAT = "general_chat"
    RESEARCH_REQUEST = "research"
    QUIZ_REQUEST = "quiz"
    SERVICE_CONTROL = "service"
    SYSTEM_QUERY = "system"
    MULTI_INTENT = "multi"
```

### Router Output Schema

```python
{
    "intent": str,
    "confidence": float,       # 0.0-1.0
    "tools_needed": list[str],
    "rag_needed": bool,
    "tier_required": int,      # 1, 2, or 3
    "reasoning": str
}
```

### Routing Rules

| Query type | Tier | RAG | Tools |
|-----------|------|-----|-------|
| Simple factual | 1 | Yes | none |
| Complex reasoning | 2 | Yes | none |
| Research request | 1 (route) | No | research_pipeline |
| Quiz generation | 2 | Yes | quiz_engine |
| Home automation | 1 | No | home_auto_mcp |
| Jellyfin control | 1 | No | jellyfin_mcp |
| File search | 1 | No | seafile_mcp |
| System/storage | 1 | No | system_info |

---

## Research Pipeline

Must run as Celery background tasks. Must send progress via WebSocket. Never block a synchronous request handler.

### Stages

```
Stage 1: Data Collection (~30-60s)
- Web search via SerpAPI (skip gracefully if SERP_API_KEY not set)
- Scrape URLs via Crawl4AI
- Download videos via yt-dlp if video URLs detected
- Transcribe audio via Faster-Whisper
- No LLM used in this stage

Stage 2: Fast Filtering (~20-40s)
- Use Tier 1 (7B) to summarize each source (100 words max)
- Score relevance 0.0-1.0 per source
- Discard sources below 0.6 relevance
- Output: 3-5 filtered sources

Stage 3: Knowledge Base Check (<1s)
- Embed research topic
- Search Qdrant for existing coverage
- If similarity > 0.85: skip Stage 4, return existing knowledge
- If similarity 0.6-0.85: augment mode
- If similarity < 0.6: full synthesis mode

Stage 4: Deep Synthesis (~60-120s)
- Only runs if Stage 3 requires it
- Use Tier 3 (70B, CPU only, num_gpu=0)
- Input: filtered sources from Stage 2 + existing knowledge from Stage 3
- Output: comprehensive synthesis with citations
- Secondary pass: extract concepts and relationships for graph

Stage 5: Knowledge Ingestion
- Chunk synthesis + source content
- Embed → Qdrant
- Concepts + edges → PostgreSQL graph tables
- Update research_session status to complete
```

### WebSocket Progress Events

```json
{"stage": 1, "status": "running", "message": "Collecting sources..."}
{"stage": 1, "status": "complete", "sources_found": 8}
{"stage": 2, "status": "running", "message": "Filtering 8 sources..."}
{"stage": 2, "status": "complete", "sources_kept": 4}
{"stage": 3, "status": "running", "message": "Checking knowledge base..."}
{"stage": 3, "status": "complete", "coverage": 0.2, "mode": "full_synthesis"}
{"stage": 4, "status": "running", "message": "Synthesizing... ~90 seconds"}
{"stage": 4, "status": "complete"}
{"stage": 5, "status": "running", "message": "Ingesting into knowledge base..."}
{"stage": 5, "status": "complete", "chunks_added": 47, "concepts_added": 12}
{"status": "complete", "research_id": "res_789"}
```

---

## Knowledge Graph

**Scope: research-scoped only.**

The graph is populated exclusively by:
- Completed research pipeline sessions (Stage 4 concept extraction)
- Quiz/review sessions (concept mastery data)
- Explicit document uploads

It is **never** populated by general chat or ephemeral conversations.

### Concept Extraction Prompt (Tier 2)

After research synthesis, run this extraction pass:

```
From this research synthesis, extract key concepts and relationships.

For each concept:
- name: short canonical name
- definition: 1-2 sentences
- importance: 1-10
- node_type: concept | technique | tool | person | paper

For each relationship:
- source: concept name
- target: concept name
- type: requires | relates_to | part_of | contradicts | extends | used_in
- confidence: 0.0-1.0

Synthesis: {synthesis_text}

Respond in JSON only. No preamble.
```

### Graph Decay

Weekly Celery job. Nodes not reinforced in 90 days lose 10% decay_weight per week. Minimum weight 0.1 — never fully delete. Nodes reinforced by correct quiz answers gain weight. Update `last_reinforced` and `decay_weight` fields.

---

## Storage

All paths are environment-variable driven. Never hardcode paths.

```bash
# Hot storage — NVMe, latency sensitive
ATHENA_HOT_BASE=/mnt/data/athena
QDRANT_STORAGE_PATH=${ATHENA_HOT_BASE}/qdrant_storage
POSTGRES_DATA_PATH=${ATHENA_HOT_BASE}/postgres_data
OLLAMA_MODELS_PATH=${ATHENA_HOT_BASE}/models
REDIS_DATA_PATH=${ATHENA_HOT_BASE}/redis_data

# Bulk storage — HDD, large files
ATHENA_BULK_BASE=/mnt/storage/athena
UPLOADS_PATH=${ATHENA_BULK_BASE}/uploads
PROCESSED_PATH=${ATHENA_BULK_BASE}/processed
RESEARCH_ARCHIVE_PATH=${ATHENA_BULK_BASE}/research_archives
BACKUP_PATH=${ATHENA_BULK_BASE}/backups
```

### Storage Stats API

Cache directory size calculations — never compute on-demand. Refresh every 5 minutes via Celery beat. Cache result in Redis.

---

## Celery Tasks and Cron Jobs

```python
# celeryconfig.py beat schedule
CELERYBEAT_SCHEDULE = {
    # Storage stats cache refresh
    "refresh-storage-stats": {
        "task": "tasks.maintenance.refresh_storage_stats",
        "schedule": crontab(minute="*/5")
    },
    # Daily PostgreSQL backup
    "daily-postgres-backup": {
        "task": "tasks.backup.backup_postgres",
        "schedule": crontab(hour=2, minute=0)
    },
    # Weekly Qdrant snapshot
    "weekly-qdrant-snapshot": {
        "task": "tasks.backup.snapshot_qdrant",
        "schedule": crontab(hour=3, minute=0, day_of_week=0)
    },
    # Weekly graph decay
    "weekly-graph-decay": {
        "task": "tasks.maintenance.apply_graph_decay",
        "schedule": crontab(hour=4, minute=0, day_of_week=0)
    },
    # Cleanup old backups (keep 30 days)
    "cleanup-old-backups": {
        "task": "tasks.backup.cleanup_old_backups",
        "schedule": crontab(hour=5, minute=0)
    }
}
```

---

## MCP Integration

MCP servers are optional. Core Athena must work without any MCP connections.

```python
# Each MCP server is dynamically discovered at connection time
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

The router uses tool descriptions to decide when to invoke MCP. No hardcoded tool logic.

**Planned MCP servers (not yet built):**
- `jellyfin` — media control
- `home_automation` — device control
- `seafile` — file access

---

## Frontend Structure

React 18 + TypeScript + Tailwind CSS + Vite. Deployed as PWA.

### Tab Structure

```
Chat (default) → Document Questions → Research → Knowledge Graph → Quizzes → Documents → Settings
```

### Chat Requirements

- SSE for token streaming (not WebSocket — SSE is sufficient for one-way streaming)
- WebSocket for research pipeline progress (bidirectional — user can cancel)
- Optimistic UI — show user message immediately on send
- Promotion suggestion renders as a card below assistant message, never inline
- Source citations collapsible below each response
- Model tier badge on each response: "Tier 1 · 7B · 1.8s"
- Conversation list in left sidebar
- Ephemeral/persistent indicator per conversation

### Persistent Footer

Always visible. Shows at a glance:
```
NVMe [████░░] 7%    HDD [███░░░░] 16%    CPU 12%    GPU 4.2/16GB
```

---

## Environment Variables

All required variables. Document every addition to `.env.example`:

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
CONTEXT_WINDOW_TOKENS=8192
RAG_TOP_K=6
PROMOTION_SIGNAL_THRESHOLD=3
```

---

## Implementation Phases

Build in this order. Do not start a phase until the previous phase's exit criteria are met.

### Phase 1: Foundation ← START HERE
- Docker Compose stack running all services
- Document upload → chunking → embedding → Qdrant
- Basic chat with RAG (Tier 1 only)
- Conversation history in PostgreSQL
- Document list UI

**Exit criteria:**
- Upload PDF → ask questions → get accurate answers
- Restart containers → conversation history survives
- GPU active during inference (check nvidia-smi)

### Phase 2: Document Processing
- Smart chunking (sentence-aware)
- Video transcription via Faster-Whisper
- Web URL scraping via Crawl4AI
- Background processing via Celery
- Processing status UI

### Phase 3: Learning Features
- Quiz generation via Tier 2
- Quiz UI
- Concept mastery tracking
- SM-2 spaced repetition
- Weak area identification

### Phase 4: Two-Tier Knowledge Model
- Ephemeral conversation tier
- Promotion suggestion UI component
- Engagement signal tracking
- Promotion acceptance pipeline

### Phase 5: Research Pipeline
- Full multi-stage pipeline via Celery
- Research approval UI
- WebSocket progress updates
- Stage 3 knowledge base check
- Tier 3 CPU-only synthesis

### Phase 6: Knowledge Graph
- Concept extraction from research
- Graph persistence
- D3.js visualization
- Graph decay job

### Phase 7: Router + MCP
- ReAct router implementation
- MCP connection manager
- First MCP server (Jellyfin or home automation)

### Phase 8: Production Polish
- Prometheus metrics
- Automated backups
- Full environment variable configuration
- Docker Compose deployment documentation

---

## What NOT to Build

Do not implement any of the following until explicitly instructed:

- Authentication or multi-user support
- Mobile native app
- Cloud sync or backup
- Athena as an MCP server (exposing Athena to external tools)
- Voice interface
- Image generation
- Model fine-tuning
- Collaborative features
- Email or push notifications
- Paid tiers or SaaS features

---

## Code Standards

- **Python:** Type hints everywhere. Async/await throughout. Pydantic v2 for all schemas.
- **Error handling:** Never swallow exceptions silently. Log with loguru. Return structured error responses.
- **Environment variables:** Never hardcode credentials, paths, or hosts. Always read from environment with sensible defaults.
- **Database queries:** Use parameterized queries. Never string-format SQL.
- **Background tasks:** All long-running operations go through Celery. Never block a request handler.
- **Logging:** Structured JSON logs via loguru. Include request_id, conversation_id, latency_ms on every log line where relevant.
- **Testing:** Write tests for core business logic (router, chunking, RAG assembly, promotion signal detection). Not required for API route handlers in Phase 1.

---

## Key Constraints to Never Violate

1. Tier 3 model always runs with `num_gpu=0`. Always CPU. Never GPU.
2. Ephemeral conversations never enter Qdrant.
3. Storage stats are always cached — never computed synchronously.
4. The router always runs before any LLM call in the chat pipeline.
5. Research pipeline always requires user approval before executing (unless `require_approval=False` explicitly passed).
6. All paths read from environment variables. No hardcoded paths.
7. Never load Tier 2 and Tier 3 models simultaneously.
