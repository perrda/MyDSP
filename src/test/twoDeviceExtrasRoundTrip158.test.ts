/**
 * Mini ↔ satellite extras + book over a mocked sync Worker.
 * Proves first Unlock REPLACE, later union + dirty pull-then-push,
 * and Mini receiving a channel added on the satellite after Unlock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyPortfolio } from '../domain/defaults'
import type { PortfolioData } from '../domain/types'
import { saveCachedFxRates, loadCachedFxRates } from '../services/fx'
import { unlockAndPullFromCloud } from '../services/sync/oneButtonSync'
import { markLocalDataChanged, runAutoSyncCycle, stopAutoSync } from '../services/sync/autoSyncService'
import { clearSessionSyncPassphrase, setSessionSyncPassphrase } from '../services/sync/sessionPassphrase'
import {
  applyWorkspaceExtrasFromPreview,
  previewPull,
  pushSync,
  saveSyncConfig,
} from '../services/sync/syncService'
import { addMarketTicker, listMarketTickers } from '../storage/marketsStore'
import { addNewsTag, loadNewsState } from '../storage/newsStore'
import { listPortfolios, loadPortfolio, savePortfolioImmediate } from '../storage/portfolioStore'
import { addYoutubeChannel, listYoutubeChannels } from '../storage/youtubeStore'
import { refreshLiveMarksAfterUnlock } from '../services/marketsQuotes'

vi.mock('../services/marketsQuotes', () => ({
  refreshLiveMarksAfterUnlock: vi.fn(async () => undefined),
}))

const PASS = 'long-enough-passphrase'
const URL = 'https://mydsp-sync.dave-perry.workers.dev'

function snapshotStorage(): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) out[key] = localStorage.getItem(key) ?? ''
  }
  return out
}

function restoreStorage(snap: Record<string, string>): void {
  localStorage.clear()
  for (const [key, value] of Object.entries(snap)) localStorage.setItem(key, value)
}

function seedPortfolio(id: string, name: string, data: PortfolioData): void {
  localStorage.setItem(
    'fcc_portfolios',
    JSON.stringify([{ id, name, createdAt: '2024-01-01T00:00:00.000Z' }]),
  )
  localStorage.setItem('fcc_active_portfolio', id)
  savePortfolioImmediate(data, id)
}

function miniBook(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [
    { id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 12.5, price: 85_000, cost: 400_000 },
  ]
  return data
}

function leftoverBook(): PortfolioData {
  const data = createEmptyPortfolio()
  data.crypto = [{ id: 1, symbol: 'BTC', name: 'Bitcoin', qty: 0.04, price: 0, cost: 2811 }]
  return data
}

function installMockSyncCloud() {
  let envelope: string | null = null
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const isSync = href.includes('mydsp-sync.dave-perry.workers.dev')
    if (!isSync) return new Response('not-sync', { status: 404 })
    if (method === 'PUT' || method === 'POST') {
      envelope = typeof init?.body === 'string' ? init.body : null
      return new Response('ok', { status: 200 })
    }
    if (!envelope) return new Response('Not found', { status: 404 })
    if (href.includes('meta=1')) {
      const parsed = JSON.parse(envelope) as {
        exportedAt?: string
        deviceId?: string
        checksum?: string
      }
      return new Response(
        JSON.stringify({
          exportedAt: parsed.exportedAt,
          deviceId: parsed.deviceId,
          checksum: parsed.checksum,
          encryptedBytes: envelope.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(envelope, { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    getEnvelope: () => envelope,
    fetchMock,
  }
}

describe('Mini ↔ satellite extras Worker round-trip (1.2.158)', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSyncPassphrase()
    stopAutoSync()
    vi.useRealTimers()
  })

  afterEach(() => {
    stopAutoSync()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    clearSessionSyncPassphrase()
  })

  it('Unlock replaces leftovers; later satellite extras reach Mini; leftover qty never uploads', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    addYoutubeChannel({
      channelId: 'UC_mini_2',
      title: 'Simply Bitcoin',
      url: 'https://www.youtube.com/@SimplyBitcoin',
    })
    addNewsTag({ tag: 'MINI', label: 'Mini-only tag' })
    addMarketTicker({ kind: 'crypto', symbol: 'SOL', name: 'Solana' })
    saveCachedFxRates({ GBP: 1, USD: 1.34, THB: 43.2, BTC: 1 / 90_000 }, 1_725_000_000_000)

    await pushSync(URL, PASS)
    expect(cloud.getEnvelope()).toBeTruthy()
    expect(cloud.fetchMock.mock.calls.some((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')).toBe(
      true,
    )
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    addYoutubeChannel({
      channelId: 'UC_leftover',
      title: 'Leftover only on MacBook',
      url: 'https://www.youtube.com/@leftover',
    })
    addNewsTag({ tag: 'LEFTO', label: 'Leftover tag' })
    addMarketTicker({ kind: 'crypto', symbol: 'DOGE', name: 'Leftover coin' })

    const putCount = () =>
      cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT').length

    const pulled = await unlockAndPullFromCloud(PASS)
    expect(pulled.action).toBe('pull')
    expect(putCount()).toBe(1)
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual(['MoneyZG', 'Simply Bitcoin'])
    expect(loadNewsState().tags.map((t) => t.tag)).toContain('MINI')
    expect(loadNewsState().tags.map((t) => t.tag)).not.toContain('LEFTO')
    expect(listMarketTickers().map((t) => t.symbol)).toContain('SOL')
    expect(listMarketTickers().map((t) => t.symbol)).not.toContain('DOGE')
    expect(listPortfolios().map((p) => p.id)).toEqual(['default'])
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(12.5)
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.cost).toBe(400_000)
    expect(loadCachedFxRates().USD).toBe(1.34)

    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    addYoutubeChannel({
      channelId: 'UC_after',
      title: 'Added on MacBook after Unlock',
      url: 'https://www.youtube.com/@after',
    })
    addNewsTag({ tag: 'SOL', label: 'Solana news' })
    addMarketTicker({ kind: 'crypto', symbol: 'LINK', name: 'Chainlink' })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(putCount()).toBeGreaterThan(1)
    })

    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual(['MoneyZG', 'Simply Bitcoin'])

    const preview = await previewPull(URL, PASS)
    await applyWorkspaceExtrasFromPreview(preview)
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added on MacBook after Unlock',
      'MoneyZG',
      'Simply Bitcoin',
    ])
    expect(loadNewsState().tags.map((t) => t.tag)).toEqual(
      expect.arrayContaining(['MINI', 'SOL']),
    )
    expect(listMarketTickers().map((t) => t.symbol)).toEqual(
      expect.arrayContaining(['SOL', 'LINK']),
    )
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(12.5)
    expect(loadCachedFxRates().USD).toBe(1.34)
  })

  it('Mini boot/Backup pushSync absorbs satellite extras — never reverts a MacBook channel', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    await pushSync(URL, PASS)
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    addYoutubeChannel({
      channelId: 'UC_after',
      title: 'Added on MacBook after Unlock',
      url: 'https://www.youtube.com/@after',
    })
    addNewsTag({ tag: 'SOL', label: 'Solana news' })
    addMarketTicker({ kind: 'crypto', symbol: 'LINK', name: 'Chainlink' })
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(
        cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')
          .length,
      ).toBeGreaterThan(1)
    })

    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['MoneyZG'])

    // Mini boot / Backup / Settings Sync — same pushSync. Must absorb first.
    await pushSync(URL, PASS)
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added on MacBook after Unlock',
      'MoneyZG',
    ])
    expect(loadNewsState().tags.map((t) => t.tag)).toContain('SOL')
    expect(listMarketTickers().map((t) => t.symbol)).toContain('LINK')
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(12.5)

    const afterMini = await previewPull(URL, PASS)
    await applyWorkspaceExtrasFromPreview(afterMini)
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added on MacBook after Unlock',
      'MoneyZG',
    ])
  })

  it('Mini boot/Backup pushSync absorbs satellite holding size — never reverts BTC qty', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    await pushSync(URL, PASS)
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    const grown = loadPortfolio('default')
    grown.crypto[0] = { ...grown.crypto[0], qty: 13.25, cost: 420_000 }
    savePortfolioImmediate(grown, 'default')
    addYoutubeChannel({
      channelId: 'UC_size',
      title: 'Added with size change',
      url: 'https://www.youtube.com/@size',
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(
        cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')
          .length,
      ).toBeGreaterThan(1)
    })

    stopAutoSync()
    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(12.5)

    const putsBefore = cloud.fetchMock.mock.calls.filter(
      (c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT',
    ).length
    await pushSync(URL, PASS)
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(13.25)
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.cost).toBe(420_000)
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added with size change',
      'MoneyZG',
    ])

    const afterMini = await previewPull(URL, PASS)
    const remoteBtc = afterMini.portfolios
      .find((p) => p.portfolioId === 'default')
      ?.remote.crypto.find((h) => h.symbol === 'BTC')
    expect(remoteBtc?.qty).toBe(13.25)
    expect(remoteBtc?.cost).toBe(420_000)
    const putsAfter = cloud.fetchMock.mock.calls.filter(
      (c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT',
    ).length
    expect(putsAfter).toBeGreaterThan(putsBefore)
  })

  it('Mini boot/Backup pushSync absorbs a holding added on the satellite after Unlock', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    await pushSync(URL, PASS)
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    const grown = loadPortfolio('default')
    grown.crypto.push({
      id: 2,
      symbol: 'ETH',
      name: 'Ethereum',
      qty: 4,
      price: 3_000,
      cost: 8_000,
    })
    savePortfolioImmediate(grown, 'default')
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(
        cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')
          .length,
      ).toBeGreaterThan(1)
    })
    expect(loadPortfolio('default').crypto.map((h) => h.symbol).sort()).toEqual(['BTC', 'ETH'])

    stopAutoSync()
    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(loadPortfolio('default').crypto.map((h) => h.symbol)).toEqual(['BTC'])

    await pushSync(URL, PASS)
    expect(loadPortfolio('default').crypto.map((h) => h.symbol).sort()).toEqual(['BTC', 'ETH'])
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'ETH')?.qty).toBe(4)

    const afterMini = await previewPull(URL, PASS)
    expect(
      afterMini.portfolios
        .find((p) => p.portfolioId === 'default')
        ?.remote.crypto.map((h) => h.symbol)
        .sort(),
    ).toEqual(['BTC', 'ETH'])
  })

  it('Mini boot/Backup pushSync absorbs a holding deleted on the satellite after Unlock', async () => {
    const cloud = installMockSyncCloud()
    const two = miniBook()
    two.crypto.push({
      id: 2,
      symbol: 'SOL',
      name: 'Solana',
      qty: 10,
      price: 140,
      cost: 1_000,
    })

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', two)
    await pushSync(URL, PASS)
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    expect(loadPortfolio('default').crypto.map((h) => h.symbol).sort()).toEqual(['BTC', 'SOL'])
    const trimmed = loadPortfolio('default')
    trimmed.crypto = trimmed.crypto.filter((h) => h.symbol !== 'SOL')
    savePortfolioImmediate(trimmed, 'default')
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(
        cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')
          .length,
      ).toBeGreaterThan(1)
    })
    expect(loadPortfolio('default').crypto.map((h) => h.symbol)).toEqual(['BTC'])

    stopAutoSync()
    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(loadPortfolio('default').crypto.map((h) => h.symbol).sort()).toEqual(['BTC', 'SOL'])

    await pushSync(URL, PASS)
    expect(loadPortfolio('default').crypto.map((h) => h.symbol)).toEqual(['BTC'])

    const afterMini = await previewPull(URL, PASS)
    expect(
      afterMini.portfolios
        .find((p) => p.portfolioId === 'default')
        ?.remote.crypto.map((h) => h.symbol),
    ).toEqual(['BTC'])
  })

  it('Mini open + Automatic off absorbs a satellite channel on the interval cycle', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    await pushSync(URL, PASS)
    const miniSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    addYoutubeChannel({
      channelId: 'UC_interval',
      title: 'Added while Mini stayed open',
      url: 'https://www.youtube.com/@interval',
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    markLocalDataChanged()
    await vi.advanceTimersByTimeAsync(4_000)
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(
        cloud.fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT')
          .length,
      ).toBeGreaterThan(1)
    })

    restoreStorage(miniSnap)
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['MoneyZG'])

    await runAutoSyncCycle('interval')
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added while Mini stayed open',
      'MoneyZG',
    ])
  })

  it('satellite open + Automatic off pulls Mini extras on the interval cycle', async () => {
    const cloud = installMockSyncCloud()

    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    seedPortfolio('default', 'David', miniBook())
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    await pushSync(URL, PASS)

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_macbook')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    seedPortfolio('default', 'David', leftoverBook())
    await unlockAndPullFromCloud(PASS)
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['MoneyZG'])
    const satelliteSnap = snapshotStorage()

    localStorage.clear()
    clearSessionSyncPassphrase()
    localStorage.setItem('mydsp_device_id', 'dev_mini')
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: true,
      rememberPassphrase: true,
    })
    setSessionSyncPassphrase(PASS, { remember: true })
    const grown = miniBook()
    grown.crypto[0] = { ...grown.crypto[0], qty: 13.25, cost: 420_000 }
    seedPortfolio('default', 'David', grown)
    addYoutubeChannel({
      channelId: 'UC_mini_1',
      title: 'MoneyZG',
      url: 'https://www.youtube.com/@MoneyZG',
    })
    addYoutubeChannel({
      channelId: 'UC_mini_new',
      title: 'Added on Mini while MacBook stayed open',
      url: 'https://www.youtube.com/@mini-open',
    })
    addNewsTag({ tag: 'MININEW', label: 'Mini while satellite open' })
    addMarketTicker({ kind: 'crypto', symbol: 'AVAX', name: 'Avalanche' })
    saveCachedFxRates({ GBP: 1, USD: 1.41, THB: 44.1, BTC: 1 / 92_000 }, Date.now() + 60_000)
    await pushSync(URL, PASS)
    const putsAfterMini = cloud.fetchMock.mock.calls.filter(
      (c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT',
    ).length
    expect(putsAfterMini).toBeGreaterThan(0)

    restoreStorage(satelliteSnap)
    stopAutoSync()
    setSessionSyncPassphrase(PASS, { remember: true })
    saveSyncConfig({
      remoteUrl: URL,
      enabled: false,
      thisDeviceIsTheBook: false,
    })
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['MoneyZG'])
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(12.5)

    vi.mocked(refreshLiveMarksAfterUnlock).mockClear()
    await runAutoSyncCycle('interval')
    expect(listYoutubeChannels().map((c) => c.title).sort()).toEqual([
      'Added on Mini while MacBook stayed open',
      'MoneyZG',
    ])
    expect(loadNewsState().tags.map((t) => t.tag)).toContain('MININEW')
    expect(listMarketTickers().map((t) => t.symbol)).toContain('AVAX')
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.qty).toBe(13.25)
    expect(loadPortfolio('default').crypto.find((h) => h.symbol === 'BTC')?.cost).toBe(420_000)
    expect(loadCachedFxRates().USD).toBe(1.41)
    expect(refreshLiveMarksAfterUnlock).toHaveBeenCalled()
    const putsAfterPull = cloud.fetchMock.mock.calls.filter(
      (c) => String(c[1]?.method ?? 'GET').toUpperCase() === 'PUT',
    ).length
    expect(putsAfterPull).toBe(putsAfterMini)
  })
})
