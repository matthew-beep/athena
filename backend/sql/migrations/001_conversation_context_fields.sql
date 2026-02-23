-- Migration 001: Add context window management fields to conversations
-- Phase 2 — supports token budgeting, conversation summarization, and future Qdrant embedding

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;

-- Cached summary generated when history first exceeds token budget.
-- Reused on every subsequent request instead of regenerating.
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS summarized_up_to_id INTEGER REFERENCES messages(id),
    ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMP;

-- Flags for Phase 4 Celery + Qdrant integration (set now, used later).
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS summary_embedded BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMP;
