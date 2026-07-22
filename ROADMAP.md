# MyDSP Development Roadmap

**Current version: 1.2.90**

## Completed (through v1.2.90)

- Markets refresh + passphrase chip (v1.2.90): brief Refreshing data banner · auto-refresh · no permanent Sync prices CTA · Unlock sync amber chip (passphrase ≠ Markets failure)
- Alert quiet + chart axis standard (v1.2.89): Concentration Review Holding calendar-month dismiss · To Do launch toasts only reminder/overdue · Backup nudge dismiss · Chart X/Y axis rules in `domain/chartAxis.ts` (1D→ALL · GBP/USD/THB/BTC) across all money charts
- Sync / Markets / Today polish (next25w tip 1–25): Review/Analytics/Optimizer/Planning Sync thumbs · landscape sticky/thumb/jump/density polish · Todos/Jobs/Budgets/YouTube sticky · Today jump overflow + offline Retry testid + landscape two-pane · Playwright iPhone/iPad landscape projects (fixed iPad device) + sticky axe
- Sync / Markets / Today polish (next25v tip 1–25): Notification settings LWW (quiet hours · desktop · sound · categories), Markets Sort/Sections/Density/Sync-prices testids · FX Use suggested Undo, Equities/Crypto/Spending/Family/Docs/Compare/Rules/FIRE Sync thumbs · Bottom-nav Rules/FIRE, Today bill Skip Undo · WTD/Debt/Money pulse testids · Budget/Runway/FIRE jump chips · What arrived testids, axe Sort/Density + Skip Undo/What arrived + Equities Sync/Compare sticky
- Sync / Markets / Today polish (next25u tip 1–25): Glass / Large text / Theme / Accessibility LWW, Markets sticky filters · Copy % · timeframe/tag testids · Undo retag, Liabilities/Tax Sync thumbs · sticky RAG/Journal/Recurring · Bottom-nav Documents/Journal, Today focus/bill/interview Undo testids · News/YouTube Mark-all Undo · Budget pulse/Cash runway testids, axe sticky filters/Copy % + focus/Mark-all Undo + Liabilities/Journal sticky
- Sync / Markets / Today polish (next25t tip 1–25): Todos sort / Jobs view / Liabilities RAG / Review month LWW, Markets Yield-sort · quote Edit · Undo-remove · Add-from-holding · Copy price/Share, Budgets/History Sync thumbs · Spending sticky month · Bottom-nav Budgets/History/Family · News sticky filters · Todos/Jobs Sync thumbs, Today follow-up Undo · Debt jump · Focus Snooze Undo · FIRE chip · jump scroll-spy, axe Yield-sort/Edit + follow-up Undo/FIRE + Tax/Review sticky
- Sync / Markets / Today polish (next25s tip 1–25): webhook / achievements seen / getting-started / What arrived dismiss LWW, Markets Open holding · price alert · Expand/Collapse · Retag · back-online toast, Compare/Tax sticky · Legacy PTR · Compare/Recurring/Review slots · Goals/Trips Sync thumb · Review sticky month, Today bill/interview Undo · Tax jump · budget next-action · What arrived Open first, axe Expand-all + bill Undo + Tax jump/Compare sticky
- Sync / Markets / Today polish (next25r tip 1–25): Settings sections / Tax year / Journal filter / NW spark LWW, Markets quote Copy·News·Retry + Retry-all-stale + search clear + density trust + commodity paper NW, Analytics/Opening thumbs + Trips/Analytics long-press Sync, Today Goals jump / offline Retry / goal next-action / What arrived dismiss / Focus undo, axe Goals jump + Markets Retry-all + Analytics/Opening
- Sync / Markets / Today polish (next25q tip 1–25): Launch path / UI panels / Markets tag-Yield / Settings jumps LWW, Markets undo remove + stale Retry + quote Edit, FIRE/Optimizer/API thumbs + PTR + long-press Sync, Today jump chips / All caught up / offline queue / focus pulse, axe Today offline-queue + Markets tag hint + Legacy import
- Sync / Markets / Today polish (next25p tip 1–25): News/YouTube prefs LWW, Favourites layout LWW, Markets deletion tombstones, keyboard rows, Add commodity/FX/index thumbs, Today Sync thumb + Refresh & open `?refresh=1`, follow-up next-action, PTR Settings/Staking/Planning/Smoke, axe Predictive/Insights/API/Review/Smoke/Job+Liability detail
- Sync / Markets / Today polish (next25o tip 1–25): bottom-nav slots LWW, journal What arrived, Markets density/collapse LWW, jump tablist, Compact thumb, section as-of, paper NW overflow, Family/Docs/Journal/Rules thumbs, interview Mark done, axe Staking→Achievements
- Sync / Markets / Today polish (next25n tip 1–25): Todos/Jobs filter LWW, YT last-good, Markets jump-retry/search-select, phone Notify, long-press Recurring/Tax/Compare, Today Mark all read/media trust
- News / YouTube polish (next25m tip 1–25): Yahoo RSS primary headlines, last-good merge, background media refresh, YouTube upload bell/desktop alerts, Worker no-store on feed errors, smoke Yahoo RSS body probe, status-strip + tablet selection polish
- Sync / prefs polish (next25l tip 1–25): Recurring sort / drift / concentration / Spending+News filters LWW, Equities/Crypto thumb, jump unavailable badges, tag/Yield toggle, Spending/Liabilities/Goals/Trips thumb, PTR expand, Today debt pulse, Jobs follow-up, bills-due nav hint, axe Family/Documents
- Sync / Markets / Today polish (next25k tip 1–25): Quote Worker identity smoke, digest/compare prefs LWW, jump-chip active highlight, paper NW chip, sticky header offsets, News/YT thumb CTA, Today trust strip, interview next-action, Todos Due today chips, PTR Todos/Jobs/Spending, axe History/Budgets, Markets sticky e2e
- Sync / Today polish (next25j tip 1–25): Compare week-Δ sync, What arrived extras, digest persist, paper NW in Compare/history, News unread Jump-in + bottom-nav dots, Tax/Recurring thumb+PTR, Today SLA/429/partial chips, smoke News allowlist, axe Liabilities/Import
- Sync / media / polish (next25i tip 1–25): ISA override + YT video cache + alert thresholds sync, Finnhub 429 chip, paper commodity NW, PTR Tax/Compare, News/YouTube master–detail, bill commentary, YouTube unread Jump-in, smoke allowlist/ISA/PTR, axe Jobs/Goals/Trips, device-local prefs matrix
- Finnhub / media / polish (next25h tip 1–25): Finnhub all TFs + probe, quote SLA, What does not sync, commodity paper qty + oil/gas presets, PTR holdings/News, Markets master–detail, YouTube Worker, News From Owned + headline sync, ISA from holdings, smoke/axe expansion
- Sync / Markets polish (next25g tip 1–25): quote-cache sync, Sync prices now, From other device, prefs LWW, commodity Yahoo fallbacks, PTR no jump, mixed Unavailable CTA, Today movers age + lag chip, smoke/docs cadence 4s/30s
- Markets / portfolio (next25g 6–8): draggable section cards, commodity timeframe, Unavailable vs Fetching
- Markets **My Commodities** (Gold/Silver/Copper + aliases) via Yahoo → GBP; Finnhub key high-priority To Do reminder
- Recurring sort (due/paid/amount) · monthly total · date-stamped commentary CRUD; Todos → To Do's branding
- Fix: News Top 10 + By ticker via quote Worker; Markets heatmap reverted; USD not US$; Markets 24H/1W/1M/12M sparklines+%
- Fix: Weekly digest in-app Preview/Share on mobile (no Safari HTML download dead-end)
- Quality / ops (next25f 21–25): axe Crypto/Spending, digest smoke, aria-live windowing, docs
- Today / money / tax (next25f 16–20): editable digest highlights, auto chips, privacy mask, ISA/WTD
- Mobile / tablet UX (next25f 11–15): digest share modal, tablet preview rail, ↑↓ holdings, Spending sticky search, bottom-nav digest
- Markets / portfolio (next25f 6–10): weight sort, detail share, sticky totals, Owned weight, swipe NW
- Sync / security (next25f 1–5): share diagnostics, conflict Undo, offline Share error, privacy gate
- Quality / ops (next25e 21–25): lazy Settings, axe Equities/Tax/Todos, offline-queue smoke, windowed holdings, docs
- Today / money / tax (next25e 16–20): budget pulse, cash runway, Spending search, sell→Tax CTA, FIRE chip
- Mobile / tablet UX (next25e 11–15): master–detail, Today accordions, TradeModal sheet, Markets jumps, Jobs split
- Markets / portfolio (next25e 6–10): weight %, holdings search, Owned chip, detail sparkline, concentration
- Sync / security (next25e 1–5): sync chip long-press, What arrived, health blob age, passphrase rotate, conflict quick-resolve
- Quality / ops (next25d 21–25): Settings pin chips, /smoke lock+nav, Playwright Markets search, broker aliases, What’s new deep-links
- Today / money / tax (next25d 16–20): bills swipe paid, Spending log bill, Goals note from Today, Tax ISA stub, Compare as-of chips
- Mobile / tablet UX (next25d 11–15): Overview double-tap top, bill Mark paid, Jobs→Kanban deep-link, conflict FAB, OverflowMenu phone sheet
- Markets / portfolio (next25d 6–10): Markets search, yield sort, Use Markets price, corp-action date, FX Use suggested
- Sync / security (next25d 1–5): PIN modal disable, activity device filter, conflict copy, offline Retry now, passphrase 7d remember
- PR94: PWA shortcuts + theme-color; Face ID-first unlock (PIN fallback); phone sync-chip anti-overlap; customizable bottom-nav middle slots; Finnhub key how-to + provider health in Settings
- Quality / ops (next25c 21–25): What’s new archive, ErrorBoundary recovery, skip-link targets, /smoke Quote+Sync checks, weekly HTML digest download
- Today / money / tax (next25c 16–20): next-action stack, spending category sparklines, tax year progress ring, NW 7d/30d sparkline, Compare invite sheet
- Mobile / tablet UX (next25c 11–15): page transitions, Jobs pipeline mini-card, Todos NL quick-add, Settings split nav, PTR Today/Markets only
- Markets / valuations (next25c 6–10): Compact density, per-section refresh, corporate action notes, Add from holding, FX triangle check
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

