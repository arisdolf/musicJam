export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function TrackSkeletonList({ count = 5, className = '', announce = true, actions = 1 }) {
  return <div className={`skeleton-track-list${actions > 1 ? ` actions-${actions}` : ''} ${className}`} role={announce ? 'status' : undefined} aria-label={announce ? 'Loading songs' : undefined} aria-hidden={announce ? undefined : true}>
    {announce && <span className="sr-only">Loading songs…</span>}
    {Array.from({ length: count }, (_, index) => <div className="skeleton-track" key={index}>
      <Skeleton className="skeleton-cover" />
      <span className="skeleton-track-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-subtitle" /></span>
      <span className="skeleton-actions">{Array.from({ length: actions }, (_, action) => <Skeleton className="skeleton-action" key={action} />)}</span>
    </div>)}
  </div>
}

export function HomeTrackSkeletonList({ count = 5 }) {
  return <div className="home-track-skeleton-list" role="status" aria-label="Loading trending songs">
    <span className="sr-only">Loading trending songs…</span>
    {Array.from({ length: count }, (_, index) => <div className="home-track-skeleton" key={index}>
      <Skeleton className="home-skeleton-rank" />
      <Skeleton className="skeleton-cover" />
      <span className="skeleton-track-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-subtitle" /></span>
      <span className="home-skeleton-actions"><Skeleton /><Skeleton /><Skeleton /></span>
    </div>)}
  </div>
}

export function PlaylistListSkeleton({ count = 3, className = '', announce = true }) {
  return <div className={`playlist-list-skeleton ${className}`} role={announce ? 'status' : undefined} aria-label={announce ? 'Loading playlists' : undefined} aria-hidden={announce ? undefined : true}>
    {announce && <span className="sr-only">Loading playlists…</span>}
    {Array.from({ length: count }, (_, index) => <div className="playlist-row-skeleton" key={index}>
      <span><Skeleton className="playlist-skeleton-name" /><Skeleton className="playlist-skeleton-count" /></span>
      <Skeleton className="playlist-skeleton-check" />
    </div>)}
  </div>
}

function PageHeadingSkeleton() {
  return <>
    <Skeleton className="page-skeleton-title" />
    <Skeleton className="page-skeleton-description" />
  </>
}

function PlaylistPageSkeleton() {
  return <>
    <PageHeadingSkeleton />
    <div className="skeleton-page-actions"><Skeleton /><Skeleton /></div>
    <div className="playlist-cards-skeleton">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="playlist-card-skeleton">
        <Skeleton className="playlist-card-cover-skeleton" />
        <Skeleton className="playlist-card-title-skeleton" />
        <Skeleton className="playlist-card-count-skeleton" />
      </div>)}
    </div>
  </>
}

function RecentPageSkeleton() {
  return <>
    <PageHeadingSkeleton />
    <div className="recent-skeleton-list">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="recent-row-skeleton">
        <span><Skeleton className="recent-code-skeleton" /><Skeleton className="recent-time-skeleton" /></span>
        <Skeleton className="recent-button-skeleton" />
      </div>)}
    </div>
  </>
}

function SettingsPageSkeleton({ section }) {
  if (section === 'friends') return <>
    <PageHeadingSkeleton />
    <Skeleton className="friends-search-skeleton" />
    <FriendRowsSkeleton count={3} announce={false} />
  </>
  if (section === 'quota') return <>
    <PageHeadingSkeleton />
    <Skeleton className="quota-summary-skeleton" />
    <div className="quota-cards-skeleton">{Array.from({ length: 3 }, (_, index) => <div key={index} className="quota-card-skeleton">
      <Skeleton className="quota-card-title-skeleton" /><Skeleton className="quota-card-badge-skeleton" />
      <Skeleton className="quota-card-bar-skeleton" /><Skeleton className="quota-card-meta-skeleton" />
    </div>)}</div>
  </>
  return <>
    <PageHeadingSkeleton />
    {[0, 1, 2].map((index) => <div key={index} className="settings-card-skeleton">
      <Skeleton className="settings-card-heading-skeleton" />
      <Skeleton className="settings-card-copy-skeleton" />
      <Skeleton className="settings-card-row-skeleton" />
    </div>)}
  </>
}

function RoomPageSkeleton({ joined }) {
  return <>
    {joined ? <>
      <div className="room-actions-skeleton"><Skeleton /><Skeleton /></div>
      <Skeleton className="room-status-skeleton" />
      <Skeleton className="room-search-skeleton" />
      <TrackSkeletonList count={3} announce={false} actions={4} />
      <Skeleton className="room-section-heading-skeleton" />
      <PlaylistListSkeleton count={2} announce={false} />
    </> : <>
      <PageHeadingSkeleton />
      <Skeleton className="room-search-skeleton" />
      <Skeleton className="room-submit-skeleton" />
    </>}
  </>
}

export function FriendRowsSkeleton({ count = 3, announce = true }) {
  return <div className="friend-rows-skeleton" role={announce ? 'status' : undefined} aria-label={announce ? 'Loading friends' : undefined} aria-hidden={announce ? undefined : true}>
    {announce && <span className="sr-only">Loading friends…</span>}
    {Array.from({ length: count }, (_, index) => <div className="friend-row-skeleton" key={index}>
      <Skeleton className="friend-skeleton-avatar" />
      <Skeleton className="friend-skeleton-name" />
      <Skeleton className="friend-skeleton-action" />
    </div>)}
  </div>
}

export function PageSkeleton({ view, roomCode, settingsSection }) {
  let content
  if (view === 'playlists') content = <PlaylistPageSkeleton />
  else if (view === 'recent') content = <RecentPageSkeleton />
  else if (view === 'settings') content = <SettingsPageSkeleton section={settingsSection} />
  else if (view === 'create') content = <RoomPageSkeleton joined={Boolean(roomCode)} />
  else content = <><PageHeadingSkeleton /><TrackSkeletonList count={4} announce={false} /></>

  return <div className={`page page-skeleton page-skeleton-${view || 'default'}`} role="status" aria-label="Loading page">
    <span className="sr-only">Loading page…</span>
    {content}
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
