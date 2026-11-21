import { useEffect, useState } from 'react'
import { AtSign, Bell, Check, Search, Send, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { useFriends } from '../features/friends/FriendsContext'
import UsernameForm from '../components/UsernameForm'
import FeedbackModal from '../components/FeedbackModal'
import ConfirmModal from '../components/ConfirmModal'
import { FriendRowsSkeleton, Skeleton } from '../components/Skeleton'

function NotificationPrompt() {
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  if (permission === 'unsupported') return <p className="settings-desc">This browser can't show notifications.</p>
  if (permission === 'granted') return <div className="appearance-status"><span className="appearance-status-dot" /> Notifications on</div>
  if (permission === 'denied') return <p className="settings-desc">Notifications are blocked. Allow them in your browser's site settings.</p>
  return <button className="btn btn-small" onClick={async () => setPermission(await Notification.requestPermission())}><Bell size={14} /> Turn on notifications</button>
}

export default function Friends({ roomCode }) {
  const { user, openAuth } = useAccount()
  const {
    profile, profileReady, friends, requests, searchUsers, sendRequest, cancelRequest,
    acceptRequest, declineRequest, removeFriend, sendInvite,
  } = useFriends()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [invited, setInvited] = useState({})
  const username = profile?.username

  useEffect(() => {
    const q = query.trim().replace(/^@/, '')
    if (!user || !username || q.length < 2) { setResults([]); setSearching(false); return undefined }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try { const found = await searchUsers(q); if (!cancelled) setResults(found) }
      catch (err) { if (!cancelled) setError(err.message || 'Search failed.') }
      finally { if (!cancelled) setSearching(false) }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, searchUsers, user, username])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  if (!user) {
    return <main className="page narrow friends-page">
      <div className="playlist-page-heading"><span className="page-icon"><Users size={21} /></span><div><h1>Friends</h1><p className="muted">Add friends and invite them to your room.</p></div></div>
      <section className="playlist-empty-state">
        <Users size={34} />
        <h2>Listen with friends</h2>
        <p className="muted">Sign in to pick a username, add friends and invite them to rooms.</p>
        <button className="btn btn-primary" onClick={() => openAuth('signup')}><UserPlus size={16} /> Sign up or log in</button>
      </section>
    </main>
  }

  const run = async (task, message) => {
    try { await task(); if (message) setNotice(message) }
    catch (err) { setError(err.message || 'Something went wrong.') }
  }
  const setStatus = (uid, status) => setResults((list) => list.map((item) => (item.uid === uid ? { ...item, status } : item)))

  const invite = (friend) => run(async () => {
    await sendInvite(friend.uid, roomCode)
    setInvited((current) => ({ ...current, [friend.uid]: true }))
  }, `Invite sent to @${friend.username}`)

  return <main className="page narrow friends-page">
    <div className="playlist-page-heading"><span className="page-icon"><Users size={21} /></span><div><h1>Friends</h1><p className="muted">Add friends and invite them to your room.</p></div></div>

    {!profileReady
      ? <FriendRowsSkeleton count={3} />
      : !username
        ? <section className="settings-card">
            <div className="settings-card-header"><AtSign size={18} /><h2>Choose your username</h2></div>
            <p className="settings-desc">Pick a unique name so friends can find you.</p>
            <UsernameForm />
          </section>
        : <>
            <div className="friends-me">
              <span className="chip">@{username}</span>
              <NotificationPrompt />
            </div>
            {notice && <p className="popover-status motion-success friends-notice" role="status"><Check size={13} /> {notice}</p>}

            <label className="playlist-search"><Search size={17} /><span className="sr-only">Search usernames</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by username" autoCapitalize="none" autoComplete="off" />
              <button type="button" className="search-clear" onClick={() => setQuery('')} disabled={!query} aria-label="Clear username search"><X size={17} /></button>
            </label>
            {query.trim().replace(/^@/, '').length >= 2 && <ul className="track-list friends-list">
              {searching && !results.length && Array.from({ length: 3 }, (_, index) => <li className="track friend-skeleton" key={`friend-skeleton-${index}`} aria-hidden="true">
                <Skeleton className="friend-skeleton-avatar" />
                <Skeleton className="friend-skeleton-name" />
              </li>)}
              {!searching && !results.length && <li className="message">No one found with that username.</li>}
              {results.map((item) => <li className="track" key={item.uid}>
                <span className="sidenav-avatar">{item.username.charAt(0).toUpperCase()}</span>
                <div className="track-text"><strong>@{item.username}</strong></div>
                {item.status === 'friend' && <span className="chip"><Check size={13} /> Friends</span>}
                {item.status === 'sent' && <button className="btn btn-small" title="Tap to cancel" onClick={() => run(async () => { await cancelRequest(item.uid); setStatus(item.uid, 'none') })}>Requested</button>}
                {item.status === 'incoming' && <button className="btn btn-small btn-primary" onClick={() => run(() => acceptRequest(item.uid), `You and @${item.username} are friends`)}>Accept</button>}
                {item.status === 'none' && <button className="btn btn-small btn-primary" onClick={() => run(async () => { await sendRequest(item.uid); setStatus(item.uid, 'sent') }, `Request sent to @${item.username}`)}><UserPlus size={14} /> Add</button>}
              </li>)}
            </ul>}

            {requests.length > 0 && <section className="friends-section">
              <h2><Bell size={16} /> Friend requests <small className="muted">{requests.length}</small></h2>
              <ul className="track-list friends-list">
                {requests.map((request) => <li className="track" key={request.uid}>
                  <span className="sidenav-avatar">{request.username.charAt(0).toUpperCase()}</span>
                  <div className="track-text"><strong>@{request.username}</strong><small>wants to be your friend</small></div>
                  <button className="btn btn-small btn-primary" onClick={() => run(() => acceptRequest(request.uid), `You and @${request.username} are friends`)}>Accept</button>
                  <button className="btn btn-small" onClick={() => run(() => declineRequest(request.uid))}>Decline</button>
                </li>)}
              </ul>
            </section>}

            <section className="friends-section">
              <h2><Users size={16} /> Your friends <small className="muted">{friends.length}</small></h2>
              {friends.length === 0
                ? <p className="empty">No friends yet. Search a username above to add one.</p>
                : <ul className="track-list friends-list">
                    {friends.map((friend) => <li className="track" key={friend.uid}>
                      <span className="sidenav-avatar">{friend.username.charAt(0).toUpperCase()}</span>
                      <div className="track-text"><strong>@{friend.username}</strong></div>
                      {roomCode && <button className="btn btn-small" onClick={() => invite(friend)}>
                        {invited[friend.uid] ? <><Check size={14} /> Invited</> : <><Send size={14} /> Invite</>}
                      </button>}
                      <button className="icon-btn" onClick={() => setRemoveTarget(friend)} aria-label={`Remove @${friend.username}`} title="Remove friend"><UserMinus size={16} /></button>
                    </li>)}
                  </ul>}
              {friends.length > 0 && !roomCode && <p className="muted friends-hint">Join or create a room to invite friends to listen together.</p>}
            </section>
          </>}

    <FeedbackModal title="Something went wrong" message={error} onClose={() => setError('')} />
    {removeTarget && <ConfirmModal
      title={`Remove @${removeTarget.username}?`}
      message="You will no longer be friends. You can add each other again any time."
      confirmLabel="Remove"
      icon={UserMinus}
      onCancel={() => setRemoveTarget(null)}
      onConfirm={() => { const target = removeTarget; setRemoveTarget(null); run(() => removeFriend(target.uid)) }}
    />}
  </main>
}
