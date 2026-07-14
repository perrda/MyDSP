import { describe, expect, it } from 'vitest'
import { normalizeSyncRemoteUrl } from '../services/sync/syncService'

describe('pull-to-refresh sync helpers', () => {
  it('keeps sync Remote URL absolute for mobile sync', () => {
    expect(normalizeSyncRemoteUrl('mydsp-sync.dave-perry.workers.dev')).toMatch(
      /^https:\/\/mydsp-sync\.dave-perry\.workers\.dev\/?$/,
    )
  })
})
