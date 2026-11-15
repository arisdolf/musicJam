// Inserts tracks right after the current song and plays tracks[index].
// Songs already in the queue are not duplicated; we just jump to them.
export function playNow(state, tracks, index = 0) {
  const all = Array.isArray(tracks) ? tracks : []
  const target = all[index]
  if (!target?.id) return state

  const seen = new Set(state.queue.map((item) => item.id))
  const fresh = []
  for (const track of all) {
    if (track?.id && !seen.has(track.id)) { seen.add(track.id); fresh.push(track) }
  }

  const queue = [...state.queue]
  if (fresh.length) {
    const at = queue.length ? Math.min(state.current + 1, queue.length) : 0
    queue.splice(at, 0, ...fresh)
  }
  return { ...state, queue, current: queue.findIndex((item) => item.id === target.id), playing: true }
}