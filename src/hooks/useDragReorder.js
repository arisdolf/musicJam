import { useCallback, useEffect, useRef, useState } from 'react'

// Drag-to-reorder for a <ul>. Attach listRef to the list, itemStyle(i) to each <li>,
// and spread handleProps(i) on the grip handle. onMove(from, to) is called on drop.
export function useDragReorder(onMove) {
  const listRef = useRef(null)
  const onMoveRef = useRef(onMove)
  const [drag, setDrag] = useState(null) // { from, to, dy, height }

  useEffect(() => { onMoveRef.current = onMove })

  const startDrag = useCallback((index, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const list = listRef.current
    if (!list) return
    const getRects = () => Array.from(list.children).map((el) => el.getBoundingClientRect())
    const initialRects = getRects()
    const self = initialRects[index]
    if (!self) return
    event.preventDefault()

    const startY = event.clientY
    const height = self.height
    let clientY = startY
    let scrollOffset = 0
    let to = index
    setDrag({ from: index, to: index, dy: 0, height, startTop: self.top, scrollOffset })

    const pick = (center, rects) => {
      const last = rects.length - 1
      if (center <= rects[0].top) return 0
      if (center >= rects[last].bottom) return last
      const found = rects.findIndex((rect) => center >= rect.top && center < rect.bottom)
      return found < 0 ? to : found
    }
    const containers = []
    const listOverflow = window.getComputedStyle(list).overflowY
    if (/(auto|scroll|overlay)/.test(listOverflow) && list.scrollHeight > list.clientHeight + 1) containers.push(list)
    for (let parent = list.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
      const overflowY = window.getComputedStyle(parent).overflowY
      if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight + 1) containers.push(parent)
    }
    containers.push(window)
    let frame = 0
    let previousScrollAt = 0

    const updatePosition = () => {
      const rects = getRects().map((rect, itemIndex) => {
        let shift = 0
        if (index < to && itemIndex > index && itemIndex <= to) shift = -height
        else if (index > to && itemIndex >= to && itemIndex < index) shift = height
        return { ...rect, top: rect.top - shift, bottom: rect.bottom - shift }
      })
      if (!rects.length) return
      const dy = clientY - startY + scrollOffset
      to = pick(self.top + height / 2 + dy, rects)
      setDrag({ from: index, to, dy, height, startTop: self.top, scrollOffset })
    }

    const scrollAtEdge = () => {
      frame = 0
      let target = null
      let direction = 0
      let speed = 0
      for (const container of containers) {
        const isWindow = container === window
        const bounds = isWindow ? { top: 0, bottom: window.innerHeight } : container.getBoundingClientRect()
        const root = document.scrollingElement || document.documentElement
        const scrollTop = isWindow ? root.scrollTop : container.scrollTop
        const maxScroll = isWindow ? root.scrollHeight - root.clientHeight : container.scrollHeight - container.clientHeight
        const nearTop = clientY >= bounds.top && clientY < bounds.top + 64
        const nearBottom = clientY <= bounds.bottom && clientY > bounds.bottom - 64
        const canScrollUp = scrollTop > 0
        const canScrollDown = scrollTop < maxScroll - 1
        if (nearTop && canScrollUp) {
          target = container; direction = -1
          speed = 35 + ((64 - (clientY - bounds.top)) / 64) * 145
          break
        }
        if (nearBottom && canScrollDown) {
          target = container; direction = 1
          speed = 35 + ((64 - (bounds.bottom - clientY)) / 64) * 145
          break
        }
      }
      if (!target || !direction) return

      const isWindow = target === window
      const root = document.scrollingElement || document.documentElement
      const scroller = isWindow ? root : target
      const now = performance.now()
      const elapsed = previousScrollAt ? Math.min(32, now - previousScrollAt) : 16.67
      previousScrollAt = now
      const before = scroller.scrollTop
      scroller.scrollTop += direction * Math.max(0.5, speed * elapsed / 1000)
      const moved = scroller.scrollTop - before
      if (!moved) return
      scrollOffset += moved
      updatePosition()
      frame = window.requestAnimationFrame(scrollAtEdge)
    }

    const keepScrolling = () => {
      if (!frame) frame = window.requestAnimationFrame(scrollAtEdge)
    }
    const move = (e) => {
      clientY = e.clientY
      updatePosition()
      keepScrolling()
    }
    const finish = (commit) => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      setDrag(null)
      if (commit && to !== index) onMoveRef.current?.(index, to)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }, [])

  const itemStyle = (index) => {
    if (!drag) return undefined
    if (index === drag.from) {
      const list = listRef.current
      const bounds = list?.getBoundingClientRect()
      let dy = drag.dy
      if (bounds) {
        const baseTop = drag.startTop - drag.scrollOffset
        const minDy = bounds.top - baseTop
        const maxDy = Math.max(minDy, bounds.bottom - drag.height - baseTop)
        dy = Math.min(maxDy, Math.max(minDy, dy))
      }
      return { transform: `translateY(${dy}px)`, transition: 'none', position: 'relative', zIndex: 5 }
    }
    let shift = 0
    if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.height
    else if (drag.from > drag.to && index >= drag.to && index < drag.from) shift = drag.height
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 160ms ease' }
  }

  const handleProps = (index) => ({ onPointerDown: (event) => startDrag(index, event) })

  return { listRef, dragIndex: drag ? drag.from : null, itemStyle, handleProps }
}
