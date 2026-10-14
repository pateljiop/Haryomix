PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_file_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL DEFAULT 0,
  source_modified_at TEXT NOT NULL,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'unavailable', 'processing')),
  synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_documents_ready
  ON study_documents(status, title COLLATE NOCASE);
