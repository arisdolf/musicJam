const PLACEHOLDER_CREDIT = /^(?:unknown(?:\s+(?:artist|song|track|title))?|artist\s+unknown|song\s+unknown|various\s+artists?|n\/a|not\s+available|untitled(?:\s+(?:song|track))?|no\s+(?:artist|title)|undefined|null)$/i

export function isKnownSong(track) {
  const title = String(track?.title || '').trim().replace(/\s+/g, ' ')
  const artist = String(track?.artist || '').trim().replace(/\s+/g, ' ')
  return Boolean(track?.id && title && artist)
    && !PLACEHOLDER_CREDIT.test(title)
    && !PLACEHOLDER_CREDIT.test(artist)
}

export function filterKnownSongs(tracks) {
  return Array.isArray(tracks) ? tracks.filter(isKnownSong) : []
}
