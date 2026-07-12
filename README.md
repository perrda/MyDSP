# MyDSP

**Sole build home:** `/Users/davidperry/AI_Projects/MyDSP`

## Run

```bash
cd /Users/davidperry/AI_Projects/MyDSP
npm install
npm run dev       # http://localhost:5173 (+ LAN for phone)
npm run build
npm test          # vitest
npm run test:e2e  # Playwright (first time: npx playwright install chromium)
```

## Status (v0.6.0)

Live at **https://perrda.github.io/MyDSP/**. Family portfolios, compare view, opening-balance wizard, encrypted sync v2, trade CSV templates, BTC OTC overlay.

Versioning: **+0.01** per release (feature batches may jump). Current: **0.6.0**.

## Phone / iPad

Use the Vite **Network** URL on the same Wi‑Fi (not `localhost`). Then Safari → Share → Add to Home Screen. Sync via Settings for cross-device.

## Docs

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Backlog |
| `.cursor/rules/mydsp-project.mdc` | Agent memory |
