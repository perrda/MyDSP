import { expect, test } from '@playwright/test'

const SALT = 'fcc_secure_salt_2026_v2'

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + SALT)
  const buf = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256_${hex.slice(0, 32)}`
}

test.describe('PIN lock', () => {
  test('unlocks with correct PIN', async ({ page }) => {
    const pinHash = await hashPin('1234')
    await page.addInitScript((hash) => {
      localStorage.setItem(
        'fcc_security',
        JSON.stringify({
          pinEnabled: true,
          pinHash: hash,
          autoLockMinutes: 30,
          biometricEnabled: false,
        }),
      )
    }, pinHash)

    await page.goto('/')
    await expect(page.getByText(/enter pin to unlock/i)).toBeVisible({ timeout: 20_000 })

    for (const d of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: `Digit ${d}` }).click()
    }

    await expect(page.getByText(/overview/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('rejects incorrect PIN', async ({ page }) => {
    const pinHash = await hashPin('1234')
    await page.addInitScript((hash) => {
      localStorage.setItem(
        'fcc_security',
        JSON.stringify({
          pinEnabled: true,
          pinHash: hash,
          autoLockMinutes: 30,
          biometricEnabled: false,
        }),
      )
    }, pinHash)

    await page.goto('/')
    await expect(page.getByText(/enter pin to unlock/i)).toBeVisible({ timeout: 20_000 })

    for (const d of ['9', '9', '9', '9']) {
      await page.getByRole('button', { name: `Digit ${d}` }).click()
    }

    await expect(page.getByText(/incorrect pin/i)).toBeVisible()
    await expect(page.getByText(/enter pin to unlock/i)).toBeVisible()
  })
})
