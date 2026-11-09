# Jamroom

A small, mobile-first shared music player. Create a room or enter a room code, search YouTube by song or artist, and add tracks to the shared queue.

## Start locally

1. Copy `.env.example` to `.env` and add a YouTube Data API v3 key.
2. In one terminal run `npm install` and `npm run server`.
3. In another terminal run `npm run dev`.
4. Open the Vite address. On a phone on the same Wi-Fi, use the computer's LAN address and port shown by Vite.

Vite proxies `/ws` to the room server. The server listens on port `3001`. For YouTube search, enable the YouTube Data API in Google Cloud and restrict the key to your website's referrer.

## Room sharing

Room codes and `?room=CODE` links are the same join flow. The room server shares the queue and play/pause/track selection between connected devices. The included server keeps room state in memory, so rooms reset when it restarts. For a public deployment, host `server/server.js` on a reachable server and set `VITE_ROOM_SERVER_URL` to its WebSocket URL (for example `wss://your-server.example/ws`). Use HTTPS/WSS in production.

Each listener has their own YouTube player. They may need to press play once because mobile browsers can block remote autoplay. Video availability and embedding are subject to YouTube.
