import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  exportFxRatesForBackup,
  importFxRatesFromBackup,
  loadCachedFxRates,
  saveCachedFxRates,
} from '../services/fx'
import { applyWorkspaceExtrasFromPreview, saveSyncConfig } from '../services/sync/syncService'
import {
  addYoutubeChannel,
  exportYoutubeForBackup,
  importYoutubeFromBackup,
  listYoutubeChannels,
  loadYoutubeState,
} from '../storage/youtubeStore'

describe('YouTube + FX extras Mini → satellite (1.2.149)', () => {
  beforeEach(() => {
    localStorage.clear()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: false,
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('empty YouTube seed is silent; real add is dirty-capable; union + FX LWW', () => {
    const seeded = loadYoutubeState()
    expect(seeded.channels).toEqual([])

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
    saveCachedFxRates({ GBP: 1, USD: 1.34, THB: 43.2, BTC: 1 / 90_000 }, 1_725_000_000_000)
    const miniYoutube = exportYoutubeForBackup()
    const miniFx = exportFxRatesForBackup()
    expect(miniYoutube.channels).toHaveLength(2)
    expect(miniFx.rates.USD).toBe(1.34)

    localStorage.clear()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: false,
    })
    expect(loadYoutubeState().channels).toEqual([])
    addYoutubeChannel({
      channelId: 'UC_macbook',
      title: 'Leftover only on MacBook',
      url: 'https://www.youtube.com/@leftover',
    })
    importYoutubeFromBackup(miniYoutube)
    importFxRatesFromBackup(miniFx)
    const titles = listYoutubeChannels()
      .map((c) => c.title)
      .sort()
    expect(titles).toEqual(['Leftover only on MacBook', 'MoneyZG', 'Simply Bitcoin'])
    expect(loadCachedFxRates().USD).toBe(1.34)
    expect(loadCachedFxRates().THB).toBe(43.2)
  })

  it('applyWorkspaceExtrasFromPreview lands YouTube + FX on a satellite', async () => {
    addYoutubeChannel({
      channelId: 'UC_mini',
      title: 'Altcoin Daily',
      url: 'https://www.youtube.com/@AltcoinDaily',
    })
    saveCachedFxRates({ GBP: 1, USD: 1.31, THB: 44 }, 1_725_100_000_000)
    const extras = {
      youtube: exportYoutubeForBackup(),
      fxRates: exportFxRatesForBackup(),
    }

    localStorage.clear()
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: false,
    })
    expect(loadYoutubeState().channels).toEqual([])

    await applyWorkspaceExtrasFromPreview({
      source: 'pull',
      portfolios: [],
      registryPortfolios: [],
      conflicts: [],
      workspaceExtras: extras,
    })
    expect(listYoutubeChannels().map((c) => c.title)).toEqual(['Altcoin Daily'])
    expect(loadCachedFxRates().USD).toBe(1.31)
  })

  it('Mini (book) does not import satellite FX over a newer live cache', async () => {
    saveSyncConfig({
      remoteUrl: 'https://mydsp-sync.dave-perry.workers.dev',
      enabled: true,
      thisDeviceIsTheBook: true,
    })
    saveCachedFxRates({ GBP: 1, USD: 1.4 }, 1_725_200_000_000)
    await applyWorkspaceExtrasFromPreview({
      source: 'pull',
      portfolios: [],
      registryPortfolios: [],
      conflicts: [],
      workspaceExtras: {
        fxRates: { rates: { GBP: 1, USD: 1.11 }, updatedAt: 1 },
      },
    })
    expect(loadCachedFxRates().USD).toBe(1.4)
  })
})
