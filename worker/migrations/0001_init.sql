CREATE TABLE daraja (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE book (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  daraja_id INTEGER NOT NULL REFERENCES daraja(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE lecture (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id   INTEGER NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  audio_key TEXT NOT NULL,
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE page_marker (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lecture_id   INTEGER NOT NULL REFERENCES lecture(id) ON DELETE CASCADE,
  time_seconds INTEGER NOT NULL,
  page_number  INTEGER NOT NULL
);

CREATE TABLE app_user (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  access_code  TEXT UNIQUE NOT NULL,
  name         TEXT,
  is_admin     INTEGER DEFAULT 0
);

CREATE INDEX idx_book_daraja ON book(daraja_id);
CREATE INDEX idx_lecture_book ON lecture(book_id);
CREATE INDEX idx_marker_lecture_time ON page_marker(lecture_id, time_seconds);
