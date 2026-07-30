import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  budgetCategoryUrl,
  planningMonteCarloUrl,
  spendingCategoryUrl,
  youtubeVideoUrl,
} from '../domain/deepLinks'
import { createJobApplication } from '../domain/jobs'
import { buildReminderCenterNotifications } from '../components/SmartNotifications'
import {
  exportNewsForBackup,
  getSavedNewsArticles,
  importNewsFromBackup,
  toggleSavedNewsArticle,
} from '../storage/newsStore'
import { buildYoutubeUploadNotifications } from '../domain/youtubeUploadAlerts'
import { saveYoutubeVideosCache } from '../storage/youtubeStore'

const memory = new Map<string, string>()

describe('next 10 wave 4 items 5–9', () => {
  beforeEach(() => {
    memory.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, String(value)),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    memory.clear()
  })

  it('builds category/month and temporary planning deep links', () => {
    expect(spendingCategoryUrl('Dining Out', '2026-07')).toBe(
      '/spending?category=dining+out&month=2026-07',
    )
    expect(budgetCategoryUrl('Food', '2026-07')).toBe('/budgets?category=food&month=2026-07')
    expect(planningMonteCarloUrl(125000, 1750)).toBe(
      '/planning?tab=montecarlo&nw=125000&savings=1750',
    )
  })

  it('puts stale job follow-ups in Notification Center with job URLs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'))
    const job = createJobApplication({
      id: 55,
      companyName: 'Acme',
      jobTitle: 'Engineer',
      status: 'applied',
      appliedDate: '2026-07-01',
    })
    const notifications = buildReminderCenterNotifications({
      spending: [],
      budgetGoals: {},
      goals: [],
      todoItems: [],
      jobApplications: [job],
      liabilities: [],
    } as never)
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job-follow-up-55',
          actionUrl: '/jobs/55',
        }),
      ]),
    )
  })

  it('keeps an unsaved headline deleted when stale saved state syncs back', () => {
    const key = 'https://example.com/story'
    expect(toggleSavedNewsArticle(key)).toBe(true)
    const staleSavedDevice = exportNewsForBackup()
    expect(toggleSavedNewsArticle(key)).toBe(false)
    const unsavedDevice = exportNewsForBackup()

    memory.clear()
    importNewsFromBackup(staleSavedDevice)
    expect(getSavedNewsArticles()).toContain(key)
    importNewsFromBackup(unsavedDevice)
    expect(getSavedNewsArticles()).not.toContain(key)
    importNewsFromBackup(staleSavedDevice)
    expect(getSavedNewsArticles()).not.toContain(key)
  })

  it('deep-links YouTube upload notifications to their video', () => {
    saveYoutubeVideosCache({
      fetchedAt: '2026-07-30T11:00:00.000Z',
      videos: [
        {
          id: 'yt:video:abcdefghijk',
          channelId: 'channel-1',
          channelTitle: 'Finance',
          title: 'Market update',
          link: 'https://www.youtube.com/watch?v=abcdefghijk',
          publishedAt: '2026-07-30T10:00:00.000Z',
        },
      ],
    })
    expect(buildYoutubeUploadNotifications()[0]?.actionUrl).toBe(
      youtubeVideoUrl('yt:video:abcdefghijk'),
    )
  })
})
