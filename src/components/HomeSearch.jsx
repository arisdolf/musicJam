import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useSongSearch } from '../hooks/useSongSearch'
import { Spinner, TrackSkeletonList } from './Skeleton'
import LikeButton from './LikeButton'
import TrackMenu from './TrackMenu'

const MIN_CHARS = 3

export default function HomeSearch({ onPlaySong, onQueueTrack, className = '' }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [busyId, setBusyId] = useState('')
    const [playingId, setPlayingId] = useState('')
    const [queuedIds, setQueuedIds] = useState([])
    const inputRef = useRef(null)
    const resultsRef = useRef(null)
    const sentinelRef = useRef(null)
    const { q, tracks: results, error: searchError, waiting, loadingMore, hasMore, loadMore } = useSongSearch(query, { minChars: MIN_CHARS })

    const error = waiting ? '' : searchError
    const showPanel = open && q.length >= MIN_CHARS && (results.length > 0 || waiting || Boolean(error))

    // Load the next page when the bottom of the list scrolls into view.
    useEffect(() => {
        const root = resultsRef.current
        const node = sentinelRef.current
        if (!root || !node || !hasMore) return undefined
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) loadMore() },
            { root, rootMargin: '0px 0px 180px 0px' },
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [hasMore, loadMore, results.length, showPanel])

    const openBar = () => { setOpen(true); inputRef.current?.focus() }

    const closeBar = () => {
        setOpen(false); setQuery('')
        setQueuedIds([]); setPlayingId('')
    }

    const clearQuery = () => {
        setQuery(''); setQueuedIds([]); setPlayingId('')
        inputRef.current?.focus()
    }

    const clearOrClose = () => query.trim() ? clearQuery() : closeBar()
    const submit = (event) => { event.preventDefault(); inputRef.current?.blur() }

    // Playing keeps the results open so you can keep picking songs.
    const choose = (track) => {
        if (busyId) return
        setBusyId(track.id)
        try {
            onPlaySong(track) // similar songs load in the background
            setPlayingId(track.id)
            setQueuedIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id])
        } finally { setBusyId('') }
    }

    const queue = (track, trigger) => {
        onQueueTrack?.(track, trigger)
        setQueuedIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id])
    }

    return <div className={`home-search${className ? ` ${className}` : ''}${open ? ' is-open' : ''}`}>
        <div className={`hs-bar${open ? ' open' : ''}`}>
            <button type="button" className="hs-toggle" onClick={open ? closeBar : openBar} aria-label={open ? 'Close search' : 'Search songs'} aria-expanded={open}>
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
                <button type="button" className="icon-btn hs-clear" onClick={clearOrClose} aria-label={query.trim() ? 'Clear search' : 'Close search'} tabIndex={open ? 0 : -1}><X size={18} /></button>
            </form>
        </div>

        {showPanel && <div ref={resultsRef} className={`results hs-results${waiting ? ' is-stale' : ''}`}>
            {waiting && !results.length && <TrackSkeletonList count={4} actions={2} className="search-skeleton" />}
            {error && !results.length && <p className="message">{error}</p>}
            {results.map((track) => {
                const busy = busyId === track.id
                const playing = playingId === track.id
                return <div className={`track hs-row${playing ? ' active' : ''}`} key={track.id} aria-busy={busy || undefined}>
                    <span className={`hs-art${playing && !busy ? ' is-playing' : ''}`}>
                        <img src={track.thumbnail} alt="" loading="lazy" decoding="async" />
                        {busy && <span className="hs-art-state"><Spinner size={20} label="Loading song" /></span>}
                        {playing && !busy && <span className="eq-bars" aria-hidden="true"><i /><i /><i /></span>}
                    </span>
                    <button className="track-text as-button" onClick={() => choose(track)} aria-label={`Play ${track.title}`}>
                        <strong>{track.title}</strong><small>{track.artist}</small>
                    </button>
                    <div className="track-actions">
                        <LikeButton track={track} />
                        <TrackMenu
                            track={track}
                            onPlay={() => choose(track)}
                            onQueue={(trigger) => queue(track, trigger)}
                            queued={queuedIds.includes(track.id)}
                        />
                    </div>
                </div>
            })}
            {hasMore && <div ref={sentinelRef} className="hs-more">{loadingMore && <Spinner size={20} label="Loading more songs" />}</div>}
            {error && results.length > 0 && <p className="message">{error}</p>}
        </div>}
    </div>
}