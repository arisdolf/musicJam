-- =============================================================================
-- MusicJam – PostgreSQL Schema
-- =============================================================================
-- Safe to run multiple times (all statements use IF NOT EXISTS / ON CONFLICT).
-- Run via:  node server/migrate.js
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL    PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. playlists  (owned by a user; deleted with the user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlists (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. playlist_tracks  (tracks inside a playlist; deleted with the playlist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id               BIGSERIAL   PRIMARY KEY,
  playlist_id      BIGINT      NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  youtube_video_id VARCHAR(32) NOT NULL,
  title            TEXT        NOT NULL,
  artist           TEXT        NOT NULL,
  thumbnail        TEXT,
  position         INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (playlist_id, youtube_video_id)
);

-- ---------------------------------------------------------------------------
-- 4. rooms  (collaborative listening rooms; keyed by a short alphanumeric code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  room_code  VARCHAR(8)  PRIMARY KEY,
  room_state JSONB       NOT NULL DEFAULT '{"queue":[],"current":0,"playing":false}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
-- Playlists by owner (fetched on every dashboard load)
CREATE INDEX IF NOT EXISTS idx_playlists_user_id
  ON playlists (user_id);

-- Tracks by parent playlist
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id
  ON playlist_tracks (playlist_id);

-- Ordered track retrieval within a playlist
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position
  ON playlist_tracks (playlist_id, position);

-- Stale-room cleanup queries
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at
  ON rooms (updated_at);
