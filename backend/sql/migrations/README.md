# Database Migrations

Athena uses plain SQL migration files. No ORM, no migration framework — just numbered `.sql` files applied manually or via `psql`.

---

## File Naming

```
NNN_short_description.sql
```

Examples:
```
001_conversation_context_fields.sql
002_add_documents_table.sql
003_quiz_mastery_indexes.sql
```

Always zero-pad to three digits. Never reuse or renumber a migration. Never edit a migration that has already been applied.

---

## Writing a Migration

### Adding columns

```sql
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;
```

Always use `IF NOT EXISTS` on `ADD COLUMN` — makes the file safe to re-run if something fails partway through.

### Adding a table

```sql
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Dropping a column

```sql
ALTER TABLE conversations DROP COLUMN IF EXISTS old_column;
```

### Adding an index

```sql
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);
```

### Renaming a column

```sql
ALTER TABLE conversations RENAME COLUMN old_name TO new_name;
```

Postgres has no `IF EXISTS` for `RENAME COLUMN` — check first if unsure whether the column exists.

---

## Applying a Migration

Postgres must be running (`docker compose up -d postgres`).

```bash
docker compose exec -T postgres psql -U athena -d athena < backend/sql/migrations/NNN_your_migration.sql
```

Check the output — each statement prints `ALTER TABLE`, `CREATE TABLE`, etc. on success. Any error will be printed and stop execution.

### Verify afterwards

```bash
docker compose exec postgres psql -U athena -d athena -c "\d table_name"
```

---

## Updating schema.sql

After applying a migration, update `backend/sql/schema.sql` to match. This file is the source of truth for **fresh installs** — it is what runs when someone sets up Athena from scratch. If you skip this step, the live DB and fresh installs will drift apart.

---

## Keeping Track

There is no automatic tracking of which migrations have been applied. Follow these rules:

1. Migrations are numbered sequentially — check what exists before naming a new one.
2. Once a migration file is committed and applied, **never edit it**.
3. If you made a mistake, write a new migration to fix it.
4. Use `IF NOT EXISTS` / `IF EXISTS` guards wherever Postgres supports them so files are safe to re-run.

To see what columns a table currently has:

```bash
docker compose exec postgres psql -U athena -d athena -c "\d conversations"
```

To list all tables:

```bash
docker compose exec postgres psql -U athena -d athena -c "\dt"
```

---

## Migration History

| # | File | What it does |
|---|------|--------------|
| 001 | `001_conversation_context_fields.sql` | Adds `token_count`, `summary`, `summarized_up_to_id`, `last_summarized_at`, `summary_embedded`, `last_embedded_at` to `conversations` |
