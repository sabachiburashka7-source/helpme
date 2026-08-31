-- Kheli database schema for Cloudflare D1 (SQLite).
--
-- Ported from the previous Supabase/Postgres tables. Type notes:
--   * Postgres uuid            -> TEXT holding crypto.randomUUID()
--   * Postgres timestamptz     -> TEXT holding an ISO-8601 UTC string
--   * Postgres text[] / jsonb  -> TEXT holding a JSON array (see `images`)
-- The API layer is responsible for those conversions so the JSON the app
-- receives is byte-for-byte the same shape it got from Supabase.

CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  phone                   TEXT NOT NULL UNIQUE,
  name                    TEXT,
  profile_image           TEXT,
  tier                    TEXT NOT NULL DEFAULT 'free',
  subscription_expires_at TEXT,
  created_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id            TEXT PRIMARY KEY,
  description   TEXT,
  price         REAL,
  location      TEXT,
  category      TEXT,
  name          TEXT,
  avatar        TEXT,
  phone         TEXT,
  latitude      REAL,
  longitude     REAL,
  profile_image TEXT,
  images        TEXT,          -- JSON array of data URLs, e.g. '["data:image/..."]'
  image         TEXT,          -- URL of the generated illustration
  created_at    TEXT NOT NULL
);

-- Matches the index the Supabase migration created: makes the monthly post
-- quota count (filter by phone, then by created_at range) fast.
CREATE INDEX IF NOT EXISTS offers_phone_created_at_idx ON offers (phone, created_at DESC);

-- The Browse feed is ordered by created_at DESC across all offers.
CREATE INDEX IF NOT EXISTS offers_created_at_idx ON offers (created_at DESC);
