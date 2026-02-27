-- Athena Phase 1 Schema
-- Note: conversations.summarized_up_to_id intentionally has no FK constraint
-- to avoid a circular dependency (messages → conversations → messages).
-- Context management in app/core/context.py guarantees referential integrity.


-- USERS TABLE

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CONVERSATIONS TABLE

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    knowledge_tier VARCHAR(20) DEFAULT 'ephemeral',
    started_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    mode TEXT NOT NULL DEFAULT 'general',  -- 'general' | 'documents' | 'project' | 'research
    -- Token tracking — incremented by save_message() on every write
    token_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    -- Cached summary generated when history first exceeds token budget.
    -- Reused on every subsequent request without regenerating.
    -- summarized_up_to_id references messages.id (no FK — see note above)
    summary TEXT,
    summarized_up_to_id INTEGER,
    last_summarized_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Phase 4: Celery sweeps this flag to know which summaries need Qdrant embedding
    summary_embedded BOOLEAN DEFAULT false,
    last_embedded_at TIMESTAMP
);


-- MESSAGES TABLE

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    model_used VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- DOCUMENTS TABLE

CREATE TABLE IF NOT EXISTS documents (
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
    knowledge_tier VARCHAR(20) DEFAULT 'persistent',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- CONVERSATION DOCUMENTS TABLE

CREATE TABLE IF NOT EXISTS conversation_documents (
    conversation_id  VARCHAR(255) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    document_id      VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    added_at         TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY      (conversation_id, document_id)
);


CREATE INDEX IF NOT EXISTS idx_conv_docs_conversation ON conversation_documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_docs_document ON conversation_documents(document_id);


CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    document_id VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER,
    qdrant_point_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- For scoping queries by user
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user ON document_chunks(user_id);

-- bm25 indexes table

CREATE TABLE IF NOT EXISTS bm25_indexes (
    document_id  VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    chunk_ids    JSONB NOT NULL DEFAULT '[]',
    corpus       JSONB NOT NULL DEFAULT '[]',
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY  (document_id)
);

CREATE INDEX IF NOT EXISTS idx_bm25_document ON bm25_indexes(document_id);