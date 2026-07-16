import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isInQuietWindow,
  nowPct,
  quietSegments,
  timeToMinutes,
} from '../domain/quietHoursTimeline'
import {
  formatWeekDeltaLine,
  sumSpendInRange,
  weekRange,
  weekSpendDelta,
} from '../domain/spendingWeekDelta'

function mockLocalStorage() {
  const mem = new Map<string, string>()
  const ls = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v))
    },
    removeItem: (k: string) => {
      mem.delete(k)
    },
    clear: () => mem.clear(),
    get length() {
      return mem.size
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
  return mem
}

describe('next25 today / productivity', () => {
  let mem: Map<string, string>

  beforeEach(() => {
    mem = mockLocalStorage()
  })

  afterEach(() => {
    mem.clear()
  })

  it('16: Today Focus card Mark done + Snooze mutate todoItems via setData', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(src).toMatch(/today-focus-card/)
    expect(src).toMatch(/today-focus-actions/)
    expect(src).toMatch(/Mark done/)
    expect(src).toMatch(/Snooze/)
    expect(src).toMatch(/markFocusDone/)
    expect(src).toMatch(/snoozeFocus/)
    expect(src).toMatch(/snoozeDueDateOneDay/)
    expect(src).toMatch(/status: 'done'/)
  })

  it('17: quiet-hours preview timeline helpers + Settings wire-up', () => {
    expect(timeToMinutes('22:00')).toBe(22 * 60)
    expect(timeToMinutes('07:30')).toBe(7 * 60 + 30)
    const overnight = quietSegments('22:00', '07:00')
    expect(overnight).toHaveLength(2)
    expect(overnight[0].startPct).toBeCloseTo((22 * 60) / (24 * 60) * 100, 5)
    expect(overnight[0].endPct).toBe(100)
    expect(overnight[1].startPct).toBe(0)
    expect(overnight[1].endPct).toBeCloseTo((7 * 60) / (24 * 60) * 100, 5)

    const daytime = quietSegments('13:00', '15:00')
    expect(daytime).toHaveLength(1)
    expect(daytime[0].startPct).toBeLessThan(daytime[0].endPct)

    const noon = new Date(2026, 6, 15, 12, 0, 0)
    expect(nowPct(noon)).toBeCloseTo(50, 5)
    expect(isInQuietWindow('22:00', '07:00', new Date(2026, 6, 15, 23, 0))).toBe(true)
    expect(isInQuietWindow('22:00', '07:00', noon)).toBe(false)

    const settings = readFileSync(resolve(__dirname, '../pages/SettingsPage.tsx'), 'utf8')
    expect(settings).toMatch(/quiet-hours-timeline/)
    expect(settings).toMatch(/quietSegments/)
  })

  it('18: Spending this week vs last delta under month picker', () => {
    const wed = new Date(2026, 6, 15) // Wed 15 Jul 2026
    const range = weekRange(wed)
    expect(range.thisStart).toBe('2026-07-13')
    expect(range.thisEnd).toBe('2026-07-19')
    expect(range.lastStart).toBe('2026-07-06')
    expect(range.lastEnd).toBe('2026-07-12')

    const spending = [
      { date: '2026-07-14', amount: 40 },
      { date: '2026-07-10', amount: 100 },
      { date: '2026-07-01', amount: 5 },
    ]
    expect(sumSpendInRange(spending, range.thisStart, range.thisEnd)).toBe(40)
    expect(sumSpendInRange(spending, range.lastStart, range.lastEnd)).toBe(100)
    const { thisWeek, lastWeek, delta } = weekSpendDelta(spending, wed)
    expect(thisWeek).toBe(40)
    expect(lastWeek).toBe(100)
    expect(delta).toBe(-60)
    expect(formatWeekDeltaLine(40, 100, (n) => `£${n}`)).toMatch(/This week £40/)
    expect(formatWeekDeltaLine(40, 100, (n) => `£${n}`)).toMatch(/−£60 vs last week/)

    const page = readFileSync(resolve(__dirname, '../pages/SpendingPage.tsx'), 'utf8')
    expect(page).toMatch(/spending-week-delta/)
    expect(page).toMatch(/weekSpendDelta/)
    expect(page).toMatch(/formatWeekDeltaLine/)
  })

  it('19: News/YouTube seenAt in stores + Mark all read', async () => {
    const newsStore = await import('../storage/newsStore')
    newsStore.loadNewsState()
    newsStore.setNewsSeenAt('2026-07-15T12:00:00.000Z')
    expect(newsStore.getNewsSeenAt()).toBe('2026-07-15T12:00:00.000Z')
    expect(newsStore.loadNewsState().seenAt).toBe('2026-07-15T12:00:00.000Z')
    const exported = newsStore.exportNewsForBackup()
    expect(exported.seenAt).toBe('2026-07-15T12:00:00.000Z')

    mem.clear()
    const ytStore = await import('../storage/youtubeStore')
    ytStore.loadYoutubeState()
    ytStore.setYoutubeSeenAt('2026-07-14T08:00:00.000Z')
    expect(ytStore.getYoutubeSeenAt()).toBe('2026-07-14T08:00:00.000Z')
    expect(ytStore.exportYoutubeForBackup().seenAt).toBe('2026-07-14T08:00:00.000Z')

    const news = readFileSync(resolve(__dirname, '../pages/NewsPage.tsx'), 'utf8')
    expect(news).toMatch(/Mark all read/)
    expect(news).toMatch(/setNewsSeenAt/)
    const yt = readFileSync(resolve(__dirname, '../pages/YouTubePage.tsx'), 'utf8')
    expect(yt).toMatch(/Mark all read/)
    expect(yt).toMatch(/setYoutubeSeenAt/)
  })

  it('19b: migrates legacy seen-at keys into store state', async () => {
    mem.set('mydsp_news_seen_at', '2026-01-01T00:00:00.000Z')
    mem.delete('mydsp_news_v1')
    const newsStore = await import('../storage/newsStore')
    expect(newsStore.loadNewsState().seenAt).toBe('2026-01-01T00:00:00.000Z')

    mem.clear()
    mem.set('mydsp_youtube_seen_at', '2026-02-02T00:00:00.000Z')
    mem.delete('mydsp_youtube_v1')
    const ytStore = await import('../storage/youtubeStore')
    expect(ytStore.loadYoutubeState().seenAt).toBe('2026-02-02T00:00:00.000Z')
  })

  it('20: Goals progress ring on Today when deadline within 30 days', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Dashboard.tsx'), 'utf8')
    expect(src).toMatch(/today-goal-ring/)
    expect(src).toMatch(/soonGoal/)
    expect(src).toMatch(/within 30 days/)
    expect(src).toMatch(/strokeDasharray/)
  })

  it('package version is 1.2.44', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      version: string
    }
    expect(pkg.version).toBe('1.2.73')
  })
})
