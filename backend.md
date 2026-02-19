# Athena — Backend Implementation Guide

## Purpose

This document is a practical, phase-by-phase implementation guide for the Athena backend. Read CLAUDE.md first for the authoritative spec. This document translates that spec into actionable build steps.

--- Phase-by-Phase Breakdown

  Phase 1: Foundation (Start Here)

  Goal: Upload PDF → ask questions → get answers. Survives restart.

  Key concepts to implement:

  Concept: Docker Compose
  Approach: Wire up 7 services: FastAPI, React, Qdrant, Postgres, Redis, Ollama, Nginx. Mount volumes to /mnt/data and
    /mnt/storage.
  ────────────────────────────────────────
  Concept: Project structure
  Approach: Create the full monorepo layout from CLAUDE.md — backend/app/api/, core/, models/, db/, etc.
  ────────────────────────────────────────
  Concept: Document ingestion
  Approach: PDF → text extraction (pypdf) → chunking (500 tokens, 50 overlap, sentence-aware) → nomic-embed-text via
    Ollama (384-dim) → Qdrant collection athena_knowledge
  ────────────────────────────────────────
  Concept: PostgreSQL schema
  Approach: Run schema.sql — creates documents, document_chunks, conversations, messages, learning_signals, etc.
  ────────────────────────────────────────
  Concept: Basic RAG chat
  Approach: Embed query → Qdrant top-K → assemble context → Tier 1 (qwen2.5:7b) → return response
  ────────────────────────────────────────
  Concept: Conversation history
  Approach: Store every message in messages table. Load history per conversation_id on each request.
  ────────────────────────────────────────
  Concept: Embedding model change
  Approach: Switch from sentence-transformers to nomic-embed-text via Ollama API. Collection name: athena_knowledge.
  ────────────────────────────────────────
  Concept: Context window mgmt
  Approach: Implement the token budget (system 1k, RAG 2k, history 3.5k, message 500). Summarize oldest messages when
    over budget — never drop them.

  Exit criteria: Upload PDF, ask about it, restart Docker, history still there, GPU active.

  ---
  Phase 2: Document Processing

  Concept: Smart chunking
  Approach: Sentence-aware splitting (spaCy or nltk) instead of naive character splits. 500 tokens, 50 token overlap.
  ────────────────────────────────────────
  Concept: Web URL scraping
  Approach: Crawl4AI library. POST to /api/documents/url. Background Celery task.
  ────────────────────────────────────────
  Concept: Video transcription
  Approach: yt-dlp to download audio, Faster-Whisper for transcription. Store transcript as chunks.
  ────────────────────────────────────────
  Concept: Celery workers
  Approach: Redis as broker. tasks/ingestion.py handles all processing. API returns task_id immediately, client polls
    status.
  ────────────────────────────────────────
  Concept: Processing status UI
  Approach: Frontend polls /api/documents/{id}/status and shows progress bar.

  ---
  Phase 3: Learning Features

  Concept: Quiz generation
  Approach: RAG: pull relevant chunks from Qdrant. Send to Tier 2 (qwen2.5:30b). Prompt requests JSON with question,
    options, answer, concept tested, difficulty.
  ────────────────────────────────────────
  Concept: SM-2 spaced repetition
  Approach: Classic SM-2 algorithm on concept_mastery table. ease_factor, interval_days, next_review fields.
    /api/quizzes/due returns overdue items.
  ────────────────────────────────────────
  Concept: Concept mastery tracking
  Approach: After each quiz answer, update concept_mastery row for the concept tested. Calculate mastery %.
  ────────────────────────────────────────
  Concept: Weak area identification
  Approach: Query concepts where mastery_percentage < 60 or streak_current = 0. Expose via /api/concepts/weak.

  ---
  Phase 4: Two-Tier Knowledge Model

  This is the most critical design concept in the whole project.

  Concept: Ephemeral tier
  Approach: Regular chat. Store in Postgres only. Never embed to Qdrant, never extract concepts, never touch the graph.
  ────────────────────────────────────────
  Concept: Engagement signal tracking
  Approach: After every response: increment learning_signals and topic_engagement. Check thresholds (3+ follow-ups,
    cross-session repeats, etc.).
  ────────────────────────────────────────
  Concept: Promotion suggestion
  Approach: If threshold hit and not already offered this session: include promotion_suggestion: {topic, reason} in API
    response JSON. Frontend renders it as a card below the response.
  ────────────────────────────────────────
  Concept: Promotion acceptance pipeline
  Approach: User accepts → triggers full ingestion: embed to Qdrant + concept extraction + graph update + learning
    profile update.

  ---
  Phase 5: Research Pipeline

  Concept: Multi-stage Celery pipeline
  Approach: 5 stages chained as Celery tasks. Each stage emits WebSocket events. Never call from a synchronous handler.
  ────────────────────────────────────────
  Concept: Web search
  Approach: SerpAPI (skip gracefully if SERP_API_KEY not set). Returns URLs.
  ────────────────────────────────────────
  Concept: Crawl4AI
  Approach: Scrapes URLs from Stage 1. Extracts clean text.
  ────────────────────────────────────────
  Concept: Knowledge base check
  Approach: Embed topic → Qdrant similarity search. If >0.85: skip synthesis. 0.6-0.85: augment. <0.6: full synthesis.
  ────────────────────────────────────────
  Concept: Tier 3 synthesis
  Approach: llama3.1:70b with num_gpu=0 (CPU only, uses your 96GB RAM). Only called from background Celery task. Never
    from request handler.
  ────────────────────────────────────────
  Concept: User approval flow
  Approach: Research always requires approval first (require_approval=True default). POST /approve before pipeline
    executes.

  ---
  Phase 6: Knowledge Graph

  Concept: Concept extraction
  Approach: After Tier 3 synthesis: send synthesis text to Tier 2 with the extraction prompt. Returns JSON of nodes +
    edges. Store in graph_nodes / graph_edges.
  ────────────────────────────────────────
  Concept: Graph persistence
  Approach: PostgreSQL (not a graph DB). Nodes have decay_weight, mention_count, last_reinforced. Edges have weight,
    confidence, reinforcement_count.
  ────────────────────────────────────────
  Concept: D3.js visualization
  Approach: Frontend fetches /api/graph/visualize → full node/edge list → render force-directed graph.
  ────────────────────────────────────────
  Concept: Graph decay
  Approach: Weekly Celery beat job. Nodes not reinforced in 90 days: -10% decay_weight per week, minimum 0.1. Correct
    quiz answers reinforce nodes.

  ---
  Phase 7: Router + MCP

  Concept: Intent router
  Approach: Runs on every message before any LLM call. Tier 1 model with structured prompt. Outputs intent, confidence,
    tools_needed, tier_required. Below 0.7 confidence → fallback to rag_search + general_chat.
  ────────────────────────────────────────
  Concept: ReAct pattern
  Approach: The router uses reason-then-act: classify intent → select tools → validate → execute. Not pattern matching.
  ────────────────────────────────────────
  Concept: MCP client
  Approach: Dynamic discovery of connected MCP servers at connection time. Tools described to the router so it can route

    without hardcoded logic.
  ────────────────────────────────────────
  Concept: MCP servers
  Approach: Planned: Jellyfin (media), home automation, Seafile (files). These are separate processes, not built yet.

  ---
  Phase 8: Production Polish

  Concept: Prometheus metrics
  Approach: Expose /metrics. Track: request latency, RAG search time, LLM generation time, Celery queue depth.
  ────────────────────────────────────────
  Concept: Automated backups
  Approach: Celery beat: Postgres dump at 2am daily, Qdrant snapshot weekly, cleanup old backups daily.
  ────────────────────────────────────────
  Concept: Env var hardening
  Approach: Full .env.example, every path/host/credential reads from env. No hardcoded values anywhere.

  ---
  Key Rules to Never Break

  1. Tier 3 = CPU only. Always num_gpu=0. Never GPU.
  2. Ephemeral chat never touches Qdrant. Zero exceptions.
  3. Storage stats always from Redis cache. Never computed on request.
  4. Router runs before every LLM call. No shortcuts.
  5. Research requires user approval before pipeline runs.
  6. Never load Tier 2 and Tier 3 simultaneously.
  7. All paths from env vars. No hardcoded paths.

  ---
  Where to Start Right Now

  The immediate next step is Phase 1 — specifically:

  1. Create the proper folder structure (backend/app/api/, core/, db/, etc.)
  2. Write docker-compose.yml wiring all 7 services
  3. Write backend/sql/schema.sql
  4. Implement core/ingestion.py (chunking + nomic-embed-text + Qdrant)
  5. Implement db/postgres.py, db/qdrant.py, db/redis.py
  6. Implement api/chat.py with basic RAG + conversation history
  7. Minimal frontend with file upload + chat UI

  The prototype files (athena_api.py, etc.) can be archived — the real implementation starts fresh with the proper
  structure.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI (async) |
