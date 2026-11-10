import { Trash2, X } from 'lucide-react'

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }) {
  return <div className="feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section className="feedback-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <button className="modal-close" onClick={onCancel} aria-label="Close" disabled={busy}><X size={19} /></button>
      <span className="feedback-icon danger-icon"><Trash2 size={20} /></span>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : confirmLabel}</button>
      </div>
    </section>
  </div>
}
