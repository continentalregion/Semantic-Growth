DO $$ BEGIN
  CREATE TYPE persistence_level AS ENUM ('alta', 'media', 'bassa');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE inferred_fact_status AS ENUM ('candidate', 'active', 'stale', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS ai_inferred_facts (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fact                   TEXT NOT NULL,
  persistence_level      persistence_level NOT NULL,
  status                 inferred_fact_status NOT NULL DEFAULT 'candidate',
  first_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reinforced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_inferred_facts_user_status
  ON ai_inferred_facts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_inferred_facts_user_reinforced
  ON ai_inferred_facts (user_id, last_reinforced_at DESC);
