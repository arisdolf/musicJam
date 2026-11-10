const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY

export async function searchYouTube(query, signal) {
  if (!apiKey) throw new Error('YouTube search needs a VITE_YOUTUBE_API_KEY in .env.')
  const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '8', q: query, key: apiKey })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'YouTube search failed.')
  return (data.items || []).map(({ id, snippet }) => ({
    id: id.videoId,
    title: snippet.title,
    artist: snippet.channelTitle,
    thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id.videoId}/mqdefault.jpg`,
  }))
}

export async function getPopularMusic(regionCode = 'PH', signal) {
  if (!apiKey) throw new Error('YouTube search needs a VITE_YOUTUBE_API_KEY in .env.')
  const params = new URLSearchParams({
    part: 'snippet,statistics', chart: 'mostPopular', regionCode,
    videoCategoryId: '10', maxResults: '8', key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Could not load popular music.')
  return (data.items || []).map(({ id, snippet, statistics }) => ({
    id,
    title: snippet.title,
    artist: snippet.channelTitle,
    thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    views: Number(statistics?.viewCount || 0),
  }))
}
