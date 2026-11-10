import { ExternalLink, Music2, SkipBack, SkipForward } from 'lucide-react'

export default function PlaylistPlayer({ track, position, count, onPrevious, onNext }) {
  if (!track) return null
  const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(track.id)}`
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(track.id)}?autoplay=1&controls=1&playsinline=1&rel=0`

  return <section className="inline-player-card" aria-label="Playlist player">
    <div className="inline-player-video">
      <iframe
        key={track.id}
        src={embedUrl}
        title={`${track.title} by ${track.artist}`}
        allow="autoplay; encrypted-media; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
    <div className="inline-player-bar">
      <div className="inline-player-info">
        <span className="now-playing-icon"><Music2 size={17} /></span>
        <div><span className="eyebrow">NOW PLAYING · {position + 1} OF {count}</span><strong title={track.title}>{track.title}</strong><small>{track.artist}</small></div>
      </div>
      <div className="inline-player-controls">
        <button className="icon-btn" onClick={onPrevious} disabled={position <= 0} aria-label="Play previous song"><SkipBack size={17} /></button>
        <button className="icon-btn" onClick={onNext} disabled={position >= count - 1} aria-label="Play next song"><SkipForward size={17} /></button>
        <a className="icon-btn" href={videoUrl} target="_blank" rel="noreferrer" aria-label="Open song on YouTube" title="Open on YouTube"><ExternalLink size={16} /></a>
      </div>
    </div>
  </section>
}
