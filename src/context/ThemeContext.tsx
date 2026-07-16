import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  msUntilNextDayNightSwitch,
  parseThemePreference,
  resolveTheme,
  type Theme,
  type ThemePreference,
} from '../utils/dayNightTheme'

interface ThemeContextValue {
  /** Currently applied light/dark appearance */
  theme: Theme
  /** Stored preference: auto follows local sunrise/sunset */
  preference: ThemePreference
  toggle: () => void
  setTheme: (t: Theme) => void
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const THEME_STORAGE_KEY = 'mydsp_theme'

function readBootstrappedTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

function readStoredPreference(): ThemePreference {
  try {
    const parsed = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
    if (parsed) return parsed
  } catch {
    /* private mode */
  }
  return 'auto'
}

function applyDomTheme(next: Theme, withTransition: boolean) {
  const root = document.documentElement
  if (withTransition) root.classList.add('theme-transitioning')
  root.classList.remove('light', 'dark')
  root.classList.add(next)
  // Match browser / PWA chrome (iOS status bar, Android nav) to the surface
  const chrome = next === 'light' ? '#ffffff' : '#000000'
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', chrome)
  }
  if (withTransition) {
    window.setTimeout(() => root.classList.remove('theme-transitioning'), 300)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [theme, setThemeState] = useState<Theme>(readBootstrappedTheme)

  const persistPreference = useCallback((pref: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref)
    } catch {
      /* private mode */
    }
  }, [])

  const applyResolved = useCallback(
    (pref: ThemePreference, withTransition = true) => {
      const next = resolveTheme(pref)
      applyDomTheme(next, withTransition)
      setThemeState(next)
      setPreferenceState(pref)
      persistPreference(pref)
    },
    [persistPreference],
  )

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      applyResolved(pref, true)
    },
    [applyResolved],
  )

  const setTheme = useCallback(
    (t: Theme) => {
      applyResolved(t, true)
    },
    [applyResolved],
  )

  const toggle = useCallback(() => {
    // Manual override — leave Auto mode
    applyResolved(theme === 'dark' ? 'light' : 'dark', true)
  }, [theme, applyResolved])

  // Re-apply when Auto crosses sunrise/sunset on the local clock
  useEffect(() => {
    if (preference !== 'auto') return

    let timer: number | undefined
    const schedule = () => {
      const delay = Math.min(msUntilNextDayNightSwitch(), 2_147_483_647)
      timer = window.setTimeout(() => {
        const next = resolveTheme('auto')
        applyDomTheme(next, true)
        setThemeState(next)
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      if (timer != null) window.clearTimeout(timer)
    }
  }, [preference])

  // Keep applied theme in sync if preference is auto on mount / visibility
  useEffect(() => {
    if (preference !== 'auto') return
    const sync = () => {
      const next = resolveTheme('auto')
      if (next !== theme) {
        applyDomTheme(next, true)
        setThemeState(next)
      }
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [preference, theme])

  return (
    <ThemeContext.Provider
      value={{ theme, preference, toggle, setTheme, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export type { Theme, ThemePreference }
