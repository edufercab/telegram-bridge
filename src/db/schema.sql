CREATE TABLE IF NOT EXISTS session (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  active        INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT,
  last_activity TEXT
);

INSERT OR IGNORE INTO session (id, active) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_message_id INTEGER NOT NULL,
  from_username       TEXT,
  message             TEXT    NOT NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  read                INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inbox_read ON inbox_messages(read);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_messages(created_at);