| Task queue | Celery + Redis broker |
| Vector DB | Qdrant |
| Relational DB | PostgreSQL 16 |
| Cache | Redis |
| LLM inference | Ollama |
| Embedding | nomic-embed-text via Ollama (384-dim) |
| Containerization | Docker Compose |
| Logging | loguru (structured JSON) |
| Schemas | Pydantic v2 |

---

## Phase 1: Foundation

### Goal
Upload PDF → ask questions → get accurate answers. Survives container restart.

### Step 1: Project Structure

Create this layout exactly. Do not deviate.

```
backend/
├── app/
│   ├── main.py                  # FastAPI app entry, lifespan handler
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py              # POST /api/chat, WebSocket /ws/chat
│   │   ├── documents.py         # upload, list, delete
│   │   ├── research.py          # research pipeline endpoints
│   │   ├── quizzes.py           # quiz generation + answers
│   │   ├── graph.py             # knowledge graph queries
│   │   └── system.py            # health, storage, resources
│   ├── core/
│   │   ├── __init__.py
│   │   ├── router.py            # intent classification (Phase 7)
│   │   ├── rag.py               # vector search + context assembly
│   │   ├── ingestion.py         # chunking + embedding pipeline
│   │   ├── research.py          # multi-stage research pipeline (Phase 5)
│   │   ├── quiz.py              # quiz generation + scoring (Phase 3)
│   │   ├── graph.py             # knowledge graph ops (Phase 6)
│   │   └── context.py           # token budget + history management
│   ├── models/
│   │   ├── __init__.py
│   │   ├── chat.py              # ChatRequest, ChatResponse, Message
│   │   ├── documents.py         # Document, Chunk schemas
│   │   ├── research.py          # ResearchSession schemas
│   │   └── system.py            # SystemStats
│   ├── db/
│   │   ├── __init__.py
│   │   ├── postgres.py          # asyncpg pool + query helpers
│   │   ├── qdrant.py            # Qdrant client + search helpers
│   │   └── redis.py             # Redis client + cache helpers
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── ingestion.py         # Celery task: process document
│   │   ├── research.py          # Celery task: run research pipeline
│   │   ├── backup.py            # Celery task: backup jobs
│   │   └── maintenance.py       # Celery task: storage stats, graph decay
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── client.py            # MCP connection manager (Phase 7)
│   │   ├── router.py            # MCP tool routing
│   │   └── servers/             # individual server integrations
│   └── utils/
│       ├── __init__.py
│       ├── ids.py               # UUID generation helpers
│       └── tokens.py            # token counting utilities
├── sql/
│   ├── schema.sql               # full PostgreSQL schema (authoritative)
│   └── migrations/              # future schema changes
├── tests/
│   ├── test_router.py
│   ├── test_rag.py
│   ├── test_ingestion.py
│   └── test_signals.py
├── requirements.txt
├── Dockerfile
└── celeryconfig.py
```

