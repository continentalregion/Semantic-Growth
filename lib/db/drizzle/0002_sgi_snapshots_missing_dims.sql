ALTER TABLE sgi_snapshots
  ADD COLUMN IF NOT EXISTS abstraction_level   real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lexical_richness    real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS information_density real NOT NULL DEFAULT 0;
