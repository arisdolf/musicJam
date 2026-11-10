import { useState } from 'react'
import { Headphones, Plus, ArrowRight } from 'lucide-react'

export default function JoinRoom({ onJoin }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const value = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{4,8}$/.test(value)) {
      setMessage('Enter a room code with 4 to 8 letters or numbers.')
      return
    }
    onJoin(value)
  }

  return <main className="page narrow home">
    <div className="home-icon"><Headphones size={25} /></div>
    <h1>Listen together</h1>
    <p className="muted">Start a room, add songs, and play them in sync with friends.</p>

    <button className="btn btn-primary btn-large" onClick={() => onJoin(Math.random().toString(36).slice(2, 8).toUpperCase())}><Plus size={17} /> Create a room</button>

    <div className="divider"><span>or join with a code</span></div>

    <form onSubmit={submit} className="inline-form">
      <input
        id="room-code"
        maxLength={8}
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="Room code"
        aria-label="Room code"
        value={code}
        onChange={(event) => { setCode(event.target.value.toUpperCase()); setMessage('') }}
      />
      <button className="btn" type="submit" disabled={!code.trim()}><ArrowRight size={16} /> Join</button>
    </form>
    {message && <div className="form-error" role="alert">{message}</div>}
  </main>
}