### Step 2: Docker Compose

All seven services. Mount volumes to the correct storage tiers.

```yaml
# docker-compose.yml (root of monorepo)
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ${UPLOADS_PATH}:/uploads
      - ${PROCESSED_PATH}:/processed
    env_file: .env
    depends_on: [postgres, qdrant, redis, ollama]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]

  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333"]
    volumes:
      - ${QDRANT_STORAGE_PATH}:/qdrant/storage

  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ${POSTGRES_DATA_PATH}:/var/lib/postgresql/data
      - ./backend/sql/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - ${REDIS_DATA_PATH}:/data

  ollama:
    image: ollama/ollama
    ports: ["11434:11434"]
    volumes:
      - ${OLLAMA_MODELS_PATH}:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on: [backend, frontend]

  celery:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    env_file: .env
    depends_on: [redis, postgres, qdrant, ollama]

  celery-beat:
    build: ./backend
    command: celery -A app.tasks beat --loglevel=info
    env_file: .env
    depends_on: [redis]
```

### Step 3: PostgreSQL Schema

Run `backend/sql/schema.sql` at first boot via the `docker-entrypoint-initdb.d` mount above. The full schema is defined in CLAUDE.md. Key tables for Phase 1:

- `documents` — metadata for every uploaded file
- `document_chunks` — individual chunks with Qdrant point IDs
- `conversations` — one row per conversation (ephemeral or persistent tier)
- `messages` — every message exchanged

