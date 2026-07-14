# QA — Markets + FX rates (v1.1.0)

**Date:** 2026-07-14  
**Branch:** `cursor/markets-section-0550`

## Scope
Markets watchlist: equities, crypto, FX (GBP/USD, GBP/THB), crypto crosses (ADA/BTC), CRUD, live quotes, sparklines, version bump to **1.1.0**.

## Automated results
| Check | Result |
|-------|--------|
| `npx tsc -b` | Pass |
| `npm test` (vitest) | **149 / 149 pass** (14 files) |
| Markets unit tests | 6 / 6 pass |
| `npm run lint` | Pass (pre-existing warnings only; no Markets errors) |
| `npm run build` (vite + Cloudflare plugin) | Blocked in this agent image by `@cloudflare/vite-plugin` / Node `registerHooks` — **TypeScript project build is clean** |

## Manual checklist (post-deploy)
1. Open **Markets** — see My Crypto, My Equities, **FX Rates**, **Crypto Crosses**
2. Confirm GBP/USD, GBP/THB, ADA/BTC present with last, day %, sparkline where available
3. Add EUR/USD and ETH/BTC; remove one; refresh
4. Duplicate GBP/USD → error “already on Markets”
5. Invalid pair `GBP` → error asking for BASE/QUOTE
6. Sidebar version shows **v1.1.0**
7. Hard-refresh other devices after sync/backup restore

## Notes
- Existing Markets installs auto-merge default FX/cross seeds on load (deleted crypto/equity are not re-added)
- FX: Yahoo `GBPUSD=X` / `GBPTHB=X` + exchangerate-api fallback
- Crosses: CoinGecko vs BTC (and derived cross when needed)
