// Parses an Exportify CSV into [{ title, artist, duration }] (duration in seconds).

export function parseCsv(text) {
  const src = String(text).replace(/^\uFEFF/, '')
  const rows = []
  let row = [], field = '', quoted = false

  const endRow = () => {
    row.push(field); field = ''
    if (row.some((value) => value !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const char = src[i]
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && src[i + 1] === '\n') i++
      endRow()
    } else field += char
  }
  endRow()
  return rows
}

export function parseExportifyCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('This CSV is empty.')

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const titleCol = header.findIndex((cell) => cell === 'track name')
  const artistCol = header.findIndex((cell) => cell.startsWith('artist name'))
  const durationCol = header.findIndex((cell) => cell.startsWith('duration'))
  if (titleCol < 0) throw new Error('This does not look like an Exportify CSV (no "Track Name" column).')

  const seen = new Set()
  const songs = []
  for (const row of rows.slice(1)) {
    const title = (row[titleCol] || '').trim()
    if (!title) continue
    const artist = artistCol >= 0 ? (row[artistCol] || '').split(/[;,]/)[0].trim() : ''
    const ms = durationCol >= 0 ? Number(row[durationCol]) : 0
    const key = `${title}|${artist}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    songs.push({ title, artist, duration: ms ? Math.round(ms / 1000) : 0 })
  }
  return songs
}