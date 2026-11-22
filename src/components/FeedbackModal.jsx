import { CircleAlert, X } from 'lucide-react'
import { useDialog } from '../hooks/useDialog'

function FeedbackDialog({ title, message, onClose }) {
  const dialogRef = useDialog({ onClose })
  return <div className="feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="feedback-card" role="alertdialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-message" tabIndex={-1}>
      <button className="modal-close" onClick={onClose} aria-label="Close message"><X size={19} /></button>
      <span className="feedback-icon" aria-hidden="true"><CircleAlert size={21} /></span>
      <h2 id="feedback-title">{title}</h2>
      <p id="feedback-message">{message}</p>
      <button className="btn btn-primary" onClick={onClose} data-autofocus>Got it</button>
    </section>
  </div>
}

// The dialog only mounts while there is a message, so focus is set on open and restored on close.
export default function FeedbackModal({ title, message, onClose }) {
  if (!message) return null
  return <FeedbackDialog title={title} message={message} onClose={onClose} />
}