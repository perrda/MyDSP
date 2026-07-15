# MyDSP Development Roadmap

**Current version: 1.2.27**

## Completed (through v1.2.27)

- UI polish Top 10: Markets Compact overflow, tablet toolbar, banner offset, single title, bottom-nav active, Glass sheets, modal motion, Jump-in, PageHeader actions, sticky tables
- Sync chip without Now; Top 10: quote path, sync smoke doc, price alerts fire, tax export labels, broker aliases, Today movers, Glass polish, online queue banner, Compare cache age, Settings search
- Glass Mode toggle (Settings + toolbar); soft rounded edges via CSS tokens; circular notification badge
- Collapsible Filters & search on Todos / Jobs / Spending (defaults collapsed; preference persisted)
- On-launch Overview default + Settings preference (web/tablet/phone)
- Separate `mydsp-quote` Worker proxy; PWA update banner; sync conflict plain-English + activity log
- Markets watchlist union merge; Today deep links; price alerts; fill-from-last-synced holdings
- Jobs↔Todos focus deep links; idle/hover prefetch for heavy pages
- Sync Markets/News/YouTube on pull; Favourites sync; clearer sync chip + Sync now
- Faster auto-sync cadence; Markets CORS race (Worker /api/quote deferred for CI)
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

1. Run `scripts/SYNC_SMOKE.md` after each deploy (todos + portfolios + Favourites + Markets)
2. Keep quote Worker live: `npm run deploy:quote` when Markets proxies stall
3. Hard-refresh / reopen PWA so update banner + new SW activate

## Low priority

- Tune broker aliases from more real IBKR/T212/Coinbase exports
- Remittance-basis notes / deepen non-UK tax packs further

## Parking lot

- Open banking (PSD2) — informational only in Settings today  
- OAuth identity — planned; passphrase sync remains primary  
- Live/WebSocket sync (current design is encrypted batch sync)  
- Achievement confetti  
- Full wash-sale / Form 8949 generation  
- Todo `recurring` flag — use Recurring transactions / Insights instead  
- Same-origin SPA+API `/api/quote` on Workers Builds (optional path already probed)
