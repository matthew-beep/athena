# How Athena Works

A guide to the architecture and flow of the Athena Learning Platform.

---

## Overview

Athena is a **RAG (Retrieval-Augmented Generation)** application. It combines:

1. **Vector search** — finds relevant text from your documents by meaning, not keywords
2. **LLM (Large Language Model)** — generates natural-language answers using that context

When you ask a question, Athena doesn't answer from its general training. It first fetches the most relevant chunks from your materials, then asks the LLM to answer *only* from that context.

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────────────────┐
│                 │  HTTP   │              FastAPI Backend              │
│  frontend.html  │ ──────► │  athena_api.py                            │
│  (Chat UI)      │ ◄────── │                                            │
│                 │  JSON   │  ┌─────────────┐    ┌─────────────────┐   │
└─────────────────┘         │  │ Sentence    │    │  documents[]    │   │
                            │  │ Transformers│    │  doc_embeddings[]│   │
                            │  │ (embeddings)│    │  (in-memory)    │   │
                            │  └─────────────┘    └─────────────────┘   │
                            │         │                      │          │
                            │         └──────────┬───────────┘          │
                            │                    │                      │
                            │                    ▼                      │
                            │            ┌──────────────┐               │
                            │            │   Ollama     │               │
                            │            │   (LLM)      │               │
                            │            └──────────────┘               │
                            └──────────────────────────────────────────┘
```

---

## Components

### 1. Frontend (`frontend/frontend.html`)

- Static HTML page with a chat-style interface
- Talks to the backend at `http://localhost:8000`
- On load: calls `GET /` to show status and document count
- On send: calls `POST /chat` with the question and shows the answer plus sources
- All communication is over HTTP/JSON

### 2. Backend (`backend/athena_api.py`)

FastAPI app that provides:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Health/status and document count |
| `/documents` | GET | List all documents in the knowledge base |
| `/documents` | POST | Add a new document (text + optional metadata) |
| `/search` | POST | Search for similar documents (query + top_k) |
| `/chat` | POST | RAG chat: retrieve docs → prompt LLM → return answer |

### 3. Embedding Model (Sentence Transformers)

- Model: `all-MiniLM-L6-v2`
- Loaded once at startup
- Turns text into **embeddings** (384‑dim vectors)
- Similar meaning → similar vectors → higher similarity scores

### 4. Document Storage (in-memory)

- `documents` — list of `{id, text, metadata}`
- `doc_embeddings` — corresponding embedding vectors
- Indexed at startup with sample documents; new docs are embedded when added via `POST /documents`

### 5. LLM (Ollama)

- Runs locally via Ollama (e.g. `llama3.2:3b`)
- Receives a prompt built from retrieved context + user question
- Instructed to answer only from that context and refuse when info is missing

---

## The RAG Flow (Step by Step)

What happens when you ask something like *"What is backpropagation?"*:

### Step 1: Embed the question

The question is turned into a vector with the same embedding model used for documents.

### Step 2: Find similar documents

- Compare the question embedding to each document embedding using **cosine similarity**
- Sort by similarity and take the top `top_k` (default 3)
- These are the passages that best match the question’s meaning

### Step 3: Build context

The text of those top documents is concatenated into a single context string.

### Step 4: Build the prompt

A structured prompt is created for the LLM:

```
You are a helpful AI assistant. Answer the question based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information..."

Context:
[Document 1 text]
[Document 2 text]
[Document 3 text]

Question: What is backpropagation?

Answer:
```

### Step 5: Call the LLM

The prompt is sent to Ollama. The model generates an answer based only on the given context.

### Step 6: Return response

The API returns:

- `answer` — the LLM’s response
- `sources` — the retrieved documents and their similarity scores
- `context_used` — the raw context string

The frontend shows the answer and source snippets.

---

## Vector Similarity (How Search Works)

Documents and the query are represented as vectors. Similarity is computed as:

```
similarity = dot(query_vector, doc_vector) / (||query|| × ||doc||)
```

- Same meaning → similar vectors → higher score (closer to 1)
- Unrelated meaning → different vectors → lower score (closer to 0)

This is **semantic search**: matches by meaning, not exact words.

---

## Data Flow Example

**User asks:** "How does gradient descent work?"

1. Frontend sends `POST /chat` with `{"question": "...", "top_k": 3}`.
2. Backend embeds the question.
3. Similarity scores against all documents; top 3 chosen.
4. Context built from those 3 documents.
5. Prompt assembled with instructions + context + question.
6. Ollama returns an answer.
7. Response includes answer, sources (with scores), and context.
8. Frontend renders answer and source snippets.

---

## Startup Sequence

1. FastAPI starts, loads the embedding model.
2. `@app.on_event("startup")` runs.
3. Sample documents (e.g. about neural networks, backpropagation) are added.
4. All documents are embedded and stored in `documents` and `doc_embeddings`.
5. API is ready to serve requests.

---

## Current Limitations

- **In-memory storage** — data is lost when the server stops (no persistence yet).
- **Whole documents** — long documents are stored as single chunks (no chunking).
- **Single embedding model** — `all-MiniLM-L6-v2` for both indexing and queries.
- **Local LLM only** — requires Ollama running locally.

---

## Possible Next Steps

- Persist documents and embeddings (e.g. SQLite + vector DB like Qdrant).
- Chunk long documents before indexing.
- Support PDF and other file uploads.
- Add user sessions or multi-tenancy.
- Introduce a dedicated vector database for larger scale.
