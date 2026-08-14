/** Security tests for encryption module */

import { describe, expect, it } from 'vitest'
import { checksum } from './crypto'

// Note: Full encryption tests require browser environment with proper Web Crypto API
// The encryption functions are tested implicitly by sync tests that use them

describe('crypto security', () => {
  describe('checksum', () => {
    it('produces consistent SHA-256 checksums', async () => {
      const text = 'test data for checksum'
      const hash1 = await checksum(text)
      const hash2 = await checksum(text)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(32) // Truncated to 32 hex chars
    })

    it('produces different checksums for different inputs', async () => {
      const hash1 = await checksum('data1')
      const hash2 = await checksum('data2')
      
      expect(hash1).not.toBe(hash2)
    })

    it('is sensitive to small changes', async () => {
      const hash1 = await checksum('test data')
      const hash2 = await checksum('test data ')
      
      expect(hash1).not.toBe(hash2)
    })

    it('handles empty strings', async () => {
      const hash = await checksum('')
      expect(hash).toHaveLength(32)
    })

    it('handles unicode characters', async () => {
      const text = '测试数据 🔐 émojis'
      const hash = await checksum(text)
      expect(hash).toHaveLength(32)
    })
  })
})
