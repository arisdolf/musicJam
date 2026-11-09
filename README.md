# Jamroom

A shared listening room prototype built with React and Vite. Search for YouTube videos by song, artist, or mood, add them to a queue, and play them in the embedded YouTube player.

## Run it

1. Copy `.env.example` to `.env`.
2. Set `VITE_YOUTUBE_API_KEY` to a YouTube Data API v3 key with the YouTube Data API enabled.
3. Run `npm install` and `npm run dev`.

The API key is used in browser requests, so restrict it to your deployed website's referrer and enable only the YouTube Data API in Google Cloud. YouTube search can return quota or API-key errors in the search panel.

## Rooms and synchronization

Room IDs are stored in the `?room=` URL parameter. Queue, current track, and play/pause updates are shared between tabs on the same browser using `BroadcastChannel` and local storage. Invite links let someone open the same room, but this prototype does not synchronize between different devices or browsers. Cross-device rooms need a realtime backend (for example, Supabase Realtime or Firebase) and a server-side room state.

The YouTube iframe player runs separately for each listener. Playback can be affected by browser autoplay rules, video availability, and YouTube's embedding restrictions.
