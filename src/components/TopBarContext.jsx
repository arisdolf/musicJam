import { createContext, useContext, useEffect, useRef, useState } from 'react'

const SetCtx = createContext(() => {})
const ValueCtx = createContext({ title: '', onBack: null })

export function TopbarProvider({ children }) {
  const [bar, setBar] = useState({ title: '', onBack: null })
  return <SetCtx.Provider value={setBar}><ValueCtx.Provider value={bar}>{children}</ValueCtx.Provider></SetCtx.Provider>
}

export const useTopbarValue = () => useContext(ValueCtx)

// Call from a page: useTopbar('Playlist name', () => goBack())  (pass null for no back button)
export function useTopbar(title, onBack) {
  const setBar = useContext(SetCtx)
  const backRef = useRef(onBack)
  useEffect(() => { backRef.current = onBack })
  const hasBack = Boolean(onBack)
  useEffect(() => {
    setBar({ title, onBack: hasBack ? () => backRef.current?.() : null })
    return () => setBar({ title: '', onBack: null })
  }, [title, hasBack, setBar])
}