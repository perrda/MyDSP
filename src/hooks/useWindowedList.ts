/** Progressive windowing for long lists (phone/tablet performance). */

import { useEffect, useRef, useState } from 'react'

export function useWindowedList<T>(items: T[], initial = 40, step = 30) {
  const [limit, setLimit] = useState(initial)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLimit(initial)
  }, [items.length, initial])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || items.length <= limit) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((n) => Math.min(items.length, n + step))
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [items.length, limit, step])

  return {
    visible: items.slice(0, limit),
    hasMore: items.length > limit,
    remaining: Math.max(0, items.length - limit),
    sentinelRef,
    showAll: () => setLimit(items.length),
  }
}
