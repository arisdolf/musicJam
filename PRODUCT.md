# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Inferred, pending confirmation:** People who want to listen to music together with friends, including remotely. The product supports both joining a room with a shareable code and inviting friends from an account.

## Product Purpose

Melojam lets people discover songs, build a queue, and listen together in real time in a shared room. **Inferred, pending confirmation:** success means friends can quickly join the same room and enjoy synchronized playback with a shared queue.

## Positioning

- **Inferred, pending confirmation:** The product centers group listening on shareable room codes and synchronized playback, with each listener playing YouTube videos in their own player. Friends, invitations, search, and playlists support that shared session.

## Operating Context

- Listeners can create a room or join with an alphanumeric code containing 4 to 8 characters, or with an invite link.
- Anyone who has a room code can join; the code is intentionally shareable.
- Room members share playback state and a queue. Each listener has their own YouTube player.
- Users can search for songs, explore trending music in the Philippines, save playlists and liked songs, and invite friends.
- Local playback and its queue are available outside a room; recent room codes and local playback state are stored in browser storage.

## Capabilities and Constraints

- The product is a web app built with React and Vite. It is installable as a PWA and supports light, dark, and system themes.
- Music search and playback use YouTube. Song search is filtered to videos with matching timestamped lyrics from LRCLIB; trending songs are sourced from YouTube's Philippines chart.
- YouTube API quota limits affect discovery and search. The app has a quota status view.
- Mobile browsers may require a user tap before playback because of autoplay restrictions.
- Accounts support email/password and Google sign-in. Friends, room invitations, liked songs, and saved playlists require an account.
- **Architecture needs confirmation:** the current client uses Firebase Authentication and Realtime Database, while the README describes a Node.js API, WebSocket server, and PostgreSQL persistence. Treat deployed data ownership and migration behavior as undecided until the implementation and documentation are reconciled.
- **Migration constraint:** the README says browser-only accounts and playlists are not migrated automatically; users must export or recreate anything important before switching.

## Brand Commitments

- Current product name: **Melojam** (confirmed by the user; older Jamroom labels in the repository are not the current name).

## Evidence on Hand

- Working interface and product copy in `src/`, including room creation/joining, synchronized playback, search, playlists, friends, settings, and quota status.
- Product description and setup/deployment notes in `README.md`; some data architecture details conflict with current client code and are called out above.
- PWA name and installation metadata in `public/manifest.webmanifest`.
- Do not invent testimonials, user counts, licensing or catalog claims, or service availability guarantees; none are established in the repository.

## Product Principles

- **Inferred:** Make joining a shared listening session straightforward through a room code or invite.
- **Inferred:** Treat room playback and the queue as shared state that listeners can shape together.
- **Inferred:** Keep discovery, playback, and saved music connected so a listening session can continue across rooms and personal queues.