### Step 4: Database Clients

**`db/postgres.py`**
- Use `asyncpg` for async PostgreSQL
- Create a connection pool in the FastAPI lifespan handler
- Expose `get_db()` as a dependency
- All queries must use parameterized `$1, $2` syntax — never f-strings in SQL

**`db/qdrant.py`**
- Qdrant client wrapping `qdrant-client`
- Collection name: `athena_knowledge` (not `athena_documents` — the prototype used the wrong name)
- Vector size: 384 (nomic-embed-text)
- Distance: COSINE
- Create collection if not exists at startup

**`db/redis.py`**
- `redis.asyncio` client
- Used for: Celery broker, storage stats cache, session data

### Step 5: Embedding Model

**Critical change from prototype:** Stop using `sentence-transformers`. Use `nomic-embed-text` via Ollama.

```python
# core/ingestion.py
import httpx

async def embed(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.OLLAMA_HOST}:11434/api/embed",
            json={"model": "nomic-embed-text", "input": texts}
        )
        return response.json()["embeddings"]
```

Pull the model in your Dockerfile or startup script:
```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
```

### Step 6: Document Ingestion Pipeline

**`core/ingestion.py`** — synchronous chunking logic (called from Celery task)

```
Input: raw text + metadata
Steps:
  1. Clean text (strip boilerplate, normalize whitespace)
  2. Split into sentences (spaCy or nltk sentence tokenizer)
  3. Accumulate sentences into chunks of ~500 tokens with 50-token overlap
  4. Embed all chunks in one batch call to nomic-embed-text
  5. Upsert to Qdrant: include document_id, chunk_id, chunk_index, source_type
  6. Insert chunk rows to PostgreSQL document_chunks table
  7. Update documents.processing_status = 'complete'
```

Token counting: use `tiktoken` (cl100k_base) as a consistent counter. Don't use character counts.

**`tasks/ingestion.py`** — Celery task wrapping the above:

```python
@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str):
    # 1. Fetch document row from postgres
    # 2. Read file from uploads path
    # 3. Extract text (pypdf for PDF, crawl4ai for web, whisper for video)
    # 4. Call core/ingestion.py pipeline
    # 5. Update status
    # On failure: update status to 'failed', log error
```

