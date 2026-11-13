CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,      -- always stored lowercase
  name          text NOT NULL,
  password_hash text,                      -- NULL for Google-only accounts later
  google_id     text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE playlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX playlists_user_idx ON playlists (user_id);

CREATE TABLE playlist_tracks (
  id          bigserial PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  video_id    text NOT NULL,
  title       text NOT NULL,
  artist      text NOT NULL,
  thumbnail   text,
  duration    integer,
  lyrics_id   bigint,
  position    integer NOT NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, video_id)
);

CREATE TABLE rooms (
  code       text PRIMARY KEY,
  queue      jsonb   NOT NULL DEFAULT '[]',
  current    integer NOT NULL DEFAULT 0,
  playing    boolean NOT NULL DEFAULT false,
  version    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE room_members (
  code      text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  client_id text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, client_id)
);