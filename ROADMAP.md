# MyDSP Development Roadmap

**Current version: 1.2.22**

## Completed (through v1.2.22)

- Sync Markets/News/YouTube on pull; Favourites sync; clearer sync chip + Sync now
- Faster auto-sync cadence; same-origin `/api/quote` Worker proxy
- Markets live vs last-synced labels; tablet bottom nav; Overview Today; offline queue banner
- Sidebar Favourites / Others order synced via fullArchive + backups across devices
- Markets: race Yahoo CORS proxies; Frankfurter FX sparklines; last-synced fallback for all tickers
- Markets: preserve sparklines/day-change on degraded live merges; Finnhub/Yahoo resilience
- Fix Getting started checklist hooks crash (ErrorBoundary flash on Overview)
- Standout polish Top 10 (sync chip, just-added pulse, motion, empty CTAs, Markets density, tax strip, PDF brand, bottom-nav favourites, getting started)
- Markets / News / YouTube, Favourites nav, PIN/Face ID iOS polish
- Full section QA, empty states, overflow menus, live notification bell
- Mobile header toolbar: lean RH cluster (no overlapping icons)
- Settings Alerts (desktop banners + quiet hours + optional critical beep)
- Per-portfolio display currency + tax residency (Tax page + Settings)
- Encrypted sync + conflict handoff to Settings review UI
- Sync reliability: pull-before-push, todo list name merge
- Full backups, Compare, Jobs/Todos (board columns polished)
- Markets last-good quote cache + 7-day sparkline fixes
- Header Search icon redesign
- Paste trade CSV + IBKR / Trading 212 / Coinbase header detection
- Broker sample CSV fixtures + Settings download links
- Enhanced bank CSV wizard (mapping + income honesty + a11y)
- Smart Insights → Merchant Rules / Recurring wiring
- Compare / opening-wizard accessibility; fill prices from history
- Non-UK tax packs + US 8949/wash-sale informational stub
- Full financial PDF report; TaxPage `tax-pages` chunk split
- API webhook ping foundations; open-banking honesty section
- Markets provider health hints on the status line

## Next (manual / ongoing)

1. Cross-device sync smoke after deploy (todos + portfolios + Favourites + Markets watchlist)
2. Hard-refresh PWA so `/api/quote` Worker route is live

## Low priority

- Tune broker aliases from real IBKR/T212/Coinbase exports
- Remittance-basis notes / deepen non-UK tax packs

## Parking lot

- Open banking (PSD2) — informational only in Settings today  
- OAuth identity — planned; passphrase sync remains primary  
- Live/WebSocket sync (current design is encrypted batch sync)  
- Achievement confetti  
- Full wash-sale / Form 8949 generation  
- Todo `recurring` flag — use Recurring transactions / Insights instead  
