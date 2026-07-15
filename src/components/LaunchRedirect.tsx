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
