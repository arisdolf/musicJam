import { flushSync } from 'react-dom'

export function withViewTransition(update) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || reducedMotion) {
    update()
    return
  }

  document.startViewTransition(() => flushSync(update))
}

export function layoutTransitionName(id) {
  return `playlist-cover-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