**`api/documents.py`** — endpoint only creates the DB row and enqueues the task:

```python
@router.post("/documents/upload")
async def upload_document(file: UploadFile, db=Depends(get_db)):
    doc_id = generate_id("doc")
    # Save file to UPLOADS_PATH
    # Insert row: status = 'pending'
    # Enqueue: process_document.delay(doc_id)
    return {"document_id": doc_id, "status": "pending"}
```

### Step 7: RAG Chat

**`core/rag.py`** — context assembly

```python
async def build_rag_context(query: str, top_k: int = 6) -> tuple[list[dict], str]:
    # 1. Embed query
    query_vec = await embed([query])
    # 2. Search Qdrant
    hits = qdrant.search("athena_knowledge", query_vec[0], limit=top_k)
    # 3. Deduplicate by document (don't show two chunks from same doc if nearly identical)
    # 4. Return chunks + assembled context string (max 2000 tokens)
```

**`core/context.py`** — token budget management

```python
TOKEN_BUDGET = {
    "system": 1000,
    "rag": 2000,
    "history": 3500,
    "message": 500,
    "generation": 1192,
}

def assemble_messages(
    system_prompt: str,
    history: list[dict],
    rag_context: str,
    current_message: str,
) -> list[dict]:
    # 1. Count system prompt tokens
    # 2. Count current message tokens
    # 3. Trim RAG context if over 2000 tokens (drop lowest-scoring chunks first)
    # 4. Trim oldest history messages if over 3500 tokens
    #    — Do NOT drop: compress oldest into a summary block first
    #    — Never touch the 4 most recent exchanges
    # 5. Return assembled messages array for Ollama
```

**`api/chat.py`** — SSE streaming endpoint

```python
@router.post("/chat")
async def chat(request: ChatRequest, db=Depends(get_db)):
    # 1. Get or create conversation
    # 2. Load history from postgres
    # 3. Build RAG context (if persistent tier or rag_needed)
    # 4. Assemble messages with token budget
    # 5. Stream from Ollama, yield SSE tokens
    # 6. Save complete response to postgres
    # 7. Check engagement signals
    # 8. Return final metadata (promotion_suggestion if triggered)

    return StreamingResponse(
        stream_chat(assembled_messages, conversation_id),
        media_type="text/event-stream"
    )
```

### Phase 1 Exit Criteria

- [ ] `docker compose up` starts all services cleanly
- [ ] Upload a PDF → status goes from `pending` → `complete`
- [ ] Ask a question about the PDF → get an accurate answer
- [ ] Restart containers → conversation history still in postgres
- [ ] `nvidia-smi` shows GPU active during inference

---

## Phase 2: Document Processing

### Smart Chunking

Replace naive chunking with sentence-aware:

```python
import spacy
nlp = spacy.load("en_core_web_sm")

def chunk_text(text: str, max_tokens: int = 500, overlap: int = 50) -> list[str]:
    doc = nlp(text)
    sentences = [s.text for s in doc.sents]
    # Accumulate sentences, measure tokens, slide window with overlap
```

### Web URL Scraping

Use Crawl4AI:
```python
from crawl4ai import AsyncWebCrawler

async def scrape_url(url: str) -> str:
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)
        return result.markdown  # returns clean text
```

### Video Transcription

```python
# yt-dlp to download audio
# faster-whisper to transcribe
# Result is text — feed into normal ingestion pipeline
```

### Background Processing

All of the above must be Celery tasks. The API endpoint only enqueues. Use task chaining for multi-step jobs:

```python
chain(download_video.s(url), transcribe_audio.s(), ingest_text.s(doc_id))()
```

---

## Phase 3: Learning Features

### Quiz Generation (Tier 2)

