-- Migration 003: add rag_sources column to messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS rag_sources JSONB;
