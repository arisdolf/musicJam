import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const starterTracks = [
  { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio 📚 - beats to relax / study to', artist: 'Lofi Girl', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
  { id: '5qap5aO4i9A', title: 'lofi hip hop radio — beats to relax / study to', artist: 'Lofi Girl', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
  { id: 'DWcJFNfaw9c', title: 'The Best Of Erykah Badu', artist: 'Chill Music Lab', duration: '1:02:14', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' },
]

function Icon({ name, size = 18 }) {
  const paths = {
    note: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>,
    pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/></>,
    skip: <><path d="m5 5 10 7-10 7zM19 5v14"/></>,
    shuffle: <><path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2c5 0 7-12 12-12h6M2 6h2c1.8 0 3.2 1.4 4.4 3.2M13 14.8c1 1.7 2.3 3.2 4 3.2h5"/></>,
    volume: <><path d="m11 5-6 5H2v4h3l6 5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    headphones: <><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M5 14h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2ZM17 14h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function getRoomId() {
  const url = new URL(window.location.href)
  return url.searchParams.get('room') || 'SOUND-482'
}

function getStoredRoom(roomId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`jamroom:${roomId}`) || 'null')
    return saved || { queue: starterTracks, current: 0, playing: false }
  } catch { return { queue: starterTracks, current: 0, playing: false } }
}

function App() {
  const [roomId, setRoomId] = useState(getRoomId)
  const [room, setRoom] = useState(() => getStoredRoom(getRoomId()))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')
  const playerRef = useRef(null)
  const initialTrackId = useRef(room.queue[room.current]?.id || starterTracks[0].id)
  const [playerReady, setPlayerReady] = useState(false)
  const currentTrack = room.queue[room.current] || starterTracks[0]

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player || playerRef.current) return
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: initialTrackId.current,
        playerVars: { origin: window.location.origin, rel: 0 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (event) => {
            if (event.data === 1) setRoom((state) => state.playing ? state : { ...state, playing: true })
            if (event.data === 2) setRoom((state) => state.playing ? { ...state, playing: false } : state)
          },
        },
      })
    }
    if (window.YT?.Player) createPlayer()
    else {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
      const previousCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previousCallback?.(); createPlayer() }
    }
  }, [])

  useEffect(() => {
    if (!playerReady || !playerRef.current) return
    playerRef.current.loadVideoById(currentTrack.id)
  }, [currentTrack.id, playerReady])

  useEffect(() => {
    if (!playerReady || !playerRef.current) return
    if (room.playing) playerRef.current.playVideo()
    else playerRef.current.pauseVideo()
  }, [room.playing, playerReady])

  useEffect(() => {
    localStorage.setItem(`jamroom:${roomId}`, JSON.stringify(room))
    const channel = new BroadcastChannel(`jamroom:${roomId}`)
    channel.postMessage(room)
    channel.close()
  }, [room, roomId])

  useEffect(() => {
    const channel = new BroadcastChannel(`jamroom:${roomId}`)
    const onMessage = (event) => {
      if (event.data?.queue) setRoom((state) => JSON.stringify(state) === JSON.stringify(event.data) ? state : event.data)
    }
    channel.addEventListener('message', onMessage)
    const onStorage = (event) => {
      if (event.key === `jamroom:${roomId}` && event.newValue) {
        const next = JSON.parse(event.newValue)
        setRoom((state) => JSON.stringify(state) === JSON.stringify(next) ? state : next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => { channel.close(); window.removeEventListener('storage', onStorage) }
  }, [roomId])

  const search = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); setError(''); return }
    if (!API_KEY) { setError('Add VITE_YOUTUBE_API_KEY to your .env file to search YouTube.'); setResults([]); return }
    setSearching(true); setError('')
    try {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '8', q: term, key: API_KEY })
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'YouTube search failed. Check your API key and quota.')
      setResults((data.items || []).map(({ id, snippet }) => ({
        id: id.videoId, title: snippet.title, artist: snippet.channelTitle,
        thumbnail: snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id.videoId}/mqdefault.jpg`, duration: 'VIDEO',
      })))
      if (!data.items?.length) setError('No videos found. Try another search.')
    } catch (e) { setError(e.message) }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350)
    return () => clearTimeout(timer)
  }, [query, search])

  const addTrack = (track) => {
    if (room.queue.some((item) => item.id === track.id)) { setToast('Already in the queue'); setTimeout(() => setToast(''), 1800); return }
    setRoom((state) => ({ ...state, queue: [...state.queue, track] }))
    setToast('Added to the queue'); setTimeout(() => setToast(''), 1800)
  }
  const togglePlay = () => setRoom((state) => ({ ...state, playing: !state.playing }))
  const nextTrack = () => setRoom((state) => ({ ...state, current: (state.current + 1) % Math.max(state.queue.length, 1), playing: true }))
  const playTrack = (index) => setRoom((state) => ({ ...state, current: index, playing: true }))
  const invite = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setToast(`Share this room: ${window.location.href}`); setTimeout(() => setToast(''), 4000) }
  }
  const makeRoom = () => {
    const next = Math.random().toString(36).slice(2, 7).toUpperCase()
    const url = new URL(window.location.href); url.searchParams.set('room', next); window.history.pushState({}, '', url)
    setRoomId(next); setRoom(getStoredRoom(next)); setQuery(''); setResults([])
  }
  const visibleTracks = useMemo(() => results, [results])

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="Jamroom home"><span className="brand-mark"><Icon name="note" size={21}/></span><span>jam<span className="brand-light">room</span></span></a>
      <div className="topbar-center"><span className="live-dot"/> YOUR LISTENING ROOM <span className="top-divider">/</span> <span className="room-code">{roomId}</span></div>
      <div className="top-actions"><button className="button button-quiet new-room" onClick={makeRoom}>New room</button><button className="button button-invite" onClick={invite}><Icon name="link" size={16}/>{copied ? 'Copied!' : 'Invite a friend'}</button><div className="avatar avatar-you" title="You">Y</div></div>
    </header>

    <div className="workspace">
      <section className="main-column">
        <div className="room-heading"><div><div className="eyebrow"><span className="live-dot"/> ROOM IS OPEN</div><h1>Good music.<br/><span>Better together.</span></h1><p className="room-subtitle">A little corner of the internet for you and your people.</p></div><div className="listening-card"><div className="listening-avatars"><div className="avatar avatar-you">Y</div><div className="avatar avatar-guest">?</div></div><div><strong>Just you for now</strong><span>Send a link to bring someone in</span></div><span className="online-badge"><i/> HERE</span></div></div>

        <div className="player-card">
          <div className="player-topline"><span><Icon name="headphones" size={15}/> NOW PLAYING</span><button aria-label="More player options" className="icon-button"><Icon name="dots"/></button></div>
          <div className="player-content"><div className="video-wrap"><div id="youtube-player" title={currentTrack.title}/></div><div className="track-details"><span className="playing-label"><i/> {room.playing ? 'PLAYING IN THE ROOM' : 'READY WHEN YOU ARE'}</span><h2>{currentTrack.title}</h2><p>{currentTrack.artist}</p><div className="player-controls"><button className="icon-button shuffle-button" aria-label="Shuffle"><Icon name="shuffle" size={19}/></button><button className="play-button" aria-label={room.playing ? 'Pause' : 'Play'} onClick={togglePlay}><Icon name={room.playing ? 'pause' : 'play'} size={20}/></button><button className="icon-button" aria-label="Next track" onClick={nextTrack}><Icon name="skip" size={21}/></button><span className="control-spacer"/><span className="video-duration">{currentTrack.duration}</span><Icon name="volume" size={18}/><div className="volume-track"><span/></div></div><div className="sync-note"><span className="sync-icon">↗</span> Music plays in a YouTube player for each listener</div></div></div>
        </div>

        <section className="queue-section"><div className="section-heading"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Up next <span className="count-pill">{room.queue.length}</span></h2></div><button className="text-button" onClick={() => { setQuery(''); document.getElementById('music-search')?.focus() }}><Icon name="plus" size={15}/> Add a song</button></div><div className="queue-list">{room.queue.map((track, index) => <button className={`queue-row ${index === room.current ? 'is-current' : ''}`} key={`${track.id}-${index}`} onClick={() => playTrack(index)}><span className="queue-index">{index === room.current ? <span className="equalizer"><i/><i/><i/></span> : String(index + 1).padStart(2, '0')}</span><img className="queue-thumb" src={track.thumbnail} alt=""/><span className="queue-track"><strong>{track.title}</strong><small>{track.artist}</small></span>{index === room.current && <span className="now-playing-tag">NOW</span>}<span className="queue-duration">{track.duration}</span></button>)}</div></section>
      </section>

      <aside className="sidebar"><section className="search-section"><div className="sidebar-title"><div><div className="eyebrow">FIND YOUR NEXT FAVORITE</div><h2>Search music</h2></div><span className="youtube-mark">▶</span></div><label className="search-box" htmlFor="music-search"><Icon name="search" size={19}/><input id="music-search" placeholder="Search songs, artists, vibes..." value={query} onChange={(e) => setQuery(e.target.value)}/>{query && <button className="clear-search" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={16}/></button>}</label><div className="search-hint">Powered by YouTube</div>
        {query ? <div className="search-results">{searching ? <div className="empty-results"><span className="loader"/>Finding your tune...</div> : error ? <div className="empty-results error-message">{error}</div> : visibleTracks.map((track) => <div className="result-row" key={track.id}><img src={track.thumbnail} alt=""/><div className="result-copy"><strong>{track.title}</strong><small>{track.artist}</small></div><button className="add-button" aria-label={`Add ${track.title}`} onClick={() => addTrack(track)}><Icon name="plus" size={18}/></button></div>)}</div> : <div className="search-empty"><div className="search-empty-icon"><Icon name="search" size={21}/></div><strong>What are we in the mood for?</strong><p>Search by song, artist, or even a feeling.</p><div className="mood-chips">{['late night', 'indie', 'feel good'].map((mood) => <button key={mood} onClick={() => setQuery(mood)}>{mood}</button>)}</div></div>}
      </section>
      <section className="room-info"><div className="info-icon"><Icon name="users" size={18}/></div><div><strong>Make it a room</strong><p>Invite someone and take turns adding songs to the queue.</p><button onClick={invite}>Copy invite link <span>↗</span></button></div></section>
      <footer className="sidebar-footer"><span><i/> ALL EARS</span><span>BUILT FOR SHARED MOMENTS</span></footer>
    </aside>
    </div>
    {toast && <div className="toast">{toast}</div>}
  </main>
}

export default App
