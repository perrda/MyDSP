import { useEffect, useRef } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { evaluateAchievements } from '../domain/achievements'
import {
  loadAchievementsSeenPref,
  saveAchievementsSeenPref,
} from '../domain/achievementsSeenPref'
import { useToasts } from './ToastProvider'

/** Watches portfolio unlocks and fires toasts for newly earned achievements. */
export function AchievementWatcher() {
  const { data, breakdown, goalProgress } = usePortfolio()
  const { pushAchievements } = useToasts()
  const primed = useRef(false)

  useEffect(() => {
    const result = evaluateAchievements({ data, breakdown, goalProgress })
    const unlockedIds = result.unlocked.map((a) => a.id)
    const seen = loadAchievementsSeenPref()

    if (!primed.current) {
      // First evaluation: seed seen set so we don't toast historical unlocks
      for (const id of unlockedIds) seen.add(id)
      saveAchievementsSeenPref(seen)
      primed.current = true
      return
    }

    const fresh = result.unlocked.filter((a) => !seen.has(a.id))
    if (fresh.length) {
      for (const a of fresh) seen.add(a.id)
      saveAchievementsSeenPref(seen)
      pushAchievements(fresh)
    }
  }, [data, breakdown, goalProgress, pushAchievements])

  return null
}
