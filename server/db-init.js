/**
 * db-init.js — Run this once to create or migrate the database schema.
 * Usage: node server/db-init.js
 *
 * Safe to re-run; all statements use IF NOT EXISTS / IF EXISTS guards.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const localEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env')
if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath)

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set.')
  process.exit(1)
}

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
})

console.log('🔌  Connecting to database…')
await pool.query('SELECT 1') // smoke-test
console.log('✅  Connected.')

console.log('📐  Creating / verifying schema…')

await pool.query(`
  -- ------------------------------------------------------------------ users
  CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(80)  NOT NULL,
    email         VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- --------------------------------------------------------------- playlists
  CREATE TABLE IF NOT EXISTS playlists (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- --------------------------------------------------------- playlist_tracks
  CREATE TABLE IF NOT EXISTS playlist_tracks (
    id               BIGSERIAL    PRIMARY KEY,
    playlist_id      BIGINT       NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    youtube_video_id VARCHAR(32)  NOT NULL,
    title            TEXT         NOT NULL,
    artist           TEXT         NOT NULL,
    thumbnail        TEXT,
    position         INTEGER      NOT NULL DEFAULT 0,
    UNIQUE (playlist_id, youtube_video_id)
  );

  -- ------------------------------------------------------------------ rooms
  CREATE TABLE IF NOT EXISTS rooms (
    room_code  VARCHAR(8)   PRIMARY KEY,
    room_state JSONB        NOT NULL DEFAULT '{"queue":[],"current":0,"playing":false}',
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
`)

console.log('📑  Creating indexes (if missing)…')

// Index playlists by owner so user playlist lookups are fast.
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_playlists_user_id
    ON playlists (user_id);
`)

// Index tracks by their parent playlist.
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id
    ON playlist_tracks (playlist_id);
`)

// Index rooms by updated_at so stale-room cleanup queries are efficient.
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_rooms_updated_at
    ON rooms (updated_at);
`)

console.log('✅  Schema is up to date.')

// Print a quick summary
const { rows: tables } = await pool.query(`
  SELECT table_name,
         (SELECT COUNT(*) FROM information_schema.columns c
          WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
  FROM information_schema.tables t
  WHERE table_schema = 'public'
  ORDER BY table_name
`)
console.log('\n📊  Tables in database:')
tables.forEach(r => console.log(`    • ${r.table_name}  (${r.col_count} columns)`))

await pool.end()
console.log('\n🎉  Done.')
