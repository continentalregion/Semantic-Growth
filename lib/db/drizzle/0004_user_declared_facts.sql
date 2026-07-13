CREATE TABLE IF NOT EXISTS user_declared_facts (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fact         TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  declared_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_declared_facts_user_active
  ON user_declared_facts (user_id, is_active);
