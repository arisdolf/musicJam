import { useEffect, useRef, useState } from 'react'
import { Check, Loader, Play, Plus, Search, X } from 'lucide-react'
import { quickSearch, getTrackDetails } from '../services/youtube'
import AddToPlaylist from './AddToPlaylist'

const IDLE = { query: '', status: 'idle', results: [], error: '' }
const DEBOUNCE_MS = 300   // wait this long after the last keystroke
const MIN_CHARS = 3       // don't search for 1 or 2 letters

export default function HomeSearch({ onPlaySong, onQueueTrack }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [state, setState] = useState(IDLE)
    const [busyId, setBusyId] = useState('')
    const [queuedIds, setQueuedIds] = useState([])
    const inputRef = useRef(null)
    const q = query.trim()

    // Search automatically after the user pauses typing.
    useEffect(() => {
        if (q.length < MIN_CHARS) return undefined
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setState((prev) => ({ ...prev, query: q, status: 'loading', error: '' })) // keeps the old results visible
            try {
                const results = await quickSearch(q, controller.signal)
                if (controller.signal.aborted) return
                setState({ query: q, status: 'done', results, error: results.length ? '' : 'No songs found. Try another search.' })
            } catch (error) {
                if (error.name === 'AbortError' || controller.signal.aborted) return
                setState({ query: q, status: 'done', results: [], error: error.message || 'Search failed.' })
            }
        }, DEBOUNCE_MS)
        return () => { clearTimeout(timer); controller.abort() }
    }, [q])

    const openBar = () => {
        setOpen(true)
        inputRef.current?.focus()
    }

    const closeBar = () => {
        setOpen(false)
        setQuery('')
        setState(IDLE)
        setQueuedIds([])
    }

    // Enter still works: it just blurs the input so the phone keyboard closes.
    const submit = (event) => {
        event.preventDefault()
        inputRef.current?.blur()
    }

    const choose = async (track) => {
        if (busyId) return
        setBusyId(track.id)
        try { await onPlaySong(await getTrackDetails(track)) }
        finally { setBusyId(''); closeBar() }
    }

    const queue = (track, trigger) => {
        onQueueTrack?.(track, trigger)
        setQueuedIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id])
    }

    const waiting = q.length >= MIN_CHARS && (state.query !== q || state.status === 'loading')
    const results = state.results
    const error = waiting ? '' : state.error
    const showPanel = open && q.length >= MIN_CHARS && (results.length > 0 || waiting || Boolean(error))

    return <div className="home-search">
        <div className={`hs-bar${open ? ' open' : ''}`}>
            <button type="button" className="hs-toggle" onClick={open ? () => inputRef.current?.focus() : openBar} aria-label="Search songs" aria-expanded={open}>
                <Search size={19} />
            </button>
            <form className="hs-form" onSubmit={submit} role="search">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Escape') closeBar() }}
                    placeholder="Search a song or artist"
                    aria-label="Search a song or artist"
                    enterKeyHint="done"
                    autoComplete="off"
                    tabIndex={open ? 0 : -1}
                />
                <button type="button" className="icon-btn" onClick={closeBar} aria-label="Close search" tabIndex={open ? 0 : -1}><X size={18} /></button>
            </form>
        </div>

        {showPanel && <div className={`results hs-results${waiting ? ' is-stale' : ''}`}>
            {waiting && !results.length && <p className="message"><Loader size={14} className="spin" /> Searching…</p>}
            {error && <p className="message">{error}</p>}
            {results.map((track) => {
                const queued = queuedIds.includes(track.id)
                return <div className={`track hs-row${busyId === track.id ? ' is-busy' : ''}`} key={track.id}>
                    <img src={track.thumbnail} alt="" />
                    <button className="track-text as-button" onClick={() => choose(track)} disabled={Boolean(busyId)}>
                        <strong>{track.title}</strong><small>{track.artist}</small>
                    </button>
                    <div className="track-actions">
                        <AddToPlaylist track={track} />
                        <button className="icon-btn" onClick={() => choose(track)} disabled={Boolean(busyId)} aria-label={`Play ${track.title}`} title="Play now">
                            {busyId === track.id ? <Loader size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
                        </button>
                        <button className="icon-btn add-btn" onClick={(event) => queue(track, event.currentTarget)} disabled={queued} aria-label={`Add ${track.title} to queue`} title={queued ? 'In queue' : 'Add to queue'}>
                            {queued ? <Check size={16} /> : <Plus size={17} />}
                        </button>
                    </div>
                </div>
            })}
            {busyId && <p className="message">Playing, and adding similar songs to your queue…</p>}
        </div>}
    </div>
}