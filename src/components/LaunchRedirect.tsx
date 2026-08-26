/** Redirect cold launches from `/` to the user's preferred on-launch section. */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DEFAULT_LAUNCH_PATH, loadLaunchPath } from '../storage/launchPathStore'

/**
 * Runs once per browser session when the app mounts on `/`.
 * Does not interfere with in-app navigation back to Overview.
 */
export function LaunchRedirect() {
  const location = useLocation()
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    const hashRoute = location.hash.match(/^#(\/[-a-z0-9/]*)/i)
    if (hashRoute) {
      done.current = true
      const rest = location.hash.slice(hashRoute[0].length)
      const dest = rest.startsWith('#') ? `${hashRoute[1]}${rest}` : hashRoute[1]
      navigate(dest, { replace: true })
      return
    }
    if (done.current) return
    // Only redirect the initial landing on Overview
    if (location.pathname !== '/' && location.pathname !== '') return
    if (location.search || location.hash) return

    const pref = loadLaunchPath()
    done.current = true
    if (pref === DEFAULT_LAUNCH_PATH || pref === '/') return
    navigate(pref, { replace: true })
  }, [location.pathname, location.search, location.hash, navigate])

  return null
}