```python
# core/quiz.py
async def generate_quiz(source_ids: list[str], count: int, difficulty: str) -> list[Question]:
    # 1. Fetch relevant chunks from Qdrant for each source
    # 2. Assemble context (trim to fit Tier 2 context window)
    # 3. Send to qwen2.5:30b with structured prompt
    # 4. Parse JSON response into Question objects
    # 5. Save to quizzes + quiz_questions tables
```

Prompt structure demands JSON output with: `question_text`, `options` (list), `correct_answer`, `concept_tested`, `difficulty_rating`.

### SM-2 Spaced Repetition

After each quiz answer, update `concept_mastery`:

```python
def update_sm2(mastery: ConceptMastery, is_correct: bool) -> ConceptMastery:
    if is_correct:
        mastery.ease_factor = max(1.3, mastery.ease_factor + 0.1)
        mastery.interval_days = round(mastery.interval_days * mastery.ease_factor)
        mastery.streak_current += 1
    else:
        mastery.ease_factor = max(1.3, mastery.ease_factor - 0.2)
        mastery.interval_days = 1
        mastery.streak_current = 0
    mastery.next_review = now() + timedelta(days=mastery.interval_days)
    return mastery
```

---

## Phase 4: Two-Tier Knowledge Model

### Ephemeral vs Persistent

Every conversation has a `knowledge_tier` field. The tier is set at creation and never changed.

| Tier | Qdrant | Concept extraction | Graph update |
|---|---|---|---|
| ephemeral | NEVER | NEVER | NEVER |
| persistent | YES | YES | YES |

### Engagement Signal Tracking

After every assistant response in ephemeral tier:

```python
async def check_engagement(conversation_id: str, topic: str, db):
    # Upsert into topic_engagement
    # Upsert signal into learning_signals
    # Query: has this topic hit any threshold?
    # Thresholds: 3+ follow-ups same session, 2+ sessions, explicit "tell me more" x3, quiz <60% repeatedly
    # If threshold met and promotion not already offered this session:
    #   return PromotionSuggestion(topic=topic, reason=reason)
    # Else return None
```

Return `promotion_suggestion` in the chat response body — the frontend renders it as a card.

### Promotion Acceptance

When user accepts a promotion:
1. Create a new document row with `source_type="promotion"`
2. Pull all messages about that topic from the conversation
3. Run through the full ingestion pipeline (chunk → embed → Qdrant → concept extraction → graph)

---

## Phase 5: Research Pipeline

### Critical Rules

- Every stage runs as a Celery task. Never block a request handler.
- WebSocket pushes progress events at each stage boundary.
- Always require user approval before Stage 1 begins.
- Tier 3 (`llama3.1:70b`) ALWAYS called with `num_gpu=0`. CPU only.
- Never load Tier 2 and Tier 3 simultaneously.

### Pipeline Structure

```python
# tasks/research.py
@celery_app.task
def stage1_collect(research_id: str):
    # SerpAPI search (skip if key not set)
    # Crawl4AI scrape top URLs
    # yt-dlp + whisper for video URLs
    # Push WS event: {"stage": 1, "status": "complete", "sources_found": N}
    return source_list

@celery_app.task
def stage2_filter(research_id: str, sources: list):
    # For each source: call Tier 1 (7B) to summarize + score relevance
    # Discard below 0.6
    # Push WS event
    return filtered_sources

@celery_app.task
def stage3_check(research_id: str, sources: list):
    # Embed research topic
    # Qdrant similarity search
    # Determine mode: skip / augment / full_synthesis
    # Push WS event
    return {"mode": mode, "sources": sources}

@celery_app.task
def stage4_synthesize(research_id: str, sources: list, mode: str):
    # Only if mode != "skip"
    # Call Tier 3 with num_gpu=0
    # Second pass: concept extraction via Tier 2
    # Push WS event
    return synthesis_text

@celery_app.task
def stage5_ingest(research_id: str, synthesis: str):
    # Run normal ingestion pipeline on synthesis
    # Insert concepts + edges to graph tables
    # Update research_session: status=complete
    # Push WS event: {"status": "complete", "research_id": research_id}
```

