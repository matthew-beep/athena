# Document upload & ingestion — analysis

This note describes how Athena handles document upload and ingestion today, gaps versus product expectations, edge cases, and prioritized recommendations. It is separate from the **Upload modal ↔ API integration** implementation plan.

---

## 1. Current architecture

### 1.1 HTTP surface (`backend/app/api/documents.py`)

| Route | Role |
|-------|------|
| `POST /api/documents/upload` | Multipart `file`; validates MIME against `ALLOWED_TYPES`; reads full body into memory; inserts `documents` row (`processing_status='processing'`, `user_id`); enqueues **`BackgroundTasks._process_document`**; returns **202** + `document_id`. |
| `POST /api/documents/url` | Proxies URL to Crawl4AI; returns crawl JSON. **Does not** create a `documents` row or run ingestion. |
| `GET /api/documents/{id}/progress` | Reads in-memory `_progress[document_id]` while processing; otherwise falls back to DB `processing_status`. |
| `GET /api/documents/progress/active` | Lists docs in `processing` for user; merges with `_progress` when present. |

### 1.2 In-process progress (`_progress`)

- Keyed by `document_id`.
- Updated during extract / chunk / embedding loop (`done` / `total` for embedding).
- **Cleared** when processing finishes (success or handled error).
- **Lost on process restart** — there is no durable job queue.

### 1.3 Pipeline (`_process_document`)

Rough order:

1. **Extract** — `extract_text(BytesIO(body), mime, filename)` on a thread (`asyncio.to_thread`).
2. **Chunk** — `chunk_text(text)` (sentence-aware, 500 / 50 overlap per `ingestion.py`).
3. **Per chunk** — embed via Ollama (`/api/embeddings`), insert `document_chunks`, build Qdrant upsert batch.
4. **Upsert** Qdrant + **BM25** index (`build_bm25_index`).
5. **Complete** — `processing_status='complete'`, `word_count`, `chunk_count`.

On failure: `processing_status='error'`, `error_message` set; `_progress` popped.

### 1.4 Schema highlights (`backend/sql/schema.sql`)

- `documents`: `user_id`, `collection_id` (FK, `ON DELETE SET NULL`), `source_url`, `content_hash` (often unused in upload path), `metadata` JSONB.
- `document_chunks`: per-chunk text, `qdrant_point_id`, `user_id`.
- `bm25_indexes`: per-document sparse index data.

### 1.5 Frontend entry points

- **UploadZone** — `fetch('/api/documents/upload', FormData)` with Bearer token; URL mode calls `/documents/url` for **preview only** (no library document).
- **UploadModal** — queues files + URLs; collection selection; import wiring is still evolving.

---

## 2. Strengths

- Clear separation: accept upload quickly (202) vs long-running work in background.
- Progress API exists for UX (embedding fraction).
- User scoping on documents and chunks.
- Chunk id → deterministic Qdrant id avoids random collisions.
- `ON CONFLICT (chunk_id) DO NOTHING` on chunk insert adds some idempotency for chunk rows.

---

## 3. Gaps & inconsistencies

| Area | Issue |
|------|--------|
| **URL → library** | `/url` does not create documents or run `_process_document`; modal/zone “URL” flows are not symmetric with file upload. |
| **Collections** | Upload path does not set `collection_id` on INSERT; assignment is only via collections API or future upload changes. |
| **`content_hash`** | Column exists but upload path does not compute dedupe / “same file twice” behavior. |
| **`source_url`** | Not populated for web ingestion when/if URL ingest is added. |
| **BackgroundTasks vs Celery** | CLAUDE.md specifies Celery for long work; documents use FastAPI `BackgroundTasks` (same process, dies with worker). |
| **Progress durability** | After restart, doc may stay `processing` forever with empty `_progress` (UI shows generic processing). |
| **Video/audio** | MIMEs allowed in `ALLOWED_TYPES`; extraction path depends on `extract_text` — verify behavior and timeouts for large media. |
| **Embedding failure** | Single chunk embed failure aborts whole doc with generic internal error; partial upsert possible if earlier chunks wrote DB/Qdrant (worth auditing transaction boundaries). |