1. **Add your free Finnhub API key** (Settings → Prices) — high priority for live equity quotes
2. Run `scripts/SYNC_SMOKE.md` after each deploy (todos + portfolios + Favourites + Markets)
3. Keep quote Worker live: `npm run deploy:quote` when Markets proxies stall (required for News after 1.2.66). Success must print Worker **`mydsp-quote`**, not `mydspv1`.
4. Hard-refresh / reopen PWA so update banner + new SW activate

## Low priority

- **Reintroduce Markets tag chips + Yield % sort** (Core / Speculative / Income / Other) — hidden in 1.2.75 via `SHOW_MARKETS_TAG_YIELD_CHIPS`; prefs + `ticker.tag` still persist
- Tune broker aliases from more real IBKR/T212/Coinbase exports
- Remittance-basis notes / deepen non-UK tax packs further
- Optional: dedicated `/commodities` holdings page (qty · cost · P&L) beyond Markets watchlist

## Parking lot

- Open banking (PSD2) — informational only in Settings today  
- OAuth identity — planned; passphrase sync remains primary  
- Live/WebSocket sync (current design is encrypted batch sync)  
- Achievement confetti  
- Full wash-sale / Form 8949 generation  
- Todo `recurring` flag — use Recurring transactions / Insights instead  
- Same-origin SPA+API `/api/quote` on Workers Builds (optional path already probed)
