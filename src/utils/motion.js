export function rubberBandAtBounds(element, deltaY) {
  if (!element?.animate || !deltaY) return
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const atTop = element.scrollTop <= 0 && deltaY < 0
  const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1 && deltaY > 0
  if ((!atTop && !atBottom) || element.dataset.rubberBand === 'true') return

  element.dataset.rubberBand = 'true'
  const direction = atTop ? 1 : -1
  const animation = element.animate([
    { transform: 'translateY(0)' },
    { transform: `translateY(${direction * 5}px)` },
    { transform: 'translateY(0)' },
  ], { duration: 180, easing: 'cubic-bezier(.22,.9,.3,1)' })
  animation.onfinish = () => { delete element.dataset.rubberBand }
}
