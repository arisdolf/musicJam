-- Run once against your database (psql or your SQL client).
-- Assumes your users table has an integer primary key "id".
-- If users.id is a UUID, change the user_id column type to UUID.

CREATE TABLE IF NOT EXISTS playlists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playlists_user_idx ON playlists (user_id, created_at DESC);

-- One row per song in a playlist. The primary key stops the same song
-- from being added twice to the same playlist.
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT    NOT NULL,          -- YouTube video id
  position    INTEGER NOT NULL,          -- keeps the order songs were added
  title       TEXT    NOT NULL,
  artist      TEXT    NOT NULL DEFAULT '',
  thumbnail   TEXT,
  duration    INTEGER,                   -- seconds
  lyrics_id   INTEGER,                   -- LRCLIB record id
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);