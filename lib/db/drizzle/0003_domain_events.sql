CREATE TABLE IF NOT EXISTS domain_events (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain          TEXT NOT NULL,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_domain_events_user_domain_time
  ON domain_events (user_id, domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_user_time
  ON domain_events (user_id, created_at DESC);
