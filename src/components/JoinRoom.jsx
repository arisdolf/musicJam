import { useState } from 'react'
import { Headphones, Plus, ArrowRight } from 'lucide-react'
import HomeSearch from './HomeSearch'
// Postel's law: be liberal in what you accept. People paste "abc-123", " abc 123 ", or a whole
// invite link (…/?room=ABC123). All of those become a clean room code.
function parseRoomCode(raw) {
  const text = String(raw || '').trim()
  const fromLink = text.match(/[?&]room=([A-Za-z0-9]+)/i)
  return (fromLink ? fromLink[1] : text).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

export default function JoinRoom({ onJoin, onPlaySong, onQueueTrack }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const value = parseRoomCode(code)
    if (!/^[A-Z0-9]{4,8}$/.test(value)) {
      setMessage('Enter a room code with 4 to 8 letters or numbers.')
      return
    }
    onJoin(value)
  }

  return <main className="page narrow home">
  <HomeSearch onPlaySong={onPlaySong} onQueueTrack={onQueueTrack} />
    <div className="home-icon"><Headphones size={25} /></div>
    <h1>Listen together</h1>
    <p className="muted">Start a room, add songs, and play them in sync with friends.</p>

    <button className="btn btn-primary btn-large" onClick={() => onJoin(Math.random().toString(36).slice(2, 8).toUpperCase())}><Plus size={17} /> Create a room</button>

    <div className="divider"><span>or join with a code</span></div>

    <form onSubmit={submit} className="inline-form">
      {/* No maxLength here: it would cut a pasted invite link before we could read the code in it. */}
      <input
        id="room-code"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Room code or invite link"
        aria-label="Room code"
        value={code}
        onChange={(event) => { setCode(parseRoomCode(event.target.value)); setMessage('') }}
      />
      <button className="btn" type="submit" disabled={!code.trim()}><ArrowRight size={16} /> Join</button>
    </form>
    {message && <div className="form-error" role="alert">{message}</div>}
  </main>
}