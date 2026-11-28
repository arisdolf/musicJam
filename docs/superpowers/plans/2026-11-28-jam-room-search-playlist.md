# Jam Room Search, Recommendations, and Playlist Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Jam Room song search, make recommendations more locally relevant, and keep playlist highlighting synced with active playback while preserving the berry theme.

**Architecture:** Reuse `useSongSearch` and existing YouTube search data, improving result placement and ranking in the service. Use existing recommendation sources with stronger OPM and Philippines-chart priority. Pass the app’s current track into Playlists so row state follows shared playback.

**Tech Stack:** React 19, Vite 8, JavaScript, YouTube Data API, Firebase Realtime Database, existing CSS tokens.

**Spec:** `docs/superpowers/specs/2026-11-28-jam-room-search-playlist-design.md`

## Global Constraints

- Use the current React/Vite structure, `useSongSearch`, YouTube service, shared playback state, and existing berry/light/dark tokens.
- Keep search and recommendations compatible with current quota limits.
- Do not replace YouTube search, change queue semantics, or add dependencies.
- Do not remove K-pop or other explicitly selected international music.
- Do not claim reliable artist-country detection; available track metadata does not establish artist origin.
- Do not change the existing color theme or unrelated screens.

## Review Focus

- Rapid query changes and aborted requests must never show results for an older query. The owning search task will retain the hook’s abort behavior and render only the active query’s result state.
- Empty and shorter-than-minimum queries must not call YouTube or leave a blank unexplained result region. The search task will show a short input hint.
- Exact title matches must outrank weaker matches without hiding relevant niche songs. The search task will rank title fit first, then popularity, then existing audio quality and API order.
- Locally relevant recommendations must not break an explicitly selected K-pop or other international genre. The recommendation task will keep genre feeds and artist similarity while adding OPM and Philippines-chart sources.
- Playlist highlights must follow automatic next, shuffle, pause, and room/local playback changes. The playlist task will derive the row ID from the authoritative active track prop.

---

### Task 1: Repair Jam Room song search

**Files:**
- Modify: `src/components/MusicRoom.jsx`
- Modify: `src/services/youtube.js`
- Modify: `src/styles/pages/room.css`

**Interfaces:**
- Consume: `useSongSearch(query)` from `src/hooks/useSongSearch.js`; it returns `waiting`, `tracks`, `error`, `hasMore`, `loadingMore`, and `loadMore`.
- Keep: `SongRow` callbacks and queue behavior unchanged.

- [x] Remove the stale result block that reads undefined `searching`, `searchError`, and `results` from `src/components/MusicRoom.jsx`.
- [x] Move the single paged-results region directly under “Add a song”; render the minimum-query hint, loading skeleton, error/empty message, current-query results, and pagination spinner from the hook state.
- [x] Add accessible result-region labeling and busy/status semantics without changing queue actions.
- [x] In `src/services/youtube.js`, rank cleaned title matches first, then popular results by existing view/year data, then keep the current audio-quality score and YouTube order as tie-breakers. Do not filter out relevant niche results.
- [x] Version the paged-search cache key so old ordering does not persist for the cache lifetime.
- [x] Refine the search/result spacing and mobile behavior in `src/styles/pages/room.css` using existing semantic tokens.

### Task 2: Favor OPM and Philippines-relevant recommendations

**Files:**
- Modify: `src/services/feeds.js`
- Modify: `src/services/youtube.js`

**Interfaces:**
- Consume: existing `getForYou(signal)`, `getGenreFeed(id, signal)`, `getTrending(signal)`, and `getSimilarTracks(seed, signal)` functions.
- Preserve: recommendation track shape and all existing callers.

- [x] Add OPM/Pinoy and Philippines-trending candidates to the personalized feed while retaining artist, mood, and similar-song sources.
- [x] Rank OPM and local chart candidates ahead of equally relevant global suggestions; keep explicit international genre feeds unchanged.
- [x] Increase local chart representation in “Similar vibes” while preserving artist similarity and seed-language choices.
- [x] Version affected recommendation cache keys so users receive the new ordering without waiting for stale cached lists to expire.

### Task 3: Sync playlist highlighting with active playback

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Playlists.jsx`
- Modify: `src/styles/pages/playlists.css`

**Interfaces:**
- Consume: `currentTrack` already derived in `Shell` from the active local or room playback queue.
- Produce: `Playlists({ currentTrack, onBrowse, onPlayTracks, onQueueTrack })`.

- [x] Pass `currentTrack` into the Playlists page from `src/App.jsx`.
- [x] Derive each playlist row’s active state from `currentTrack?.id`; remove click-only `currentTrackId` state and its stale setters.
- [x] Keep the existing berry active-row treatment; its existing styling already matches the updated playback state.

### Task 4: Build and inspect the changed flows

**Files:**
- Review: `src/components/MusicRoom.jsx`, `src/services/youtube.js`, `src/services/feeds.js`, `src/App.jsx`, `src/pages/Playlists.jsx`, and their scoped CSS.

- [x] Run `npm.cmd run build` and resolve any compile errors.
- [ ] Capture Jam Room and playlist at mobile and desktop sizes. The Jam Room screenshot URL (`/?room=DEMO`) repeatedly failed with `Protocol error: connection closed`; root-page screenshots worked.
- [x] Review search states, title ranking, recommendation ordering, and playback highlighting in code; inspect the final diff and keep temporary screenshots out of tracked changes. The Jam Room browser render could not be inspected.
- [x] Run scoped ESLint and `git diff --check`; both passed with no errors.
