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

/* ------------------------------------------------------------------ *
 * Moderation: reports + blocks
 *
 * Google Play's User Generated Content policy expects an app whose main
 * content is user-posted to let people flag a listing and block its
 * author. Both tables key off `phone`, the same identity the rest of the
 * API uses (quota counting, delete_account, offers.phone) - there is no
 * user id on `offers` to join against.
 * ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS reports (
  id             TEXT PRIMARY KEY,
  offer_id       TEXT NOT NULL,
  -- Owner's phone captured at report time, so a report still says who was
  -- reported after the offer row is deleted.
  offer_phone    TEXT,
  reporter_phone TEXT NOT NULL,
  -- Optional: users.id of the reporter when the client sends it. The phone
  -- above is the functional key; this is only for tracing an account back.
  reporter_id    TEXT,
  reason         TEXT NOT NULL,
  details        TEXT,
  created_at     TEXT NOT NULL
);

-- One report per person per offer. This is what makes the auto-hide count
-- trustworthy: COUNT(*) can never be inflated by one angry user tapping
-- Report repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS reports_offer_reporter_idx
  ON reports (offer_id, reporter_phone);

-- The Browse feed counts reports per offer on every load.
CREATE INDEX IF NOT EXISTS reports_offer_idx ON reports (offer_id);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_phone TEXT NOT NULL,
  blocked_phone TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (blocker_phone, blocked_phone)
);

-- Every /api/offers GET filters by the viewer's block list.
CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON blocks (blocker_phone);
