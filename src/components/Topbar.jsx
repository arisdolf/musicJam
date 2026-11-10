// src/components/Topbar.jsx  — slim header; just logo + hamburger on mobile
import { Menu, Music2 } from 'lucide-react'

export default function Topbar({ onMenuOpen }) {
  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuOpen} aria-label="Open menu">
        <Menu size={22} />
      </button>
      <div className="topbar-logo">
        <span className="logo-mark"><Music2 size={16} strokeWidth={2.4} /></span>
        <span>jamroom</span>
      </div>
      {/* Spacer keeps logo centred on mobile */}
      <div style={{ width: 40 }} />
    </header>
  )
}
