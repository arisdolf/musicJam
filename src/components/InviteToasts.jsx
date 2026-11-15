import { useState } from 'react'
import { Headphones, UserPlus, X } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'
import { useFriends } from '../features/friends/FriendsContext'

export default function InviteToasts({ onJoin, onOpenFriends }) {
  const { user } = useAccount()
  const { invites, requests, dismissInvite } = useFriends()
  const [hiddenRequests, setHiddenRequests] = useState(false)
  const showRequests = requests.length > 0 && !hiddenRequests
  if (!user || (!invites.length && !showRequests)) return null

  return <div className="invite-stack" role="region" aria-label="Notifications">
    {invites.map((invite) => <div className="invite-toast" key={invite.id}>
      <span className="sidenav-avatar"><Headphones size={16} /></span>
      <span className="invite-toast-text"><strong>@{invite.fromName} invited you</strong><small>Join room {invite.roomCode}</small></span>
      <button className="btn btn-small btn-primary" onClick={() => { onJoin(invite.roomCode); dismissInvite(invite.id) }}>Join</button>
      <button className="icon-btn" onClick={() => dismissInvite(invite.id)} aria-label="Dismiss"><X size={16} /></button>
    </div>)}
    {showRequests && <div className="invite-toast">
      <span className="sidenav-avatar"><UserPlus size={16} /></span>
      <span className="invite-toast-text"><strong>{requests.length === 1 ? `@${requests[0].username} wants to be friends` : `${requests.length} friend requests`}</strong></span>
      <button className="btn btn-small btn-primary" onClick={() => { onOpenFriends(); setHiddenRequests(true) }}>View</button>
      <button className="icon-btn" onClick={() => setHiddenRequests(true)} aria-label="Dismiss"><X size={16} /></button>
    </div>}
  </div>
}