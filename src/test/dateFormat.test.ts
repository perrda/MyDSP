import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../utils/format'

describe('local date formatting', () => {
  it('formats date as DD MMM YYYY in local time', () => {
    const iso = '2026-07-14T04:20:08.000Z'
    const out = formatDate(iso)
    // en-GB short month — day padded, month abbreviated (locale may insert commas)
    expect(out).toMatch(/14/)
    expect(out).toMatch(/Jul/)
    expect(out).toMatch(/2026/)
    expect(out).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formats datetime with local clock time', () => {
    const iso = '2026-07-14T04:20:08.000Z'
    const out = formatDateTime(iso)
    expect(out).toMatch(/14/)
    expect(out).toMatch(/Jul/)
    expect(out).toMatch(/2026/)
    expect(out).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(out).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})
