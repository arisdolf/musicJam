// "Artist - Song (feat. X) [Official Music Video] | HD" -> { title: "Song (feat. X)", artist: "Artist" }
// Keeps feat. and version tags (Remix, Acoustic, Live...), drops the YouTube clutter.

const JUNK = /\b(official|video|audio|lyrics?|lyrical|visuali[sz]er|hd|hq|4k|mv|m\/v|clip|explicit|full|topic|music)\b/i
const VERSION = /\b(remix|acoustic|live|cover|instrumental|remaster(?:ed)?|slowed|sped up|reverb|unplugged|radio edit|edit|version|demo|extended|piano|stripped|session)\b/i
const FEAT_INSIDE = /^\s*(?:feat\.?|ft\.?|featuring)\s+(.+?)\s*$/i
const FEAT_LOOSE = /\s+(?:feat\.?|ft\.?|featuring)\s+(.+?)(?=\s+[-–—|]\s+|$)/i
const TRAILING_JUNK = /\s+[-–—|:]?\s*(?:official\s+(?:music\s+)?(?:video|audio|lyric video)|lyric video|lyrics?|music video|audio|visuali[sz]er|hd|4k)\b.*$/i

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim()
const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function cleanTrackInfo(rawTitle = '', channel = '') {
  let text = clean(rawTitle).replace(/["“”]/g, '')
  const feats = []
  const versions = []

  // 1. Go through every (...) and [...]: feat -> collect, junk -> drop, version -> collect, anything else stays.
  text = text.replace(/[([][^)\]]*[)\]]/g, (group) => {
    const inner = group.slice(1, -1)
    const feat = inner.match(FEAT_INSIDE)
    if (feat) { feats.push(feat[1]); return '' }
    if (JUNK.test(inner)) return ''
    if (VERSION.test(inner)) { versions.push(clean(inner)); return '' }
    return group
  })

  // 2. "feat. X" written without brackets.
  text = text.replace(FEAT_LOOSE, (_, who) => { feats.push(who); return '' })

  // 3. Trailing "- Official Video", "| Lyrics", "HD"...
  text = clean(text.replace(TRAILING_JUNK, ''))

  // 4. Split "Artist - Song". Otherwise use the channel name as the artist.
  const channelArtist = clean(String(channel)
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\bofficial\b/gi, ''))
  let artist = channelArtist
  let title = text
  const parts = text.split(/\s+[-–—|]\s+/).map(clean).filter(Boolean)
  if (parts.length >= 2) {
    artist = parts[0]
    title = parts.slice(1).join(' - ')
    // "Song - Artist": the channel matches the second half, so swap.
    const channelKey = norm(channelArtist)
    if (channelKey.length >= 3 && !norm(parts[0]).includes(channelKey) && norm(parts[1]).includes(channelKey)) {
      artist = parts[1]
      title = parts[0]
    }
  }

  // 5. Put feat. and version back in a tidy, consistent shape.
  const uniqueFeats = [...new Set(feats.map(clean))]
  const uniqueVersions = [...new Set(versions)]
  let display = title || clean(rawTitle)
  if (uniqueFeats.length) display += ` (feat. ${uniqueFeats.join(', ')})`
  for (const version of uniqueVersions) display += ` (${version})`

  return { title: clean(display), artist: artist || clean(channel) }
}