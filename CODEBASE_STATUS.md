# Athena — Codebase Status
## 2026-02-25

---

## What Was Worked On This Session

Focus: **General Chat + Document-Scoped Chat** — the retrieval pipeline, conversation scoping, and backend correctness.

---

## Backend Changes

### `app/core/rag.py` — Full Rewrite

The file had a critical syntax error: the old `retrieve()` function body was left dangling after the new one was pasted in, making the entire backend fail to import. The file was rewritten cleanly.

**Changes:**
- Removed the old `retrieve()` body (lines 166–207) that caused a `SyntaxError` on startup
- Replaced SDK-style `Filter`, `FieldCondition`, `MatchValue`, `MatchAny` objects with plain REST API dicts — the Qdrant client is httpx-based, not the Python SDK, so SDK classes don't exist
- Fixed `within_ids=doc_ids` kwarg mismatch → `document_ids=doc_ids` on `find_referenced_document` call
- Fixed `filter=search_filter` → `filters=search_filter` to match the actual `qdrant.search()` signature
- Changed `user_id: str` → `user_id: int` to match `find_referenced_document` and Postgres queries
- Cleaned up indentation (original had 6-space body indent with trailing whitespace on signature lines)

**Retrieval logic as-built:**
- `document_ids` empty + `search_all=False` → return `[]` immediately, no Qdrant call
- `document_ids` populated → check fuzzy filename match within scope, filter to matched doc or all scope docs
- `search_all=True` + no docs → filter to user only, search everything
- After Qdrant returns hits: batch fetch chunk text from `document_chunks` Postgres table in one query, preserving rank order via `array_position`
- Per-chunk score threshold filtering (drops weak hits, keeps strong ones)

### `app/api/documents.py` — Ingestion Fixes

- Added `datetime, timezone` import
- Added `"created_at": datetime.now(timezone.utc).isoformat()` to Qdrant payload — required for future recency scoring
- Removed redundant nested `"metadata": {"filename": filename}` from Qdrant payload (filename already exists at top level)
- Fixed `background_tasks.add_task(_process_document, ...)` — `user_id` was missing from the call, causing every background ingestion task to fail with a `TypeError`

### `app/api/chat.py` — Minor Fixes

- Changed `str(current_user["id"])` → `current_user["id"]` in `retrieve()` call — `user_id` is an `int` throughout, casting to string caused type mismatch with Postgres queries in `find_referenced_document`
- `_update_title` now guarded: only fires a DB write if the conversation title is still `"New Conversation"`. Previously it executed a DB round trip on every single chat message

### `sql/schema.sql`
- No changes required — duplicate index (`idx_document_chunks_document_id`) was already resolved

---

## Architecture As-Built (Chat + RAG)

```
User message
    │
    ▼
_get_or_create_conversation()
    ├─ existing conv_id → load document_ids from conversation_documents table
    └─ new conv → create conversation, attach any initial document_ids
    │
    ▼
retrieve(query, user_id, document_ids)
    ├─ doc_ids empty → return []  (general chat path)
    └─ doc_ids populated
           │
           ├─ find_referenced_document()  (fuzzy filename match within scope)
           ├─ embed query → Qdrant search (filtered by user_id + document_ids)
           └─ batch fetch text from document_chunks (Postgres)
    │
    ▼
build_messages(conversation_id, message, rag_context)
    ├─ load + token-manage conversation history
    ├─ build_system_prompt (base | base + rag_context)
    └─ assemble messages array
    │
    ▼
Ollama stream → SSE to client
    │
    ▼
save_message() × 2  (user + assistant)
```

### Qdrant Payload (current)
```json
{
  "document_id": "doc_abc123",
  "chunk_id": "doc_abc123_chunk_0",
  "user_id": 1,
  "filename": "paper.pdf",
  "normalized_filename": "paper",
  "chunk_index": 0,
  "source_type": "pdf",
  "knowledge_tier": "persistent",
  "created_at": "2026-02-25T10:00:00Z"
}
```
Text is **not** stored in Qdrant. `chunk_id` bridges back to `document_chunks` in Postgres.

---

## What Was NOT Implemented (Deferred)

From the Chat & RAG spec, the following priorities were scoped out:

### Priority 3 — Tighter System Prompt
`build_rag_prompt()` with restrictive citation rules ("do not use training data", "cite sources as [N]", explicit fallback) was not implemented. The current `build_system_prompt()` in `context.py` appends RAG context to the base prompt without any retrieval-specific instructions. The model will answer freely from training knowledge alongside retrieved chunks. **This is a retrieval quality gap, not a crash.**

### Priority 4 — Recency Scoring
`apply_recency_scoring()` (exponential decay blending cosine score with chunk age) was not implemented. `created_at` is now stored in the Qdrant payload so this can be added without a backfill. Qdrant results are currently returned in raw similarity order.

### Priority 5 — Chunk Size Tuning
Chunking defaults were not adjusted. Current: 512 tokens, 64 overlap. Spec recommendation: 400 tokens, 50 overlap. Re-ingesting existing documents would be required after any change to defaults.

---

## Further Recommendations

