export default function QueueFly({ motion, onComplete }) {
  if (!motion) return null
  const { start, end, track, key } = motion
  const dx = end.x - start.x
  const dy = end.y - start.y
  const arc = Math.min(110, Math.max(42, Math.abs(dx) * 0.18))
  const path = `path("M 0 0 Q ${dx / 2} ${dy / 2 - arc} ${dx} ${dy}")`

  return <span
    key={key}
    className="queue-fly"
    style={{
      left: start.x - 15,
      top: start.y - 15,
      offsetPath: path,
      '--queue-fly-mid-x': `${dx / 2}px`,
      '--queue-fly-mid-y': `${dy / 2 - arc}px`,
      '--queue-fly-end-x': `${dx}px`,
      '--queue-fly-end-y': `${dy}px`,
    }}
    onAnimationEnd={(event) => {
      if (event.animationName === 'queue-fly-arc' || event.animationName === 'queue-fly-arc-fallback') onComplete(key)
    }}
    aria-hidden="true"
  >
    <img src={track.thumbnail || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`} alt="" />
  </span>
}
