import { useEffect, useState } from 'react'
import {
  clearSyncHighlights,
  peekSyncHighlights,
  type SyncHighlightCollection,
} from '../services/sync/syncHighlights'

/** Live Set of entity ids that just arrived via cloud sync (brief highlight). */
export function useSyncHighlights(collection: SyncHighlightCollection): Set<number> {
  const [ids, setIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const apply = () => {
      const map = peekSyncHighlights()
      const next = new Set(map[collection] ?? [])
      if (next.size === 0) return
      setIds(next)
      window.setTimeout(() => {
        setIds(new Set())
        clearSyncHighlights()
      }, 6_000)
    }
    apply()
    window.addEventListener('mydsp-sync-applied', apply)
    return () => window.removeEventListener('mydsp-sync-applied', apply)
  }, [collection])

  return ids
}

export function syncHighlightClass(active: boolean): string {
  return active ? 'sync-just-added' : ''
}
