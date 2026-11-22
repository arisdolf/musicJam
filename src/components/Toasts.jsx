/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

// status.success / action.undo behaves:
//  - not modal, never takes focus
//  - announced politely through a live region that exists before the text
//  - stays at least 10 s, pauses while hovered or focused, can be closed
//  - optional action button (Undo)
const ToastContext = createContext(null)
const MIN_DURATION = 10000
const MAX_VISIBLE = 3
let nextId = 1

const fallback = { show: () => 0, dismiss: () => {} }
export const useToast = () => useContext(ToastContext) || fallback

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)

  useEffect(() => {
    if (paused) return undefined
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current))
    }
  }, [paused, toast.id, onDismiss])

  return <div
    className="toast"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
  >
    <Check size={16} className="toast-icon" aria-hidden="true" />
    <span className="toast-text">{toast.message}</span>
    {toast.actionLabel && <button
      className="btn btn-small toast-action"
      onClick={() => { toast.onAction?.(); onDismiss(toast.id) }}
    >{toast.actionLabel}</button>}
    <button className="icon-btn toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss message"><X size={16} /></button>
  </div>
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [announcement, setAnnouncement] = useState('')

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), [])

  // show({ message, actionLabel?, onAction?, duration? }) -> id
  const show = useCallback(({ message, actionLabel, onAction, duration = MIN_DURATION }) => {
    if (!message) return 0
    const id = nextId++
    setToasts((list) => [...list, { id, message, actionLabel, onAction, duration: Math.max(MIN_DURATION, duration) }].slice(-MAX_VISIBLE))
    setAnnouncement(actionLabel ? `${message}. ${actionLabel} is available.` : message)
    return id
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return <ToastContext.Provider value={value}>
    {children}
    {/* The live region is always mounted, so screen readers hear every new message. */}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {toasts.length > 0 && <div className="toast-stack" aria-label="Messages" role="group">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
    </div>}
  </ToastContext.Provider>
}