Chain them:
```python
pipeline = chain(
    stage1_collect.s(research_id),
    stage2_filter.s(research_id),
    stage3_check.s(research_id),
    stage4_synthesize.s(research_id),
    stage5_ingest.s(research_id),
)
pipeline.apply_async()
```

---

## Phase 6: Knowledge Graph

### Concept Extraction (Tier 2)

After Stage 4 synthesis, run a second Tier 2 call:

```python
EXTRACTION_PROMPT = """
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
"""
```

Parse response → upsert `graph_nodes` and `graph_edges`. Increment `mention_count` and `reinforcement_count` if nodes already exist.

### Graph Decay (Weekly Celery Beat)

```python
@celery_app.task
def apply_graph_decay():
    cutoff = now() - timedelta(days=90)
    # For every node not reinforced since cutoff:
    #   decay_weight = max(0.1, decay_weight * 0.9)
    # Update last_reinforced when a concept is correctly answered in a quiz
```

---

## Phase 7: Router + MCP

### Intent Router

Runs before every LLM call in the chat pipeline.

```python
ROUTER_PROMPT = """
Classify the following user message. Return JSON with:
- intent: one of [rag_query, general_chat, research, quiz, service, system, multi]
- confidence: 0.0-1.0
- tools_needed: list of tool names
- rag_needed: boolean
- tier_required: 1, 2, or 3
- reasoning: one sentence

Message: {message}
Available tools: {tool_list}

JSON only. No preamble.
"""

async def route(message: str, available_tools: list[str]) -> RouterOutput:
    response = await call_ollama(ROUTER_PROMPT, tier=1)
    output = RouterOutput.model_validate_json(response)
    if output.confidence < 0.7:
        output.intent = "rag_query"
        output.rag_needed = True
        output.tier_required = 1
    return output
```

### MCP Client

```python
class MCPConnectionManager:
    def __init__(self):
        self.servers: dict[str, MCPServer] = {}

    async def connect(self, name: str, endpoint: str):
        # Discover tools at connection time
        # Register in self.servers

    async def call_tool(self, server: str, tool: str, params: dict) -> dict:
        # Forward call to MCP server
        # Return result
```

Router uses `tool.description` strings to decide which tool to invoke — no hardcoded logic.

---

## Phase 8: Production Polish

### Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, make_asgi_app

REQUEST_LATENCY = Histogram("athena_request_latency_seconds", "Request latency", ["endpoint"])
LLM_TOKENS = Counter("athena_llm_tokens_total", "Tokens generated", ["tier"])
RAG_SEARCH_TIME = Histogram("athena_rag_search_seconds", "Qdrant search time")

# Mount at /metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

### Celery Beat Schedule

Defined in `celeryconfig.py`:

| Task | Schedule | Purpose |
|---|---|---|
| `refresh_storage_stats` | Every 5 min | Cache disk usage in Redis |
| `backup_postgres` | 2:00 AM daily | pg_dump to backup path |
| `snapshot_qdrant` | 3:00 AM Sunday | Qdrant snapshot API |
| `apply_graph_decay` | 4:00 AM Sunday | Decay unvisited graph nodes |
| `cleanup_old_backups` | 5:00 AM daily | Keep 30 days of backups |

### Storage Stats (Never Compute on Request)

```python
# tasks/maintenance.py
@celery_app.task
def refresh_storage_stats():
    stats = {
        "nvme_used_gb": get_dir_size(settings.ATHENA_HOT_BASE),
        "nvme_total_gb": get_disk_total(settings.ATHENA_HOT_BASE),
        "hdd_used_gb": get_dir_size(settings.ATHENA_BULK_BASE),
        "hdd_total_gb": get_disk_total(settings.ATHENA_BULK_BASE),
    }
    redis.set("system:storage_stats", json.dumps(stats), ex=360)

# api/system.py — reads from cache, never computes
async def get_storage():
    cached = await redis.get("system:storage_stats")
    return json.loads(cached) if cached else {"status": "warming_up"}
```

