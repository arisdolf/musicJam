const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY

export async function searchYouTube(query, signal) {
  return searchMusic(query, { signal, limit: 8, order: 'relevance' })
}

export async function searchPopularSongs(query, signal) {
  return searchMusic(query, { signal, limit: 25, order: 'viewCount' })
}

async function searchMusic(query, { signal, limit, order }) {
  if (!apiKey) throw new Error('YouTube search needs a VITE_YOUTUBE_API_KEY in .env.')
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', videoCategoryId: '10',
    videoEmbeddable: 'true', videoSyndicated: 'true',
    maxResults: order === 'viewCount' ? '50' : '25', order, q: query, key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'YouTube search failed.')
  const candidates = (data.items || []).filter((item) => item.id?.videoId)
  if (!candidates.length) return []

  const detailsParams = new URLSearchParams({
    part: 'snippet,status,contentDetails', id: candidates.map((item) => item.id.videoId).join(','), key: apiKey,
  })
  const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams}`, { signal })
  const detailsData = await detailsResponse.json()
  if (!detailsResponse.ok) throw new Error(detailsData.error?.message || 'Could not check song availability.')
  const playableIds = new Set((detailsData.items || [])
    .filter((item) => item.snippet?.categoryId === '10' && item.status?.embeddable && item.status?.privacyStatus === 'public' && isAvailableInRegion(item.contentDetails, 'PH'))
    .map((item) => item.id))

  return candidates.filter(({ id }) => playableIds.has(id.videoId)).slice(0, limit).map(({ id, snippet }) => ({
    id: id.videoId,
    title: snippet.title,
    artist: snippet.channelTitle,
    thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id.videoId}/mqdefault.jpg`,
  }))
}

export async function getPopularMusic(regionCode = 'PH', signal) {
  if (!apiKey) throw new Error('YouTube search needs a VITE_YOUTUBE_API_KEY in .env.')
  const params = new URLSearchParams({
    part: 'snippet,statistics,status,contentDetails', chart: 'mostPopular', regionCode,
    videoCategoryId: '10', maxResults: '25', key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Could not load popular music.')
  return (data.items || [])
    .filter((item) => item.status?.embeddable && item.snippet?.categoryId === '10' && isAvailableInRegion(item.contentDetails, regionCode))
    .slice(0, 8)
    .map(({ id, snippet, statistics }) => ({
    id,
    title: snippet.title,
    artist: snippet.channelTitle,
    thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    views: Number(statistics?.viewCount || 0),
  }))
}

function isAvailableInRegion(details, regionCode) {
  if (details?.contentRating?.ytRating === 'ytAgeRestricted') return false
  const restriction = details?.regionRestriction
  if (!restriction) return true
  if (restriction.blocked?.includes(regionCode)) return false
  if (restriction.allowed && !restriction.allowed.includes(regionCode)) return false
  return true
}
