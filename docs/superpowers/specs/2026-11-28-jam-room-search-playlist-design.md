# Jam Room search and playback design

## Intent

Make Jam Room song search reliable, keep playlist highlighting synced to the song actually playing, and make recommendations feel more local. Refine the room and playlist UI without changing Melojam’s berry theme.

## Goals

- Render search results below “Add a song,” rank matching titles and popular results first, and show useful loading, empty, and error states.
- Derive playlist highlighting from the shared playback queue so it follows automatic next-song changes.
- Favor OPM and Philippines chart relevance in recommendations while preserving strong matches and explicitly chosen international genres.
- Improve spacing, hierarchy, and responsive behavior using existing theme tokens.

## Non-goals and anti-goals

- Do not replace YouTube search, change queue semantics, or add dependencies.
- Do not remove K-pop or other explicitly selected international music.
- Do not claim reliable artist-country detection; available track metadata does not establish artist origin.
- Do not change the existing color theme or unrelated screens.

## Constraints

Use the current React/Vite structure, `useSongSearch`, YouTube service, shared playback state, and existing berry/light/dark tokens. Keep search and recommendations compatible with current quota limits.

## Approaches

1. **Repair existing flows (recommended):** reconnect Jam Room to its existing search hook, rank title matches and view counts, use shared playback state for playlist highlighting, and tune recommendation ordering toward OPM and Philippines trends. This fixes the observed causes with limited scope.
2. **Replace search and recommendation plumbing:** introduce new data paths and state across the app. This adds quota and playback risk without addressing a need the current services cannot meet.

## Design

The current Jam Room JSX reads removed search variables and places the hook’s results under “Similar vibes.” Put one search-results region under the input and use the existing hook states. Rank exact or close title matches ahead of weaker matches, then use popularity as a tie-breaker while keeping relevant niche results available.

Playlist rows currently highlight a locally clicked track. Use the active track from the app’s shared playback state instead, so the highlight advances with the player in local playback and rooms.

Recommendations should favor OPM and songs performing in the Philippines. Preserve artist and mood similarity, plus explicit international genre choices. This treats “foreign” as a local-relevance concern because the available data cannot reliably classify artist nationality.

Keep the current berry/red accents, semantic colors, and light/dark modes. Limit visual changes to the Jam Room search, recommendation, queue, and playlist rows.
