import { Trash2, X } from 'lucide-react'
import { useDialog } from '../hooks/useDialog'

// dialog.confirm: the title names the object, the text names the consequence,
// the buttons are verbs, and the SAFE button (Cancel) gets the initial focus.
export default function ConfirmModal({
  title, message, confirmLabel = 'Delete', busyLabel = 'Deleting…', cancelLabel = 'Cancel',
  icon: Icon = Trash2, danger = true, busy = false, onConfirm, onCancel,
}) {
  const dialogRef = useDialog({ onClose: onCancel, closeOnEscape: !busy })

  return <div className="feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section
      ref={dialogRef}
      className="feedback-card"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      aria-busy={busy || undefined}
      tabIndex={-1}
    >
      <button className="modal-close" onClick={onCancel} aria-label="Close" disabled={busy}><X size={19} /></button>
      <span className={`feedback-icon${danger ? ' danger-icon' : ''}`} aria-hidden="true"><Icon size={20} /></span>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn" onClick={onCancel} disabled={busy} data-autofocus>{cancelLabel}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </section>
  </div>
}