import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// Open dialogs, topmost last. Only the topmost one reacts to Escape and Tab,
// so a feedback card on top of the invite dialog closes alone.
const stack = []

// dialog.open / dialog.close behaves:
//  - focus moves into the dialog (`[data-autofocus]` first, else the first control)
//  - Tab and Shift+Tab stay inside it
//  - Escape closes it (unless `closeOnEscape` is false, e.g. while busy)
//  - focus goes back to whatever opened it
// Put the returned ref on the dialog element. Mount the dialog only while it is open.
export function useDialog({ onClose, closeOnEscape = true } = {}) {
  const ref = useRef(null)
  const latest = useRef({ onClose, closeOnEscape })
  useEffect(() => { latest.current = { onClose, closeOnEscape } })

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const opener = document.activeElement
    const token = {}
    stack.push(token)

    const frame = requestAnimationFrame(() => {
      const target = node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE) || node
      target.focus({ preventScroll: true })
    })

    const onKeyDown = (event) => {
      if (stack[stack.length - 1] !== token) return
      if (event.key === 'Escape') {
        if (!latest.current.closeOnEscape) return
        event.preventDefault()
        latest.current.onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null)
      if (!items.length) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      const at = stack.indexOf(token)
      if (at >= 0) stack.splice(at, 1)
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return ref
}