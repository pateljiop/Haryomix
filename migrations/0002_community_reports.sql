CREATE TABLE IF NOT EXISTS community_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'personal_info', 'other')),
  details TEXT NOT NULL DEFAULT '' CHECK (length(details) <= 300),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_reports_status_created
  ON community_reports(status, created_at DESC);
