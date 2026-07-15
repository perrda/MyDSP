import { describe, expect, it } from 'vitest'
import { resolveManualChunk } from '../build/manualChunks'

describe('vite manualChunks', () => {
  it('keeps lucide-react out of react-vendor (substring trap)', () => {
    expect(
      resolveManualChunk('/workspace/node_modules/lucide-react/dist/esm/icons/video.js'),
    ).toBe('icon-vendor')
    expect(
      resolveManualChunk('/workspace/node_modules/lucide-react/dist/esm/lucide-react.js'),
    ).toBe('icon-vendor')
  })

  it('still chunks React packages into react-vendor', () => {
    expect(resolveManualChunk('/workspace/node_modules/react/index.js')).toBe('react-vendor')
    expect(resolveManualChunk('/workspace/node_modules/react-dom/client.js')).toBe('react-vendor')
    expect(
      resolveManualChunk('/workspace/node_modules/react-router/dist/index.js'),
    ).toBe('react-vendor')
  })

  it('chunks YouTube / News / Markets pages together', () => {
    expect(resolveManualChunk('/workspace/src/pages/YouTubePage.tsx')).toBe('media-pages')
    expect(resolveManualChunk('/workspace/src/pages/NewsPage.tsx')).toBe('media-pages')
    expect(resolveManualChunk('/workspace/src/pages/MarketsPage.tsx')).toBe('media-pages')
  })

  it('keeps analysis pages together and TaxPage in tax-pages', () => {
    expect(resolveManualChunk('/workspace/src/pages/AnalyticsPage.tsx')).toBe('analysis-pages')
    expect(resolveManualChunk('/workspace/src/pages/PredictiveAnalyticsPage.tsx')).toBe(
      'analysis-pages',
    )
    expect(resolveManualChunk('/workspace/src/pages/SmartInsightsPage.tsx')).toBe('analysis-pages')
    expect(resolveManualChunk('/workspace/src/pages/TaxPage.tsx')).toBe('tax-pages')
  })
})
