import { useEffect } from 'react'
import { Trash2, X } from 'lucide-react'

export default function ConfirmModal({
  title, message, confirmLabel = 'Delete', busyLabel = 'Deleting…', cancelLabel = 'Cancel',
  icon: Icon = Trash2, danger = true, busy = false, onConfirm, onCancel,
}) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return <div className="feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section className="feedback-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <button className="modal-close" onClick={onCancel} aria-label="Close" disabled={busy}><X size={19} /></button>
      <span className={`feedback-icon${danger ? ' danger-icon' : ''}`}><Icon size={20} /></span>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </section>
  </div>
}