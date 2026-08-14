/** Security tests for PIN authentication */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  hashPin,
  verifyPin,
  saveSecurity,
  loadSecurity,
  type SecurityState
} from './pin'

describe('PIN security', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('hashPin', () => {
    it('hashes PINs using SHA-256', async () => {
      const hash = await hashPin('1234')
      expect(hash).toMatch(/^sha256_[a-f0-9]{32}$/)
    })

    it('produces consistent hashes for same PIN', async () => {
      const hash1 = await hashPin('5678')
      const hash2 = await hashPin('5678')
      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different PINs', async () => {
      const hash1 = await hashPin('1111')
      const hash2 = await hashPin('2222')
      expect(hash1).not.toBe(hash2)
    })

    it('includes salt in hash', async () => {
      // Hashes should be salted, not just raw PIN hash
      const hash = await hashPin('0000')
      const rawHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode('0000')
      )
      const rawHex = [...new Uint8Array(rawHash)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32)
      
      expect(hash).not.toBe(`sha256_${rawHex}`)
    })
  })

  describe('verifyPin', () => {
    it('verifies correct PIN', async () => {
      const pin = '9876'
      const hash = await hashPin(pin)
      const valid = await verifyPin(pin, hash)
      expect(valid).toBe(true)
    })

    it('rejects incorrect PIN', async () => {
      const hash = await hashPin('1234')
      const valid = await verifyPin('4321', hash)
      expect(valid).toBe(false)
    })

    it('rejects empty hash', async () => {
      const valid = await verifyPin('1234', '')
      expect(valid).toBe(false)
    })

    it('only accepts 4-digit numeric PINs', async () => {
      const hash = await hashPin('1234')
      
      expect(await verifyPin('123', hash)).toBe(false)   // Too short
      expect(await verifyPin('12345', hash)).toBe(false) // Too long
      expect(await verifyPin('abcd', hash)).toBe(false)  // Non-numeric
      expect(await verifyPin('12a4', hash)).toBe(false)  // Mixed
      expect(await verifyPin('1234', hash)).toBe(true)   // Valid
    })

    it('rejects timing attack attempts', async () => {
      // Multiple incorrect attempts should not leak timing info
      const hash = await hashPin('5555')
      const attempts = ['0000', '1111', '2222', '3333', '4444']
      
      const timings = await Promise.all(
        attempts.map(async (pin) => {
          const start = Date.now()
          await verifyPin(pin, hash)
          return Date.now() - start
        })
      )
      
      // All timings should be relatively close (within 10ms variance)
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length
      timings.forEach(t => {
        expect(Math.abs(t - avg)).toBeLessThan(10)
      })
    })
  })

  describe('security state persistence', () => {
    it('saves and loads security state', () => {
      const state: SecurityState = {
        pinEnabled: true,
        pinHash: 'sha256_abc123',
        autoLockMinutes: 5,
        biometricEnabled: false
      }
      
      saveSecurity(state)
      const loaded = loadSecurity()
      
      expect(loaded).toEqual(state)
    })

    it('returns default state when no data exists', () => {
      localStorage.clear()
      const state = loadSecurity()
      
      expect(state.pinEnabled).toBe(false)
      expect(state.pinHash).toBe('')
      expect(state.autoLockMinutes).toBe(5)
      expect(state.biometricEnabled).toBe(false)
    })

    it('clamps auto-lock minutes to allowed values', () => {
      // Test clamping by saving invalid values
      localStorage.setItem('fcc_security', JSON.stringify({
        pinEnabled: true,
        pinHash: 'test',
        autoLockMinutes: 7, // Invalid, should clamp to 5
        biometricEnabled: false
      }))
      
      const state = loadSecurity()
      expect([0, 1, 5, 15]).toContain(state.autoLockMinutes)
    })

    it('sanitizes invalid JSON gracefully', () => {
      localStorage.setItem('fcc_security', 'invalid json {')
      const state = loadSecurity()
      
      expect(state.pinEnabled).toBe(false)
      expect(state.pinHash).toBe('')
    })

    it('handles malicious localStorage injection', () => {
      // Try to inject dangerous values
      localStorage.setItem('fcc_security', JSON.stringify({
        pinEnabled: '<script>alert(1)</script>',
        pinHash: { malicious: 'object' },
        autoLockMinutes: '999999',
        biometricEnabled: 'not-a-boolean'
      }))
      
      const state = loadSecurity()
      
      expect(typeof state.pinEnabled).toBe('boolean')
      expect(typeof state.pinHash).toBe('string')
      expect(typeof state.autoLockMinutes).toBe('number')
      expect(typeof state.biometricEnabled).toBe('boolean')
      expect([0, 1, 5, 15]).toContain(state.autoLockMinutes)
    })
  })
})
