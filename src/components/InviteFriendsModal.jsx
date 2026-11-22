import { useState } from 'react'
import { Check, Send, UserPlus, X } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { useFriends } from '../features/friends/FriendsContext'
import { useDialog } from '../hooks/useDialog'
import FeedbackModal from './FeedbackModal'

export default function InviteFriendsModal({ roomCode, onClose }) {
  const { user, openAuth } = useAccount()
  const { profile, friends, sendInvite } = useFriends()
  const [sent, setSent] = useState({})
  const [error, setError] = useState('')
  // While the error card is on top it handles Escape; this dialog handles it again once the card is gone.
  const dialogRef = useDialog({ onClose })

  const invite = async (friend) => {
    try { await sendInvite(friend.uid, roomCode); setSent((current) => ({ ...current, [friend.uid]: true })) }
    catch (err) { setError(err.message || 'Could not send the invite.') }
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" tabIndex={-1}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
      <div className="auth-icon" aria-hidden="true"><UserPlus size={20} /></div>
      <h2 id="invite-title">Invite friends</h2>
      <p className="muted">They will get a notification to join room {roomCode}.</p>
      {!user
        ? <button className="btn btn-primary btn-block" onClick={() => { onClose(); openAuth('login') }}>Log in to invite friends</button>
        : !profile?.username
          ? <p className="empty">Pick a username in Settings, under Friends, first.</p>
          : friends.length === 0
            ? <p className="empty">You have no friends yet. Add some in Settings, under Friends.</p>
            : <ul className="track-list friends-list">
                {friends.map((friend) => <li className="track" key={friend.uid}>
                  <span className="sidenav-avatar" aria-hidden="true">{friend.username.charAt(0).toUpperCase()}</span>
                  <div className="track-text"><strong>@{friend.username}</strong></div>
                  <button
                    className="btn btn-small"
                    onClick={() => invite(friend)}
                    disabled={sent[friend.uid]}
                    aria-label={sent[friend.uid] ? `Invite sent to @${friend.username}` : `Invite @${friend.username}`}
                  >
                    {sent[friend.uid] ? <><Check size={14} /> Invited</> : <><Send size={14} /> Invite</>}
                  </button>
                </li>)}
              </ul>}
      <FeedbackModal title="Something went wrong" message={error} onClose={() => setError('')} />
    </div>
  </div>
}