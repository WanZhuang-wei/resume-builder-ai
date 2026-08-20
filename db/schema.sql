-- resume-metrics schema (v1)
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  max_questions INTEGER NOT NULL DEFAULT 3,
  manage_token TEXT NOT NULL DEFAULT '',
  view_count INTEGER NOT NULL DEFAULT 0,
  ask_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at INTEGER,
  last_asked_at INTEGER,
  sessions TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_shares_fingerprint ON shares(fingerprint, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_created ON shares(created_at);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  event_name TEXT NOT NULL,
  share_id TEXT,
  feature TEXT,
  value INTEGER,
  extra TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name, ts);
CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_share ON events(share_id, ts);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  device_id TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, bucket)
);
