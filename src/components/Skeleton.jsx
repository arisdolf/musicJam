export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function TrackSkeletonList({ count = 5, className = '', announce = true }) {
  return <div className={`skeleton-track-list ${className}`} role={announce ? 'status' : undefined} aria-label={announce ? 'Loading songs' : undefined} aria-hidden={announce ? undefined : true}>
    {announce && <span className="sr-only">Loading songs…</span>}
    {Array.from({ length: count }, (_, index) => <div className="skeleton-track" key={index}>
      <Skeleton className="skeleton-cover" />
      <span className="skeleton-track-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-subtitle" /></span>
      <Skeleton className="skeleton-action" />
    </div>)}
  </div>
}

export function PageSkeleton() {
  return <div className="page page-skeleton" role="status" aria-label="Loading page">
    <span className="sr-only">Loading page…</span>
    <Skeleton className="page-skeleton-title" />
    <Skeleton className="page-skeleton-description" />
    <div className="page-skeleton-content"><TrackSkeletonList count={4} announce={false} /></div>
  </div>
}

export function LyricsSkeleton() {
  return <div className="lyrics-skeleton" role="status" aria-label="Loading lyrics">
    <span className="sr-only">Loading lyrics…</span>
    <Skeleton className="lyrics-line short" />
    <Skeleton className="lyrics-line current" />
    <Skeleton className="lyrics-line medium" />
  </div>
}
