import { CircleAlert, X } from 'lucide-react'

export default function FeedbackModal({ title, message, onClose }) {
  if (!message) return null
  return <div className="feedback-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="feedback-card" role="alertdialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-message">
      <button className="modal-close" onClick={onClose} aria-label="Close message"><X size={19} /></button>
      <span className="feedback-icon"><CircleAlert size={21} /></span>
      <h2 id="feedback-title">{title}</h2>
      <p id="feedback-message">{message}</p>
      <button className="btn btn-primary" onClick={onClose}>Got it</button>
    </section>
  </div>
}
