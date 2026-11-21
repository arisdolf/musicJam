const STORAGE_KEY = 'jamroom:recent'
const MAX = 10

export function saveRecentRoom(code) {
  try {
    const list = getRecentRooms().filter((room) => room.code !== code)
    list.unshift({ code, visitedAt: Date.now() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)))
  } catch { /* storage disabled */ }
}

export function getRecentRooms() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function clearRecentRooms() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}
