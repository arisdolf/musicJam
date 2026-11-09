import { useState } from 'react'

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

  return <main className="join-screen">
    <div className="join-top"><a className="wordmark" href="#home"><span className="wordmark-icon">♫</span> jamroom</a></div>
    <section className="join-box">
      <div className="join-note">YOUR MUSIC, TOGETHER</div>
      <h1>Pick a room.<br/>Put something on.</h1>
      <p>Start a room or enter a code from a friend.</p>
      <button className="primary-action" onClick={() => onJoin(Math.random().toString(36).slice(2, 8).toUpperCase())}>Create a room <span>↗</span></button>
      <div className="or-divider"><span/>OR JOIN WITH A CODE<span/></div>
      <form onSubmit={submit} className="join-form">
        <label htmlFor="room-code">Room code</label>
        <div className="code-entry"><input id="room-code" maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="e.g. ABC123" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setMessage('') }}/><button type="submit" disabled={!code.trim()}>Join room</button></div>
        {message && <div className="form-error" role="alert">{message}</div>}
      </form>
    </section>
    <div className="join-footer">NO SIGN UP. JUST PRESS PLAY.</div>
  </main>
}
