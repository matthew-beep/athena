-- Migration 002: documents and document_chunks tables

CREATE TABLE IF NOT EXISTS documents (
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
    error_message TEXT,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(255) UNIQUE NOT NULL,
    document_id VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER,
    qdrant_point_id VARCHAR(255),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
