-- Migration 001: Context management columns
-- Run this against an existing database that was initialized before
-- the context management columns were added to schema.sql.
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING).

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS summarized_up_to_id INTEGER,
    ADD COLUMN IF NOT EXISTS last_summarized_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS summary_embedded BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMP;

-- Back-fill message_count for existing conversations
UPDATE conversations c
SET message_count = (
    SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.conversation_id
)
WHERE message_count = 0;