---

## 4. Edge cases to handle (product + ops)

### 4.1 Upload / request

- **Empty file** — already rejected (400).
- **Oversized file** — enforce `MAX_UPLOAD_SIZE_MB` (env) **before** reading full body into RAM.
- **Wrong / spoofed `Content-Type`** — you partially mitigate via `_resolve_mime` + extension map; still trust bytes for magic sniffing if you add abuse resistance.
- **Concurrent duplicate uploads** — same user uploads same file twice → two documents unless you implement hash dedupe.
- **Very long filenames** — DB `VARCHAR(255)`; normalize/truncate consistently.

### 4.2 Processing

- **Extraction returns empty or whitespace-only** — “No content to chunk” path exists; OK.
- **PDF encrypted / corrupt** — handled via extract error → `error` status.
- **Ollama down / slow** — embedding loop can throw; whole doc marked error; consider retries with backoff per chunk.
- **Qdrant unavailable** — upsert may fail after Postgres chunks written; document may be inconsistent (RAG partial). Define strategy: rollback chunks, or mark `degraded` and retry job.
- **Partial Qdrant success** — batch upsert; clarify atomicity expectations.

### 4.3 Multi-tenant / auth

- All routes use `get_current_user`; ensure list/get/delete/progress never leak across `user_id`.

### 4.4 UI

- **Double submit** — user clicks import twice → duplicate documents; disable button + idempotency key optional.
- **Navigate away during processing** — DocumentList already polls active progress; modal close should not cancel server work (today it doesn’t).

### 4.5 URL / web

- **Redirect chains, auth walls, bot blocking** — Crawl4AI may return empty markdown; treat as extract failure with clear `error_message`.
- **Huge pages** — cap fetched size or truncate before chunk to avoid memory blowups.

---

## 5. Recommendations (prioritized)

### P0 — Correctness & safety

1. **Enforce max upload size** on `upload_document` (stream or cap read) aligned with `.env` / `MAX_UPLOAD_SIZE_MB`.
2. **Document partial-failure policy** — if embedding fails mid-way, either delete partial chunks + vectors or add a `retry`/`repair` job; avoid silent orphan vectors.
3. **URL ingest** — single path that creates a `documents` row and calls the same pipeline as files (markdown as `text/plain` or dedicated branch), and sets `source_url`.

### P1 — Product fit

4. **Optional `collection_id` on upload** (validated ownership) or batch assign after upload via existing collections endpoint.
5. **Optional dedupe** — compute SHA-256 of raw bytes; if same `user_id` + hash exists, return existing `document_id` or 409 with link (policy choice).
6. **Unify URL UX** — UploadZone “preview only” vs modal “library ingest” should converge on one behavior or explicit modes in UI copy.

### P2 — Architecture (align with CLAUDE.md)

7. **Move ingestion to Celery** (or worker queue) with durable state: `pending` → `processing` → `complete`/`error`, so restarts don’t strand jobs.
8. **Persist progress** in Redis or DB for multi-instance / restart resilience (even a simple `processing_jobs` table).

### P3 — Observability

9. Structured logs: `document_id`, `user_id`, stage, duration, chunk counts.
10. Metrics: uploads accepted, ingestion success/fail, p95 time per stage.

### P4 — Future

11. **Virus scanning** / content policy if uploads are ever multi-user or exposed.
12. **Rate limiting** per user for upload and URL crawl.

---

## 6. Quick reference — files

| Concern | Location |
|---------|----------|
| Upload + pipeline | `backend/app/api/documents.py` |
| Extract / chunk | `backend/app/core/ingestion.py` |
| Schema | `backend/sql/schema.sql` |
| Collections assign | `backend/app/api/collections.py` |
| Client upload pattern | `frontend/components/documents/UploadZone.tsx` |

---

## 7. Summary

Today, **file upload is a real ingestion pipeline** (202 + background processing + progress); **URL is not**. Progress and jobs are **in-process and fragile across restarts**. Investing in **size limits**, **URL parity**, **collection on upload**, and eventually **queued workers + durable progress** will align the implementation with both the product (modal + library) and the documented Athena architecture.
