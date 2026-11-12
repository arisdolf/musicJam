export function withViewTransition(update) { update() }

export function layoutTransitionName(id) {
  return `playlist-cover-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}