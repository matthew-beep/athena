-- 004_projects.sql
-- Adds: projects, project_documents, surfaces tables
--       project_id FK on conversations

CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    project_id      VARCHAR(255) UNIQUE NOT NULL,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    goal            TEXT,
    status          VARCHAR(50) DEFAULT 'active',   -- active | paused | complete
    constraints     TEXT,
    last_active_at  TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

CREATE TABLE IF NOT EXISTS project_documents (
    project_id  VARCHAR(255) REFERENCES projects(project_id) ON DELETE CASCADE,
    document_id VARCHAR(255) REFERENCES documents(document_id) ON DELETE CASCADE,
    added_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (project_id, document_id)
);

CREATE TABLE IF NOT EXISTS surfaces (
    id             SERIAL PRIMARY KEY,
    surface_id     VARCHAR(255) UNIQUE NOT NULL,
    project_id     VARCHAR(255) REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
    surface_type   VARCHAR(50) NOT NULL,  -- re_entry | research_finding | monitor_alert
    title          VARCHAR(255),
    body           TEXT,
    source_task_id VARCHAR(255),
    status         VARCHAR(50) DEFAULT 'unread',  -- unread | read | dismissed | acted
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surfaces_project ON surfaces(project_id);

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS project_id VARCHAR(255) REFERENCES projects(project_id) ON DELETE SET NULL;
