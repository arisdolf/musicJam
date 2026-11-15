const KEY = 'jamroom:theme'

export const getTheme = () => {
  try { const saved = localStorage.getItem(KEY); return saved === 'light' || saved === 'dark' ? saved : 'system' }
  catch { return 'system' }
}

export function applyTheme(mode) {
  const root = document.documentElement
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode
  else delete root.dataset.theme
  try { mode === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode) } catch { /* optional */ }
}