---

## LLM Tier Reference

| Tier | Model | GPU | When |
|---|---|---|---|
| 1 | qwen2.5:7b (Q4_K_M) | GPU (4 GB VRAM reserved) | All interactive: chat, routing, filtering |
| 2 | qwen2.5:30b (Q5_K_M) | GPU (4–9 GB additional) | Quiz gen, concept extraction, complex reasoning |
| 3 | llama3.1:70b (Q4_K_M) | CPU only (`num_gpu=0`) | Research synthesis only, always background |

**Rules that must never be violated:**
- Tier 3 must always have `options: {"num_gpu": 0}` in the Ollama call
- Tier 2 and Tier 3 must never be loaded simultaneously
- Tier 3 must only be called from a Celery task

---

## Code Standards

- **Async everywhere.** FastAPI route handlers are `async def`. Database calls use `await`. Use `asyncpg`, `redis.asyncio`, `httpx.AsyncClient`.
- **Type hints everywhere.** Every function signature has types. No bare `dict` or `list` — use `dict[str, str]`, `list[Message]`, etc.
- **Pydantic v2 for all schemas.** Use `model_validate`, `model_dump`. No `dict()` or `.parse_obj()`.
- **Never swallow exceptions.** Catch, log with loguru including context (request_id, conversation_id), then re-raise or return structured error.
- **Parameterized SQL only.** `await conn.fetch("SELECT * FROM messages WHERE conversation_id = $1", conv_id)`.
- **No hardcoded anything.** Paths, hosts, credentials, model names — always from `settings` which reads `os.environ`.
- **Logging format.** Structured JSON via loguru. Every log line for chat requests must include: `request_id`, `conversation_id`, `latency_ms`, `tier_used`.

---

## Environment Variables (Full List)

```bash
# Database
DB_PASSWORD=changeme
POSTGRES_DB=athena
POSTGRES_USER=athena
POSTGRES_HOST=postgres

# Services (Docker internal names)
OLLAMA_HOST=http://ollama
QDRANT_HOST=qdrant
REDIS_HOST=redis

# Storage (hot = NVMe, bulk = HDD)
ATHENA_HOT_BASE=/mnt/data/athena
ATHENA_BULK_BASE=/mnt/storage/athena
UPLOADS_PATH=${ATHENA_BULK_BASE}/uploads
PROCESSED_PATH=${ATHENA_BULK_BASE}/processed
RESEARCH_ARCHIVE_PATH=${ATHENA_BULK_BASE}/research_archives
BACKUP_PATH=${ATHENA_BULK_BASE}/backups
QDRANT_STORAGE_PATH=${ATHENA_HOT_BASE}/qdrant_storage
POSTGRES_DATA_PATH=${ATHENA_HOT_BASE}/postgres_data
OLLAMA_MODELS_PATH=${ATHENA_HOT_BASE}/models
REDIS_DATA_PATH=${ATHENA_HOT_BASE}/redis_data

# Optional external services
SERP_API_KEY=

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

## Key Constraints (Never Violate)

1. **Tier 3 = CPU only.** `num_gpu=0`. Every single call.
2. **Ephemeral conversations never touch Qdrant.** No embedding, no search.
3. **Storage stats always from Redis cache.** Never compute on request.
4. **Router runs before every LLM call in chat.**
5. **Research requires user approval** before pipeline executes.
6. **Never load Tier 2 + Tier 3 simultaneously.**
7. **All paths from environment variables.**
8. **All long-running ops go through Celery.** Never block a request handler.
9. **Parameterized SQL only.** Never f-strings in SQL.
10. **Promotion suggestion is JSON in the response body.** Frontend renders it — backend never decides how to display it.