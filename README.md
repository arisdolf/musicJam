# Jamroom

A small shared music player built with React + Vite, a Node.js API/WebSocket server, and PostgreSQL. Accounts and playlists are stored in PostgreSQL; room state is also persisted there and synchronized over WebSockets.

## Local development

1. Install Node.js 20 or newer and PostgreSQL (or create a free Neon PostgreSQL database).
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to your PostgreSQL connection string and set `JWT_SECRET` to a long random value. Add a YouTube Data API v3 key to `VITE_YOUTUBE_API_KEY`.
4. Run `npm install`.
5. In one terminal run `npm start` (API and WebSocket server on port 3001).
6. In another terminal run `npm run dev` (Vite on port 5173).

The Vite development server proxies `/api`, `/health`, and `/ws` to port 3001. Database tables are created automatically at server startup.

## Deployment

Recommended split deployment:

- **Frontend:** deploy this repository to Vercel. Set `VITE_API_URL` to your Render service URL, `VITE_ROOM_SERVER_URL` to `wss://YOUR-RENDER-SERVICE.onrender.com/ws`, and `VITE_YOUTUBE_API_KEY` to your YouTube API key. Redeploy after setting variables.
- **Backend:** deploy the repository to Render as a Web Service. The included `render.yaml` uses `npm install` and `npm start`. Set `DATABASE_URL` to a PostgreSQL connection string (Neon is a convenient hosted PostgreSQL option), and set `CLIENT_ORIGIN` to the exact Vercel site origin, e.g. `https://your-app.vercel.app`.
- **Secrets:** Render needs `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN`. Do not put these in Vite variables or commit them. Vite variables are public in the browser bundle.

The free Render service may sleep when idle, so the first request after inactivity can take longer. Check current free-tier limits for your hosting and database providers before relying on them for production.

## Database tables

- `users`: account identity and bcrypt password hashes
- `playlists`: playlists owned by a user
- `playlist_tracks`: YouTube tracks belonging to a playlist
- `rooms`: latest shared room queue and playback state

Passwords are hashed with bcrypt. API requests for playlists require a signed bearer token. Room codes are intentionally shareable; anyone with a room code can join that room.

## Notes

- YouTube search requires a Google Cloud API key with YouTube Data API v3 enabled. Restrict the key to your deployed website referrer and API usage.
- Each listener has their own YouTube player. Mobile browsers may require a local tap before playback due to autoplay restrictions.
- The API bearer token is stored in browser localStorage for this starter implementation; use HTTPS in production and avoid adding untrusted scripts. Existing browser-only accounts and playlists are not migrated automatically. They remain in the old browser's localStorage; export or recreate anything important before switching.
