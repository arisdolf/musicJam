import { useEffect, useState } from 'react'
import { Gauge, RotateCcw } from 'lucide-react'
import { quotaStatus, resetQuota, msUntilReset, QUOTA_LIMIT } from '../services/youtube'

function formatCountdown(ms) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export default function Quota() {
  const [keys, setKeys] = useState(quotaStatus)
  const [reset, setReset] = useState(msUntilReset)

  useEffect(() => {
    const refresh = () => { setKeys(quotaStatus()); setReset(msUntilReset()) }
    refresh()
    window.addEventListener('jamroom:quota', refresh)
    const timer = setInterval(refresh, 5000)
    return () => { window.removeEventListener('jamroom:quota', refresh); clearInterval(timer) }
  }, [])

  const totalUsed = keys.reduce((sum, key) => sum + key.used, 0)
  const totalLimit = keys.length * QUOTA_LIMIT
  const serverKeyOnly = keys.length === 1 && keys[0].label === 'Server key'

  return <main className="explore-page">
    <div className="explore-header">
      <Gauge size={22} />
      <div>
        <h1>API Quota</h1>
        <p className="muted">YouTube usage per key. Resets in {formatCountdown(reset)} (midnight Pacific).</p>
      </div>
    </div>

    <section className="quota-total">
      <span className="eyebrow">{serverKeyOnly ? 'SERVER KEY' : 'ALL KEYS'}</span>
      <strong>{totalUsed.toLocaleString()} <small>/ {totalLimit.toLocaleString()} units</small></strong>
    </section>

    <ul className="quota-list">
      {keys.map((key) => {
        const pct = Math.min(100, (key.used / QUOTA_LIMIT) * 100)
        const state = key.used >= QUOTA_LIMIT ? 'full' : pct >= 80 ? 'low' : 'ok'
        return <li className={`quota-card is-${state}`} key={key.label}>
          <div className="quota-card-head">
            <div><strong>{key.label}</strong>{key.hint && <small className="muted">…{key.hint}</small>}</div>
            <span className="quota-badge">{state === 'full' ? 'Limit reached' : state === 'low' ? 'Almost out' : 'Available'}</span>
          </div>
          <div className="quota-bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="quota-nums">
            <span>{key.used.toLocaleString()} used</span>
            <span>{key.remaining.toLocaleString()} left</span>
          </div>
        </li>
      })}
    </ul>

    <p className="muted quota-note">Counted in this browser only. A search costs about 101 units (100 for the search, 1 for the video details). Check Google Cloud Console for exact numbers.</p>
    {serverKeyOnly && <p className="muted quota-note">Your keys live on the server, so they show as one. Set VITE_YOUTUBE_API_KEYS (comma separated) to list each key.</p>}
    <button className="btn btn-small btn-text" onClick={resetQuota}><RotateCcw size={14} /> Reset local counter</button>
  </main>
}
