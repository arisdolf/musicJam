import { Heart } from 'lucide-react'
import { useAccount } from '../features/account/AccountContext'

export default function LikeButton({ track }) {
  const { user, openAuth, likedIds, toggleLike } = useAccount()
  const liked = Boolean(user && likedIds.has(track.id))

  const onClick = () => {
    if (!user) { openAuth('login'); return }
    toggleLike(track).catch((error) => console.error('Like failed:', error))
  }

  return <button
    className={`icon-btn save-track-btn${liked ? ' is-saved' : ''}`}
    onClick={onClick}
    aria-pressed={liked}
    aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
    title={liked ? 'Remove from Liked songs' : 'Like'}
  >
    <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
  </button>
}