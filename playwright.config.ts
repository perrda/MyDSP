import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    {
      name: 'iphone-14-landscape',
      use: { ...devices['iPhone 14 landscape'] },
    },
    /* Project id kept as ipad-air; Playwright 1.52 ships iPad (gen 7), not "iPad Air". */
    { name: 'ipad-air', use: { ...devices['iPad (gen 7)'] } },
    {
      name: 'ipad-air-landscape',
      use: { ...devices['iPad (gen 7) landscape'] },
    },
  ],
})
