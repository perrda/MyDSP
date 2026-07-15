/** Glass Mode context — On/Off like Light/Dark, independent of appearance theme. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  applyGlassDom,
  GLASS_STORAGE_KEY,
  loadGlassMode,
  saveGlassMode,
} from '../utils/glassMode'

interface GlassContextValue {
  glass: boolean
  setGlass: (on: boolean) => void
  toggle: () => void
}

const GlassContext = createContext<GlassContextValue | undefined>(undefined)

export function GlassProvider({ children }: { children: ReactNode }) {
  const [glass, setGlassState] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('glass')
    }
    return loadGlassMode()
  })

  useEffect(() => {
    // Sync if another tab flips the flag
    const onStorage = (e: StorageEvent) => {
      if (e.key !== GLASS_STORAGE_KEY) return
      const on = e.newValue === '1'
      applyGlassDom(on)
      setGlassState(on)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setGlass = useCallback((on: boolean) => {
    applyGlassDom(on)
    saveGlassMode(on)
    setGlassState(on)
  }, [])

  const toggle = useCallback(() => {
    setGlass(!glass)
  }, [glass, setGlass])

  return (
    <GlassContext.Provider value={{ glass, setGlass, toggle }}>{children}</GlassContext.Provider>
  )
}

export function useGlass() {
  const ctx = useContext(GlassContext)
  if (!ctx) throw new Error('useGlass must be used within GlassProvider')
  return ctx
}
