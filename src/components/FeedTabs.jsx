import { useEffect, useRef, useState } from 'react'

// Scrollable genre tabs under the top bar. They slide away on scroll down and return on scroll up.
export default function FeedTabs({ tabs, value, onChange }) {
  const [hidden, setHidden] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - last
        if (y < 60) setHidden(false)
        else if (delta > 8) setHidden(true)
        else if (delta < -8) setHidden(false)
        if (Math.abs(delta) > 8 || y < 60) last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll) }
  }, [])

  // Keep the chosen tab in view in the sideways scroller.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [value])

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.id === value)
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-tab="${next.id}"]`)?.focus())
  }

  return <div className={`feed-tabs${hidden ? ' is-hidden' : ''}`}>
    <div className="feed-tabs-list" ref={listRef} role="tablist" aria-label="Music categories" onKeyDown={onKeyDown}>
      {tabs.map((tab) => <button
        key={tab.id}
        type="button"
        role="tab"
        data-tab={tab.id}
        aria-selected={value === tab.id}
        tabIndex={value === tab.id ? 0 : -1}
        className={`feed-tab${value === tab.id ? ' active' : ''}`}
        onClick={() => onChange(tab.id)}
      >{tab.label}</button>)}
    </div>
  </div>
}