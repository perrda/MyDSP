import { useEffect, useRef } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { evaluateAchievements } from '../domain/achievements'
import { useToasts } from './ToastProvider'

const SEEN_KEY = 'mydsp_achievements_seen'

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveSeen(ids: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

/** Watches portfolio unlocks and fires toasts for newly earned achievements. */
export function AchievementWatcher() {
  const { data, breakdown, goalProgress } = usePortfolio()
  const { pushAchievements } = useToasts()
  const primed = useRef(false)

  useEffect(() => {
    const result = evaluateAchievements({ data, breakdown, goalProgress })
    const unlockedIds = result.unlocked.map((a) => a.id)
    const seen = loadSeen()

    if (!primed.current) {
      // First evaluation: seed seen set so we don't toast historical unlocks
      for (const id of unlockedIds) seen.add(id)
      saveSeen(seen)
      primed.current = true
      return
    }

    const fresh = result.unlocked.filter((a) => !seen.has(a.id))
    if (fresh.length) {
      for (const a of fresh) seen.add(a.id)
      saveSeen(seen)
      pushAchievements(fresh)
    }
  }, [data, breakdown, goalProgress, pushAchievements])

  return null
}