### Restrictive RAG System Prompt (Priority 3 — do first)
The first backend task to pick up after the frontend is functional. The current prompt produces unreliable document chat — the model answers from training data and doesn't cite sources. The fix is contained entirely to `context.py`: replace `build_system_prompt` with a branch that uses a restrictive template when `rag_context` is present (cite sources, don't use training knowledge, explicit fallback message).

### Backfill Existing Documents
Documents ingested before today are missing `created_at` in their Qdrant payloads and may still have the redundant `metadata.filename` nesting. Run the `backfill_chunk_payloads()` script outlined in the Chat & RAG spec to:
1. Strip any remaining `text` fields from Qdrant payloads
2. Add `created_at` to old points
3. Clean up `metadata` nesting

No Postgres changes needed — `document_chunks` text is already correct.

### BM25 Hybrid Search
Vector search alone misses exact keyword matches — model names, paper titles, algorithm names, version numbers. BM25 excels at these. Correctly deferred to the project/research phase. When ready:

- Add a `bm25_indexes` table keyed by `document_id` storing the tokenized corpus per document
- At ingestion, build and store the BM25 index alongside the Qdrant upsert
- At search time, run `bm25_search()` alongside `vector_search()` and merge results via Reciprocal Rank Fusion (RRF)
- `retrieve()` extends cleanly — `document_ids` is already the scope primitive, BM25 slots in as a second retrieval path with no architectural changes

### Recency Scoring (Priority 4)
`created_at` is now in every new Qdrant payload. Adding recency scoring is additive — wrap the existing Qdrant results with `apply_recency_scoring()` before the Postgres text fetch. Start with `recency_weight=0.3`, `half_life_days=30`. Tune based on observed behavior.

### Celery for Ingestion
Document ingestion currently runs as a FastAPI `BackgroundTask`. Works at low volume but has no retry logic, no persistence across restarts, and no visibility beyond the in-memory `_progress` dict. Moving to Celery is scheduled for Phase 2 and becomes necessary once video/audio transcription is added (slow, long-running, must survive restarts).

---

## Frontend — Items to Implement

Ordered by dependency — earlier items unblock later ones.

### 1. Fix `contextBudget` value
**File:** `stores/chat.store.ts`
`contextBudget` is hardcoded as `4096`. The backend uses `8192`. The dev mode overlay shows the wrong budget. One-line fix.

---

### 2. Add `mode` to `Conversation` type
**File:** `types/index.ts`
Add `mode: 'general' | 'documents'` to the `Conversation` interface. Update anywhere `Conversation` objects are constructed in `useSSEChat.ts` (the `newConv` object built on the `done` event).

---

### 3. Add `Document` type
**File:** `types/index.ts`
Add a `Document` interface for items from the document library:
```ts
interface Document {
  document_id: string;
  filename: string;
  file_type: string;
  processing_status: string;
  upload_date: string;
  word_count: number | null;
  chunk_count: number | null;
}
```
And a `ConversationDocument` type for the attach/detach context:
```ts
interface ConversationDocument {
  document_id: string;
  filename: string;
  file_type: string;
  word_count: number | null;
  added_at: string;
}
```

---

### 4. Add conversation document state to store
**File:** `stores/chat.store.ts`
Add:
```ts
conversationDocuments: Record<string, ConversationDocument[]>
setConversationDocuments: (convId: string, docs: ConversationDocument[]) => void
addConversationDocument: (convId: string, doc: ConversationDocument) => void
removeConversationDocument: (convId: string, docId: string) => void
```
This is the source of truth for which documents are attached to which conversation.

---

### 5. Add API methods for conversation document management
**File:** `api/client.ts`
Add typed wrappers for:
- `GET /chat/{conv_id}/documents` → returns `{ documents: ConversationDocument[] }`
- `POST /chat/{conv_id}/documents/{doc_id}` → attach, returns updated doc list + mode
- `DELETE /chat/{conv_id}/documents/{doc_id}` → detach, returns updated doc list + mode

---

### 6. Load conversation documents on conversation switch
When `activeConversationId` changes, call `GET /chat/{conv_id}/documents` and populate `conversationDocuments` in the store. Best placed in a `useConversation.ts` hook or inside the existing conversation-switching logic.

---

### 7. Document scope bar in chat view
**File:** `components/chat/ChatWindow.tsx` (new `DocumentScopeBar` component)
A bar that sits above the message list showing:
- Nothing / "General chat" when no documents are attached
- Document chips with filename when in document mode, each with an × to detach
- An "Attach document" button that opens a picker from the user's document library

On attach: call `POST /chat/{conv_id}/documents/{doc_id}`, update store, update conversation mode
On detach: call `DELETE /chat/{conv_id}/documents/{doc_id}`, update store

---

### 8. Send `document_ids` on new conversation creation
**File:** `hooks/useSSEChat.ts`
When creating a new conversation (`isNewConversation`) and the store has pending documents for that conversation, include `document_ids` in the chat POST body. This ensures new document-scoped conversations are created with the correct scope from the first message.

---

### 9. Conversation mode indicator in sidebar
**File:** `components/layout/Sidebar.tsx`
Add a small document icon or `doc` pill on each conversation list item when `mode === 'documents'`. Gives the user a quick read on which conversations have document context.

---

*Athena · Codebase Status · 2026-02-25*
