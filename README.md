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

## Status (v0.5.31)

David Portfolio + family workspaces (Mum, Andrew, Thomas, Rebecca, James King). Full daily backups (last 10) with restore. Trade history, historical prices, donuts.

Versioning: **+0.01** per release. Current: **0.5.31**.

## Phone / iPad

Use the Vite **Network** URL on the same Wi‑Fi (not `localhost`). Then Safari → Share → Add to Home Screen. Sync via Settings for cross-device.

## Docs

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Backlog |
| `.cursor/rules/mydsp-project.mdc` | Agent memory |
