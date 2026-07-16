# MyDSP Development Roadmap

**Current version: 1.2.46**

## Completed (through v1.2.46)

- Markets / valuations (next25c 6–10): Compact/Heat density, per-section refresh, corporate action notes, Add from holding, FX triangle check
- Sync / security (next25c 1–5): dry-run pull, device nickname, biometric unlock timeout, sync setup URL export, auto-resume after pause
- Quality / ops (next25b 21–25): Settings fuzzy search + recent jumps, household snapshot PDF, Markets Cached mode, verify:bundle perf budget, UpdateBanner release notes
- Today / planning (next25b 16–20): money pulse NW Δ, Spending Make rule → Rules prefill, bills due-in-7 strip, goal projected date from surplus estimate, TradeModal save → holding detail
- Mobile ergonomics (next25b 11–15): thumb CTA bar / PageHeader phone order, Jobs column picker, Todos Select mode, landscape iPad sticky sidebar, success haptic flash
- Markets / portfolio (next25b 6–10): session Open/Closed chips, holdings drift alert, watchlist tags, dividend yield stub, Compare week-Δ
- Sync / backup trust (next25b 1–5): pull/push latency on Today, full-backup checksum, passphrase strength meter, multi-device activity hints, pause auto-sync 1 hour
- Polish / a11y (next25 21–25): EmptyIllustration, Accessibility panel, colour-blind charts, axe CI gate (`test:a11y`), `/smoke` checklist
- Today / productivity (next25 16–20): Focus Mark done/Snooze, quiet-hours timeline, spending week delta, News/YouTube mark-all-read + synced seenAt, Goals ring on Today
- Mobile interaction (next25 11–15): bottom-nav Favourites reorder sheet, Jobs Kanban touch drag, Todos swipe Complete/Snooze, iPad Today|Markets two-pane, larger text mode
- Markets / money clarity (next25 6–10): As-of sticky headers, ticker notes, cost·P&L rows, FX conversion explainer, tax exports meaning panel
- Sync / reliability (next25 1–5): health dashboard, conflict export/share, offline cancel+backoff, Markets 24h merge, quote failover banner

- Sync / a11y / perf polish (41–50): Markets shimmer, nav quote prefetch, reduced-motion sparklines/modals, muted text contrast, landmark labels, Glass focus rings, lazy Dashboard charts, Quote Worker health badge, weekly backup nudge, iPhone/iPad Playwright smoke
- Today / Jobs / Todos polish (31–40): Focus card, todo focus pulse, Kanban snap, job sticky bar, spending month picker, Filters sheet, OCR empty CTA, completed collapse, News/YouTube unread + load-more, Trips/Goals iPad density
- Settings / forms polish (21–30): sticky search, clipboard paste, passphrase reveal, Field errors, decimal inputs, keyboard avoidance, hold-to-confirm, appearance preview, native share
- Markets / holdings polish (11–20): sticky headers, sparkline detail, long-press sort, swipe actions, price strip, amber stale, Compare tablet layout, legend hide, fill undo, seed presets
- Nav / PWA polish (1–10): safe-area sheets, label truncation, landscape icon-only nav, Stage Manager padding, A2HS after sync, press feedback, PTR ring, short offline banners, conflict sheet, keyboard shortcuts help
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
