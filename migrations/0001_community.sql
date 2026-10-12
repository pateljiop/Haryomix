PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 40),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 3 AND 500),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_published
  ON community_posts(status, id DESC);

CREATE TABLE IF NOT EXISTS community_rate_limits (
  rate_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  bucket TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_rate_limits_bucket
  ON community_rate_limits(bucket);
