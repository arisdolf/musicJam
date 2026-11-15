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
    const rects = Array.from(list.children).map((el) => el.getBoundingClientRect())
    const self = rects[index]
    if (!self) return
    event.preventDefault()

    const startY = event.clientY
    const height = self.height
    let to = index
    setDrag({ from: index, to: index, dy: 0, height })

    const pick = (center) => {
      const last = rects.length - 1
      if (center <= rects[0].top) return 0
      if (center >= rects[last].bottom) return last
      const found = rects.findIndex((rect) => center >= rect.top && center < rect.bottom)
      return found < 0 ? to : found
    }
    const move = (e) => {
      const dy = e.clientY - startY
      to = pick(self.top + height / 2 + dy)
      setDrag({ from: index, to, dy, height })
    }
    const finish = (commit) => {
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
      return { transform: `translateY(${drag.dy}px)`, transition: 'none', position: 'relative', zIndex: 5 }
    }
    let shift = 0
    if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.height
    else if (drag.from > drag.to && index >= drag.to && index < drag.from) shift = drag.height
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 160ms ease' }
  }

  const handleProps = (index) => ({ onPointerDown: (event) => startDrag(index, event) })

  return { listRef, dragIndex: drag ? drag.from : null, itemStyle, handleProps }
}