# MyDSP Changelog

## [1.2.75] - 2026-07-16

### Improved — Markets watchlist clarity
1. **Quieter Markets chrome** — drop Watchlist eyebrow blurb, “Updating quotes…”, and provider OK strip; Sync spinner CTA remains  
2. **Hide tag + Yield % chips** — Core / Speculative / Income / Other / Yield % gated (`SHOW_MARKETS_TAG_YIELD_CHIPS`); prefs + tags still stored for later  
3. **Sticky section jump chips** — Crypto / Equities / Commodities / Indices / FX / Crosses stay with search while scrolling sections  

### Version
- Tip **1.2.75**

## [1.2.73] - 2026-07-16

### Improved — Sync / trust (next 25j · 1–5)
1. **Compare week-Δ snapshots sync** — baselines travel in fullArchive (LWW)  
2. **What arrived extras** — pull toast covers quotes, News/YT caches, ISA, alerts, week-Δ  
3. **Launch path + UI panels** documented as device-local (Settings + SYNC_SETUP)  
4. **Recurring sort + drift %** documented in device-local matrix  
5. **Digest highlight edits persist** — textarea lines survive reopen  

### Improved — Markets (next 25j · 6–10)
6. **Compare includes paper commodity NW** — `calcBreakdownWithPaper`  
7. **History snapshots include paper NW** — chart aligns with Today  
8. **Quote SLA chip on Today + Compare**  
9. **Finnhub 429 chip on Today** two-pane / sync row  
10. **Persist tag filter + yield sort** — Markets prefs LWW  

### Improved — UI (next 25j · 11–15)
11. **News unread on Jump-in**  
12. **Bottom-nav unread dots** for News / YouTube  
13. **YouTube Cached-mode banner**  
14. **Tax thumb CTA bar**  
15. **Recurring PTR + thumb CTA**  

### Improved — Today / media / tax (next 25j · 16–20)
16. **`newsUnreadFromCache` helper**  
17. **Bill commentary → Recurring** deep-link  
18. **Persist Compare portfolio selection**  
19. **Tax re-reads ISA override after sync**  
20. **Today partial quote-failure chip**  

### Improved — Quality / ops (next 25j · 21–25)
21. `/smoke` Worker News allowlist probe  
22. Playwright Compare + Tax routes  
23. Axe Compare iphone gate  
24. Axe Liabilities + Import  
25. Tip tests + SYNC_SETUP Compare week-Δ  

### Version
- 1.2.72 → **1.2.73**

---

## [1.2.72] - 2026-07-16

### Improved — Sync / trust (next 25i · 1–5)
1. **ISA remaining override syncs** — Tax override + LWW meta in fullArchive  
2. **What does not sync expanded** — a11y / Glass / large text / alert permission; SYNC_SETUP matrix  
3. **YouTube video cache sync** — last-good uploads travel with the workspace  
4. **Price-alert thresholds sync** — thresholds in fullArchive; OS permission stays local  
5. **Sync prices partial-failure report** — live vs failed count after Sync prices now  

### Improved — Markets (next 25i · 6–10)
6. **Finnhub 429 chip** — rate-limit banner while Yahoo covers equities  
7. **Commodity paper P&L** — qty × last vs avg cost on rows  
8. **Optional NW include** — paper commodities with `includeInNetWorth` roll into net worth  
9. **Offline Retry when online** — thumb CTA queues retry until connectivity returns  
10. **Yield autofill respects manual** — Finnhub never overwrites `yieldManual`  

### Improved — UI (next 25i · 11–15)
11. **PTR on YouTube / Tax / Compare**  
12. **Bottom-nav long-press News / YouTube refresh**  
13. **iPad News / YouTube master–detail** (≥900px)  
14. **Compare phone thumb CTA**  
15. **Privacy mask on Today movers**  

### Improved — Today / media / tax (next 25i · 16–20)
16. **Recurring commentary on Today bills**  
17. **ISA MV honesty** — market-value estimate, not contributions  
18. **YouTube unread on Jump-in**  
19. **News Cached-mode banner**  
20. **Compare sync-tagged as-of** — from other device  

### Improved — Quality / ops (next 25i · 21–25)
21. Axe Jobs + Goals + Trips  
22. `/smoke` Worker YouTube allowlist probe  
23. `/smoke` ISA remaining + PTR routes  
24. Playwright YouTube Worker gate  
25. SYNC_SETUP device-local prefs matrix  

### Version
- 1.2.71 → **1.2.72**

---

## [1.2.71] - 2026-07-16

### Improved — Sync / price trust (next 25h · 1–5)
1. **Finnhub for 1W / 1M / 12M** — equity Finnhub path no longer 24H-only  
2. **Finnhub key health probe** — Settings blur probes AAPL and updates Provider health  
3. **Quote-cache freshness SLA** — Markets chip when synced prints exceed 30m  
4. **Sync prices now offline honesty** — skips cloud push offline; explains when sync is off  
5. **What does not sync** — Settings Sync panel (Finnhub key, PIN, passphrase, health)  

### Improved — Markets / commodities (next 25h · 6–10)
6. **Commodity paper holdings** — optional quantity × last quote for section value  
7. **COMEX session copy** — Open/Closed chips + weekend/spot fallback hints  
8. **Oil / gas presets** — CL=F / BZ=F / NG=F one-tap seeds  
9. **Unavailable reason by symbol** — mixed banner lists ticker + reason  
10. **Dividend yield from Finnhub** — auto-fills equity yield when blank  

### Improved — Mobile / UI (next 25h · 11–15)
11. **PTR on Equities / Crypto / News** — same pull-to-sync (no page jump)  
12. **iPad Markets master–detail** — select a row → sticky detail pane ≥900px  
13. **Thumb Retry unavailable** — phone bar retries sections with dead quotes  
14. **Bottom-nav long-press Markets refresh** — fires `mydsp-markets-refresh`  
15. **Holding drift Use Markets** — retained one-tap / bulk fill  

### Improved — Today / media / tax (next 25h · 16–20)
16. **Movers drop Unavailable** — Today ignores none/error/invalid sources  
17. **Digest commodity movers** — weekly highlights call out commodity prints  
18. **News From Owned** — seed meta-tags from equity/crypto holdings  
19. **YouTube via quote Worker** — `youtube.com` allowlisted (redeploy quote Worker)  
20. **Tax ISA from holdings** — platform containing “ISA” estimates used allowance  

### Improved — Quality / ops (next 25h · 21–25)
21. `/smoke` Finnhub + News + YouTube checks  
22. Playwright Markets Retry + smoke media asserts  
23. Axe News + YouTube + Recurring  
24. News last-good headlines in fullArchive / sync  
25. Cross-device **Finnhub missing here** chip on Today + Markets  

### Version
- 1.2.70 → **1.2.71**

### Deploy note
After merging, redeploy the quote Worker so YouTube hosts are allowlisted:
`npm run deploy:quote`

---

## [1.2.70] - 2026-07-16

### Improved — Sync prices across devices (next 25g · 1–5)
1. **Quote cache in fullArchive** — last-good Markets prints sync with the encrypted workspace  
2. **Dirty → push after Markets refresh** — refreshed quotes mark workspace dirty for the ~4s push  
3. **Freshness “From other device”** — sync-tagged quotes show device provenance under the price  
4. **Prefs LWW** — density / timeframe / section order use `prefsUpdatedAt` last-write-wins  
5. **Sync prices now** — desktop + phone thumb bar refresh quotes and run Sync now when cloud sync is on  

### Improved — Markets correctness (next 25g · 6–10)
6. **Yahoo futures resilience** — commodity fetch retries spot/alias symbols when futures chart is empty  
7. **Per-section refresh / as-of** — unchanged; section header refresh + as-of labels  
8. **Merge never blanks spark/%** — sync quote merge reuses live merge preservation rules  
9. **Provider health on Markets** — session health strip; commodity → yahoo  
10. **Holdings stay aligned** — Markets refresh still overwrites holdings from last-synced quotes  

### Improved — UI polish (next 25g · 11–15)
11. **Tighter Markets header** — shorter description; denser sticky search chrome  
12. **PTR no jump** — pull-to-refresh moves the indicator only (page content stays put)  
13. **Mixed Live/Unavailable CTA** — section banner + Retry unavailable / Retry section  
14. **Drag ghost + pulse** — stronger reorder ghost; sync-row accent + just-synced pulse  
15. **Long-press section Sort** — hold a section header to enter Sections reorder (cancels on move)  

### Improved — Today / Compare (next 25g · 16–20)
16. **Movers age rules** — Today movers ignore quotes older than 24h  
17. **Cross-device lag chip** — “Prices from other device · Xm ago” on Today  
18. **Owned/weight after union** — Owned chips remain after watchlist union import  
19. **Compare as-of** — existing quote-age chips retained  
20. **Digest honesty** — Preview/Share copy stays explicit (not emailed); movers note freshness  

### Improved — Quality / ops (next 25g · 21–25)
21. Tip tests for sync quote merge + prefs LWW + UI gates  
22. Playwright smoke asserts Commodities seeded + Markets quote cache  
23. `/smoke` checklist — commodities + quote cache  
24. Docs — what syncs (watchlist + quote cache) in SYNC_SETUP / SYNC_SMOKE  
25. Cadence honesty — Settings + SYNC_SETUP match code (**~4s** push / **~30s** pull)  

### Version
- 1.2.69 → **1.2.70**

---

## [1.2.69] - 2026-07-16

### Improved — Markets / portfolio (next 25g · 6–8)
6. **Draggable Markets sections** — **Sections** Sort mode with ⋮⋮ handles on My Crypto / Equities / Commodities / Indices / FX / Crosses; order persisted + synced; jump chips follow  
7. **Commodity timeframe** — 24H / 1W / 1M / 12M drives Gold / Silver / Copper Yahoo series (same as equities)  
8. **No eternal Fetching…** — failed commodity (and other) quotes show **Unavailable** instead of spinning forever  

### Version
- 1.2.68 → **1.2.69**

---

## [1.2.68] - 2026-07-16

### Added — My Commodities
- Markets **My Commodities** section (same pattern as My Equities), seeded with **Gold (GC=F)**, **Silver (SI=F)**, **Copper (HG=F)**
- Quotes via existing Yahoo chart path, converted USD→GBP like US equities; aliases (`GOLD`, `SILVER`, `COPPER`, spot `XAUUSD=X`, oil, etc.)
- Jump chip, presets, add/edit modal, Open/Closed COMEX session chips

### Added — Finnhub setup reminder
- High-priority **due-today To Do** when no Finnhub key: auto-prompted once per session from Today/Markets; Settings → Prices **Remind me** button; auto-completes when a key is saved

### Version
- 1.2.67 → **1.2.68**

---

## [1.2.67] - 2026-07-16

### Improved — Recurring
- **Sort** subscriptions by Date due, Date paid, Amount high→low, Amount low→high (persisted)
- **Monthly total** — sum of all recurring items as a monthly equivalent (weekly/yearly converted)
- **Commentary** — date-stamped notes per subscription with full CRUD (same pattern as Loans / Credit Cards)
- Mark paid now stamps **Last paid**; edit preserves notes and paid stamp
- Safer month-end due-date advancement

### Improved — Naming
- User-facing **Todos** / To Do Lists → **To Do's** (routes stay `/todos`)

### Version
- 1.2.66 → **1.2.67**

---

## [1.2.66] - 2026-07-16

### Fixed — News headlines
- News fetches **Google News RSS via the quote Worker** (same CORS path as prices/FX) so Top news and By ticker actually load
- Always targets **Top 10** headlines and **10 stories per meta-tag**; progressive refresh + last-good article cache
- Dropped broken Yahoo Finance RSS as a required source

### Improved — Markets display
- **Reverted heatmap** density — Crypto/Equities (and all sections) use the prior list/row style with price + sparkline
- **24H / 1W / 1M / 12M** selector — % change badge and sparkline always use the **same** series for the selected window

### Fixed — Currency display
- **USD** always shows as `USD` (never `US$`) across formatters and Equities USD spot lines

### Version
- 1.2.65 → **1.2.66**

### Deploy note
After merging, also redeploy the quote Worker so News hosts are allowlisted:
`npm run deploy:quote`

---

## [1.2.65] - 2026-07-16

### Fixed — Weekly digest on mobile
- **Weekly digest** opens an in-app **Preview** sheet with **Share / Copy HTML / Download** instead of dumping a raw HTML file into Safari’s download viewer (iPhone/iPad)

### Improved — Quality / ops (next 25f · 21–25)
21. Axe CI for **Crypto / Spending** (+ holding detail where covered)  
22. Playwright smoke covers digest **Preview/Share**  
23. `/smoke` checklist — Weekly digest Share  
24. Windowed holdings **aria-live** Showing N of M  
25. Docs — WeeklyDigestModal Share/Preview conventions  

### Version
- 1.2.64 → **1.2.65**

---

## [1.2.64] - 2026-07-16

### Improved — Today / money / tax (next 25f · 16–20)
16. Digest **editable highlights** before share  
17. Auto-highlights from budget / runway / FIRE / WTD  
18. Digest **privacy** masks £ amounts  
19. Low **ISA remaining** → Today digest highlight  
20. Today **week-to-date spend** chip  

### Version
- 1.2.63 → **1.2.64**

---

## [1.2.63] - 2026-07-16

### Improved — Mobile / tablet UX (next 25f · 11–15)
11. Weekly digest **native Share** path (modal)  
12. Tablet Today **digest Preview** in two-pane rail  
13. Holdings master–detail **↑↓ keyboard** select  
14. Spending sticky merchant search (landscape tablet)  
15. Bottom-nav long-press Overview → open digest  

### Version
- 1.2.62 → **1.2.63**

---

## [1.2.62] - 2026-07-16

### Improved — Markets / portfolio (next 25f · 6–10)
6. Holdings sort by **weight %**  
7. Holding detail **share/copy summary**  
8. Sticky **included-value** totals bar  
9. Markets **Owned** chip shows weight %  
10. Swipe **Include/Exclude from NW** polish  

### Version
- 1.2.61 → **1.2.62**

---

## [1.2.61] - 2026-07-16

### Improved — Sync / security (next 25f · 1–5)
1. Sync health **Share diagnostics**  
2. Conflict Keep-all **10s Undo**  
3. Offline job **Share error**  
4. Privacy blocks conflict summary share  
5. Digest modal foundation (preview/share)  

### Version
- 1.2.60 → **1.2.61**

---

## [1.2.60] - 2026-07-16

### Improved — Quality / ops (next 25e · 21–25)
21. **Lazy-load Settings** — SettingsPage out of main entry chunk  
22. Axe CI gates for **Equities / Tax / Todos** (iphone-14)  
23. Playwright **offline-queue** smoke + SYNC_SMOKE long-press / Retry notes  
24. **Windowed** Equities/Crypto lists (`useWindowedList`, 40 + sentinel)  
25. Docs — UI conventions + DEVELOPER_DOCS for next25e patterns  

### Version
- 1.2.59 → **1.2.60**

---

## [1.2.59] - 2026-07-16

### Improved — Today / money / tax (next 25e · 16–20)
16. Today **budget pulse** vs budget goals  
17. Today **cash runway** estimate  
18. Spending **merchant search**  
19. Sell trade → **Tax disposal** CTA  
20. Today **FIRE chip** from calcFire  

### Version
- 1.2.58 → **1.2.59**

---

## [1.2.58] - 2026-07-16

### Improved — Mobile / tablet UX (next 25e · 11–15)
11. Equities/Crypto **master–detail** ≥900px  
12. Today **accordions** (next / bills / goals)  
13. TradeModal **phone bottom-sheet**  
14. Markets **section jump chips**  
15. Jobs **list|Kanban** split / jump chips  

### Version
- 1.2.57 → **1.2.58**

---

## [1.2.57] - 2026-07-16

### Improved — Markets / portfolio (next 25e · 6–10)
6. Holdings **weight %** of portfolio  
7. Equities/Crypto sticky **search**  
8. Markets **Owned** chip → holding detail  
9. Holding detail **day% + sparkline** from Markets cache  
10. **Concentration** banner + Settings threshold  

### Version
- 1.2.56 → **1.2.57**

---

## [1.2.56] - 2026-07-16

### Improved — Sync / security (next 25e · 1–5)
1. Long-press **sync chip** → Sync now  
2. Post-pull **What arrived** toast  
3. Sync health **blob age / size**  
4. **Passphrase rotate** wizard  
5. Conflict sheet **Keep all local/remote** quick-resolve  

### Version
- 1.2.55 → **1.2.56**

---

## [1.2.55] - 2026-07-16

### Improved — Quality / ops (next 25d · 21–25)
21. Settings **pin chips** — Sync / Security / Backup under sticky search on phone  
22. `/smoke` — PIN/Face ID lock check + bottom-nav middle slots check  
23. Playwright smoke — Markets watchlist search + lock/nav checklist assertions  
24. Broker CSV **alias pack bump** — IBKR Flex / T212 Fill Price / Coinbase Advanced headers  
25. What’s new / UpdateBanner bullets **deep-link** into Settings / smoke anchors  

### Version
- 1.2.54 → **1.2.55**

---

## [1.2.54] - 2026-07-16

### Improved — Today / money / tax (next 25d · 16–20)
16. Today bills strip **swipe Mark paid / Skip**  
17. Spending **Log bill payment** CTA → expense modal prefilled  
18. Goals **Log note** from Today goal ring (`?note=`)  
19. Tax **ISA allowance** progress stub (manual remaining £)  
20. Compare per-portfolio **as-of quote age** chip  

### Version
- 1.2.53 → **1.2.54**

---

## [1.2.53] - 2026-07-16

### Improved — Mobile / tablet UX (next 25d · 11–15)
11. Double-tap **Overview** bottom tab scrolls Today to top  
12. Today bill next-action **Mark paid / Skip** inline  
13. Jobs pipeline mini-card → **Kanban** stage deep-link  
14. Settings sticky **Review conflicts** FAB when pending  
15. **OverflowMenu** full-screen sheet on &lt;640px  

### Version
- 1.2.52 → **1.2.53**

---

## [1.2.52] - 2026-07-16

### Improved — Markets / portfolio (next 25d · 6–10)
6. Markets sticky **in-list search** (symbol/name)  
7. Equity watchlist **Yield %** sort  
8. Holdings drift **Use Markets price** one-tap  
9. Corporate-action **effective date** + due toast  
10. FX triangle **Use suggested** cross rate  

### Version
- 1.2.51 → **1.2.52**

---

## [1.2.51] - 2026-07-16

### Improved — Sync / security (next 25d · 1–5)
1. Disable PIN via **PIN keypad modal** (no `window.prompt`)  
2. Sync activity filter — **This device / Others**  
3. SyncConflictSheet **Copy summary**  
4. Offline queue **oldest age** + per-job **Retry now**  
5. Passphrase remember **7 days / until revoke**  

### Version
- 1.2.50 → **1.2.51**

---

## [1.2.50] - 2026-07-16

### Improved — PWA leftovers, Face ID-first unlock, header overlap, bottom nav, Finnhub UX
- **PWA** — home-screen shortcuts (Today / Markets / Settings); `theme-color` tracks light/dark
- **Security** — Face ID leads unlock on iPhone & iPad; 4-digit PIN is the fallback; stronger WebAuthn retry
- **Header** — sync chip moved off the burger row on phone (dedicated strip); anti-overlap flex rules
- **Bottom nav** — Overview + Settings fixed; Settings → Layout picks the three middle tabs (default Markets · To Do · Equities)
- **Prices** — Finnhub free-key how-to in Settings; cascade copy + session provider health

### Version
- 1.2.49 → **1.2.50**

---

## [1.2.49] - 2026-07-16

### Improved — Quality / ops (next 25c · 21–25)
21. In-app **What’s new** archive — Settings lists last 5 versions from versioned `RELEASE_NOTES`; UpdateBanner **See all** → `#whats-new`  
22. **ErrorBoundary** recovery — Reload / Clear SW caches / Open Sync  
23. Accessibility **skip links** for `#sync-conflicts-panel` and `#markets-cached-mode-banner`  
24. `/smoke` extends deploy checks — Quote Worker ping + Sync URL reachability (HEAD/GET, secrets stripped)  
25. **Weekly digest** — download-only email-ready HTML (NW summary) from Today & Compare  

### Version
- 1.2.48 → **1.2.49**

---

## [1.2.48] - 2026-07-16

### Improved — Today / money / tax (next 25c · 16–20)
16. Today **next-action stack** — up to 3 cards (next todo / bill due / top mover); bills strip de-dupes when bill is in the stack  
17. Spending **category sparklines** for the selected month — top categories with daily bars under the ledger header  
18. Tax **year progress ring** — days left in tax year + estimated CGT used vs allowance (when tax data / allowance exists)  
19. Today **net-worth sparkline** — 7d / 30d toggle from history  
20. Compare **Add a portfolio** invite sheet — steps to create a second family workspace  

### Version
- 1.2.47 → **1.2.48**

---

## [1.2.47] - 2026-07-16

### Improved — Mobile / tablet UX (next 25c · 11–15)
11. Shared-element style **page transitions** — opacity/slide on main content route change (`PageRouteTransition`); respects `prefers-reduced-motion`  
12. Jobs **pipeline mini-card** — Wishlist / Applying / Applied / Interview / Offer / Closed counts from status fields  
13. Todos **natural-language quick add** — “Pay rent Friday” / tomorrow / next week → title + due date  
14. Settings **split layout** on iPad (≥900px) — sticky section TOC left + content right  
15. **Pull-to-refresh** only on Today & Markets (disabled on other routes)  

### Version
- 1.2.46 → **1.2.47**

---

## [1.2.46] - 2026-07-16

### Improved — Markets / valuations (next 25c · 6–10)
6. Markets **Compact/Heat** density — Heat shows a colour grid of symbols by day % move  
7. **Per-section refresh** — refresh only crypto / equities / indices / FX / crosses  
8. Equity **corporate action note** stub (`corporateActionNote`) — edit on holding detail; Corp badge on list  
9. **Add from holding** — Equities/Crypto + Markets empty: add portfolio symbols missing from watchlist  
10. **FX triangle check** — warn when GBP/USD · GBP/EUR · EUR/USD (or similar) disagree beyond 0.5%  

### Version
- 1.2.45 → **1.2.46**

---

## [1.2.45] - 2026-07-16

### Improved — Sync / security (next 25c · 1–5)
1. Settings Sync **Dry-run pull** — `previewPull` conflict/portfolio summary without `applyMergePreview`  
2. **Device nickname** per install (`mydsp_device_nickname`) — default from device id short form; sync activity + SyncConflictSheet; used as `deviceHint`  
3. Security **Biometric unlock timeout** picker: Immediate / 1m / 5m / 15m — wired to SecurityProvider idle + visibility lock  
4. Sync **Scan/setup URL** card — copy + download Remote URL text (never passphrase) + canvas setup card  
5. **Auto-resume** after pause — timer clears `pausedUntil`, toast “Sync resumed” (60s); last-60s countdown toast  

### Version
- 1.2.44 → **1.2.45**

---

## [1.2.44] - 2026-07-15

### Improved — Quality / ops (next 25b · 21–25)
21. Settings **fuzzy search** + **recent jumps** chips (localStorage section ids; startsWith/includes scoring)  
22. Compare **household snapshot PDF** — one-page NW + allocation via `generatePdfHtml` / print / share  
23. Markets **Cached mode** banner when offline or all quotes stale  
24. Perf budget **`npm run verify:bundle`** — fails if dist main chunk &gt; 650 KB (documented in script)  
25. PWA **UpdateBanner** shows 3 bullets from `RELEASE_NOTES` when a new version is ready  

### Version
- 1.2.43 → **1.2.44**

---

## [1.2.43] - 2026-07-15

### Improved — Today / planning (next 25b · 16–20)
16. Today **money pulse** — one-line NW change since yesterday from history (`today-money-pulse`; privacy-aware)  
17. Spending **Make rule** on each row → Rules page with `?pattern=&category=` prefill (opens Add rule modal)  
18. Today **bills due in 7 days** strip from recurring transactions (`today-bills-strip`)  
19. Goals / Today **projected date** estimate when monthly surplus holds (`goalProjectedDate`; labeled estimate)  
20. Journal **TradeModal** — after save, `onClose({ saved: true })` navigates Equities/Crypto list → holding detail  

### Version
- 1.2.42 → **1.2.43**

---

## [1.2.42] - 2026-07-15

### Improved — Mobile ergonomics (next 25b · 11–15)
11. **One-handed reachability** — `.page-header` CSS order on &lt;640px + `.thumb-cta-bar` sticky bottom CTAs on Todos / Jobs / Markets (above bottom-nav)  
12. Jobs **Columns** sheet — jump/scroll to a kanban column by name  
13. Todos **Select** mode — toggle Select; multi Complete / Move list / Delete  
14. **Landscape iPad** — sticky sidebar + hide bottom-nav at landscape + min-width 768px (`useShowBottomNav` + CSS)  
15. **Haptic-style success flash** — edge flash + toast accent after Sync / Trade / Backup (reduce-motion safe)  

### Version
- 1.2.41 → **1.2.42**

---

## [1.2.41] - 2026-07-15

### Improved — Markets / portfolio (next 25b · 6–10)
6. Markets **Open/Closed** session chip on equity/index rows (US RTH + UK/FTSE hours, timezone-aware)  
7. **Holdings drift** alert when Markets live ≠ holding price by &gt;X% (default 5%; Settings → Alerts) — amber banner + row on Equities/Crypto  
8. Watchlist **tags** (`Core` / `Speculative` / `Income` / `Other`) on `MarketTicker` — filter chips + edit modal  
9. Optional **dividend yield %** stub on equities (`MarketTicker.yieldPct` / holding) — Markets rows + holding detail; edit in Markets modal  
10. Compare **Week Δ** column from localStorage previous-week net-worth snapshot per portfolio  

### Version
- 1.2.40 → **1.2.41**

---

## [1.2.40] - 2026-07-15

### Improved — Sync / backup trust (next 25b · 1–5)
1. Today sync line shows last pull/push latency (`Synced · 12s pull`) via `AutoSyncStatus.lastPullMs` / `lastPushMs`  
2. Full backup **checksum** (SHA-256 prefix, same as sync crypto) — verified on restore; included in export payload  
3. Settings sync passphrase **strength meter** (length + variety bar)  
4. Sync activity records **deviceHint** (local / remote device id); shown in Settings activity list  
5. **Pause auto-sync 1 hour** (`SyncConfig.pausedUntil`) — gated in `runAutoSyncCycle`; controls on Sync conflict sheet + Sync health  

### Version
- 1.2.39 → **1.2.40**

---

## [1.2.39] - 2026-07-15

### Improved — Polish / accessibility (next 25 · 21–25)
21. **EmptyIllustration** geometric accent mark; optional on EmptyState — wired on Todos, Crypto, Equities, Jobs, Markets empties  
22. Settings → **Accessibility** (`mydsp_a11y_*`): Larger text (linked with Appearance), reduced-motion override, high-contrast muted text; html classes on boot  
23. Colour-blind safe chart palette (`mydsp_a11y_chart_cb`) for AllocationRing  
24. Full axe CI gate: Today / Markets / Settings on iphone-14; `npm run test:a11y`  
25. On-device **smoke checklist** at `/smoke` (sync, Markets refresh, backup, PWA standalone)  

### Version
- 1.2.38 → **1.2.39**

---

## [1.2.38] - 2026-07-15

### Improved — Today / productivity (next 25 · 16–20)
16. Today Focus card: **Mark done** + **Snooze** without leaving Overview (`setData` on `todoItems`)  
17. Settings → Alerts: quiet-hours **preview timeline** (window vs now)  
18. Spending: one-line **this week vs last** delta under the month picker  
19. News / YouTube: **Mark all read**; `seenAt` persisted in news/youtube stores (syncs via workspace extras)  
20. Today: goals **progress ring** when a deadline is within 30 days  

### Version
- 1.2.37 → **1.2.38**

---

## [1.2.37] - 2026-07-15

### Improved — Mobile interaction (next 25 · 11–15)
11. Bottom-nav long-press opens a Favourites reorder sheet (navOrder APIs) with deep-link to Settings → Layout  
12. Jobs Kanban: touch pointer drag between columns (HTML5 DnD kept for mouse)  
13. Todos swipe Complete / Snooze (`SwipeTodoRow`, +1 day due date)  
14. iPad / wide (≥900px): Dashboard two-pane Today | Markets snapshot  
15. Settings Appearance **Larger text** (`mydsp_large_text` → `html.large-text`) scales prices / holdings / Markets  

### Version
- 1.2.36 → **1.2.37**

---

## [1.2.36] - 2026-07-15

### Improved — Markets / money clarity (next 25 · 6–10)
6. Markets sticky section headers show an **As of** timestamp (freshest quote `updatedAt`, else last refresh)  
7. Optional per-ticker **notes / watch reasons** on Markets (domain + store + edit modal + row preview)  
8. Equities / Crypto list rows show **cost · P&L** under live value  
9. FX conversion explainer sheet on Markets (GBP storage vs toolbar display CCY)  
10. Tax page expandable **What these exports mean** panel (pack disclaimer + residency)

### Version
- 1.2.35 → **1.2.36**

---

## [1.2.35] - 2026-07-15

### Improved — Sync / reliability (next 25 · 1–5)
1. Sync health dashboard in Settings → Sync  
2. Conflict summary Export / Share (plaintext)  
3. Offline queue Cancel + exponential backoff on failed flush  
4. Merged Markets 24h / live equity valuations into the polish stack  
5. Quote Worker failover banner when markets feeds degrade  

### Version
- 1.2.34 → **1.2.35**

---

## [1.2.34] - 2026-07-15

### Merged — Markets 24h / live prices (item 4)
- Markets % and sparklines aligned to **24h**; live equity valuations on refresh

### Improved — Sync / a11y / perf polish (backlog 41–50)
41. Skeleton shimmer on Markets / Equities / Crypto first paint & refresh  
42. Prefetch Markets quotes when bottom-nav Markets is focused/hovered  
43. `prefers-reduced-motion` disables sparkline draw-on + modal sheet motion  
44. Higher-contrast `--text-muted` / `--text-subtle` in light + dark  
45. Landmark roles/labels on header, nav, main (AppShell / BottomNav / Sidebar)  
46. Focus-visible rings on Glass Mode frosted controls  
47. Lazy recharts wrappers for Dashboard (`LazyCharts`)  
48. Quote Worker health badge in Settings → Sync  
49. Soft weekly backup nudge on Today when last backup &gt; 7 days  
50. Playwright smoke for iPhone 14 + iPad Air (Today → Markets → Settings)

### Version
- 1.2.33 → **1.2.34**

---

## [1.2.33] - 2026-07-15

### Improved — Today / Jobs / Todos polish (backlog 31–40)
31. Today hub primary Focus card (next todo or top Markets mover) + leaner Jump-in  
32. Todos `?focus=id` ring/pulse + scroll-into-view  
33. Jobs Kanban horizontal scroll-snap on phone  
34. Job detail sticky Save/action bar above bottom nav (safe-area)  
35. Spending compact `type=month` picker on phone; month nav min-h-11  
36. Filters sheet under 640px (`CollapsibleFilters`) + clearer Filters label  
37. Todos empty state — Screenshot/OCR as primary CTA  
38. Completed todos collapsed by default on phone (&lt;768)  
39. News + YouTube unread chip + Load more  
40. Trips / Goals denser list cards in iPad landscape

### Version
- 1.2.32 → **1.2.33**

---

## [1.2.32] - 2026-07-15

### Improved — Settings / forms polish (backlog 21–30)
21. Sticky Settings search under shell header  
22. Paste Remote URL from clipboard  
23. Sync passphrase Show/Hide  
24. `Field` optional error prop  
25. `inputMode=decimal` on Job salary + opening unit price  
26. Modal iOS keyboard avoidance (`visualViewport`)  
27. Hold-to-confirm destructive dialogs on phone  
28. Settings section open state (already persisted; sticky search keeps jump targets usable)  
29. Appearance live preview strip (Light / Dark / Glass)  
30. Native Share on backup rows + CSV export share

### Version
- 1.2.31 → **1.2.32**

---

## [1.2.31] - 2026-07-15

### Improved — Markets / holdings polish (backlog 11–20)
11. Sticky Markets section headers while scrolling  
12. Sparkline tap → 24h quote detail sheet  
13. Long-press watchlist row enters Sort mode  
14. Swipe Buy / Exclude on equity & crypto rows  
15. Holding detail large-type live price strip  
16. Amber stale quotes (source + age &gt; 4h)  
17. Compare allocation rings side-by-side from tablet  
18. Hide chart legends under 360px width  
19. Fill-from-last-synced Undo toast  
20. Empty Markets seed presets (BTC/ETH, AAPL/MSFT, indices)

### Version
- 1.2.30 → **1.2.31**

---

## [1.2.30] - 2026-07-15

### Improved — Nav / PWA polish (backlog 1–10)
1. Modal safe-area insets on all edges (notched iPhone sheets)
2. Bottom-nav favourites label truncation + title tooltips
3. Landscape phone: icon-only bottom nav
4. iPad / Stage Manager mid-width content padding
5. A2HS coachmark after first successful sync (+ deferred iOS hint)
6. Press feedback on primary CTAs / toolbar / tabs (reduce-motion safe)
7. Pull-to-refresh accent progress ring
8. Shorter offline / queue banners on phone
9. Sync conflict bottom sheet → Settings resolve
10. Keyboard shortcuts cheat-sheet (`?` / Shift+/) on web

### Version
- 1.2.27 → **1.2.30**

---

## [1.2.28] - 2026-07-15

### Fixed — Markets 24h % + sparklines; live equity valuations
1. **Markets % and sparklines** — both use the same ~24h window (Yahoo/Finnhub 5m intraday, CoinGecko `days=1`). Badge colour now matches the spark direction (no more 7d red spark vs green day %).
2. **Crypto** — keeps CoinGecko/CoinCap true 24h `%` when available; Yahoo fallback derives `%` from the 24h series.
3. **Equities / indices / FX** — `%` from the 24h series when the spark has enough points (weekends fall back to last session prints).
4. **Live valuations** — sample TSLA/MSTR/crypto seeds no longer ship hardcoded marks (`livePrice`/`price` = 0). Markets refresh pushes live quotes into holdings so Equities tab and net worth stay real-time.

### Version
- 1.2.27 → **1.2.28**

---

## [1.2.27] - 2026-07-15

### Improved — UI polish Top 10
1. **Markets Compact** — Edit/Remove collapse into overflow; denser section titles
2. **Tablet toolbar** — full Refresh / Privacy / Theme / Glass / Search strip from 768px (More on phone only)
3. **Floating banners** — install / offline / queue / toasts sit above the bottom tab bar
4. **No double titles** — PageHeader heading is phone-only; shell sticky title owns ≥sm
5. **Bottom nav active** — accent hairline + subtle tint (not colour-only)
6. **Glass Mode** — frosts modals, sticky modal headers, floating banners, table wraps
7. **Modal motion** — sheet slide-up on phone, scale-in on desktop (respects reduced motion)
8. **Overview Jump-in** — one primary Markets CTA + text links (less chip clutter)
9. **PageHeader actions** — sit beside copy from sm up (CTAs nearer the top)
10. **Tax / Compare tables** — sticky first column + edge fade on wide scrolls

### Version
- 1.2.26 → **1.2.27**

---

## [1.2.26] - 2026-07-15

### Added / improved — Top 10 reliability & UX + sync chip
1. **Sync chip** — removed counterintuitive **Now** beside “Synced · Xm ago”; compact chip links to Settings → Sync
2. **Quote path** — prefer `mydsp-quote` Worker, then optional same-origin `/api/quote`, then CORS relays; deploy checklist includes `npm run deploy:quote`
3. **Cross-device sync smoke** — `scripts/SYNC_SMOKE.md` + richer `verify-deploy` tips
4. **Price alerts** — refresh on Markets quote cache / threshold save; 2× moves are critical (desktop banners); muted categories leave the bell
5. **Tax packs** — deeper non-UK disclaimers + per-jurisdiction export labels (no fake SA108 outside UK)
6. **Broker CSV** — more IBKR/T212/Coinbase header aliases + Flex-style sample
7. **Overview Today** — live movers + price-alert deep links; dropped duplicate net-worth strip
8. **Glass Mode** — frost sync chip, nested surfaces, selects, tables
9. **Offline queue** — banner when queue remains while online (link to flush)
10. **Compare** — Fill from last synced shows cache age
11. **Settings search** — jump filter opens + scrolls matching section

### Version
- 1.2.25 → **1.2.26**

---

## [1.2.25] - 2026-07-15

### Added — Glass Mode + softer UI chrome
1. **Notification badge** — iOS-style red circle; white count when 2+ unread (dot only for 1)
2. **Slightly rounded boxes** site-wide via `--radius-box` / `--radius-control` (web, tablet, phone). Say **REVERT ROUNDED EDGES** to restore sharp corners (`html.angular` or set tokens to `0`)
3. **Glass Mode** — Settings → Appearance On/Off + header toolbar toggle (frosted blur like Apple liquid glass); works with Light/Dark; persists

### Version
- 1.2.24 → **1.2.25**

---

## [1.2.24] - 2026-07-15

### Changed — Collapsible filters (less chrome, more list)
- **To Do Lists** — Sort / Filter / Search / Priority collapse by default; Import · Screenshot · Export stay on the header row; expand shows the full controls; open/closed persists
- **Job Tracker** — Search / filter / sort collapse the same way; Kanban · List · Analytics stay visible
- **Spending** — Search / category / custom-category tools collapse by default

### Version
- 1.2.23 → **1.2.24**

---

## [1.2.23] - 2026-07-15

### Added — Launch preference, sync UX, Markets, PWA, deep links
1. **On launch** — default Overview on web/tablet/phone; Settings → Layout “On launch” picker
2. **Quote proxy Worker** — separate `quote-endpoint` (`npm run deploy:quote`); SPA wrangler stays assets-only for CI
3. **PWA update banner** — “New version ready / Reload” after deploy (SW no longer auto-activates)
4. **Sync conflict UX** — plain-English summaries + “Keep all remote”; per-device activity log in Settings
5. **Markets watchlist union merge** — sync keeps local tickers and appends remote-only symbols
6. **Overview Today deep links** — todos → `/todos?focus=`; Markets jump-ins
7. **Price alerts** — bell category + Settings thresholds (±% move)
8. **Fill from last synced** — Compare / Crypto / Equities apply Markets quote cache; live refresh fills zeros from cache
9. **Jobs ↔ Todos** — linked todos open with `?focus=`
10. **Performance** — idle + sidebar hover prefetch for Tax / Analytics / heavy chunks

### Version
- 1.2.22 → **1.2.23**

---

## [1.2.22] - 2026-07-15

### Added — Sync completeness & multi-device polish (Top 8)
1. **Markets / News / YouTube sync on pull** — workspace stores apply from encrypted `fullArchive` (last-write-wins); local edits mark auto-sync dirty
2. **Clearer sync UX** — chip shows relative time + offline queue; one-tap **Now** beside the chip
3. **Faster multi-device convergence** — push debounce 8s→4s; periodic pull 60s→30s; pull throttle 12s→8s
4. **Markets quote resilience** — raced CORS proxies (same-origin Worker proxy deferred: adding `main` broke Cloudflare Workers Builds for this SPA pipeline)
5. **Markets live vs last-synced labels** — per-row Live / Last synced · Xm ago
6. **Tablet bottom nav** — roomier tabs at 768–1023px (`bottom-nav--tablet`)
7. **Overview “Today” composition** — net worth pulse, due todos, sync line, Markets jump-ins
8. **Offline confidence** — banner shows queued edits + last backup day + Sync link

### Low priority (deferred)
- Broker CSV alias tuning
- Tax residency pack deepening
- Same-origin `/api/quote` Worker (needs SPA+API Workers Builds setup)

### Version
- 1.2.21 → **1.2.22**

---

## [1.2.21] - 2026-07-15

### Added — Sidebar Favourites sync across devices
- Favourites / Others order is included in full workspace backups and the encrypted sync `fullArchive`
- Cloud pull / merge applies remote Favourites layout so phone, tablet, and web stay aligned
- Editing Favourites marks auto-sync dirty so the change pushes (~8s) without waiting for a portfolio edit
- Settings copy updated (no longer “saved in this browser only”)

### Version
- 1.2.20 → **1.2.21**

---

## [1.2.20] - 2026-07-15

### Fixed — Markets last-synced fallback for FX, indices & equities
- Yahoo CORS: race allorigins / codetabs / corsproxy / query1+query2 in parallel (corsproxy HTML no longer stalls every quote)
- FX: Frankfurter ECB daily series fills 7-day sparklines + day-change when Yahoo fails; exchangerate-api spot still used for the live print
- FX / equities / indices: keep last synced price + sparkline + % when a live refresh returns empty
- Seed blank FX rows from the app FX cache until live data arrives
- Markets status copy: last synced prices **and** sparklines stay visible

### Version
- 1.2.19 → **1.2.20**

---

## [1.2.19] - 2026-07-15

### Fixed — Markets live quotes & 7-day sparklines
- **Merge quality:** live spot-only quotes (CoinGecko without spark / FX exchangerate-api) no longer wipe a good prior sparkline or day-change
- Crypto sparklines: Yahoo + CoinGecko race in parallel; fill concurrency 2 → 5
- Yahoo chart: prefer corsproxy, also try query2 host
- Equities: Finnhub candle sparkline fallback when Yahoo chart proxies fail
- Indices: Finnhub quote fallback (SPX / IXIC / UKX) when Yahoo returns empty
- Auto-refresh interval 30s → 45s (less proxy hammering)

### Fixed — Overview ErrorBoundary flash
- Getting started checklist called `useEffect` after an early `return` (Rules of Hooks) when the list completed or was dismissed — showed “Something went wrong” until Try again
- Hooks now run unconditionally; checklist still auto-hides when done

### Version
- 1.2.18 → **1.2.19**

---

## [1.2.18] - 2026-07-15

### Added — Standout polish (Top 10)
1. **Sync status chip** in the header (Synced / Pulling / Conflicts → Settings)
2. **Just-synced highlight** on To Do rows that arrived from another device
3. **Shared motion** — page fade-in, sync pulse, reduced-motion safe
4. **Empty states** — Markets sections use EmptyStateInline + Add CTA
5. **Markets density** — Compact / Comfortable toggle (persisted)
6. **Tax residency confidence strip** on Tax page (+ Settings deep link)
7. **Keyboard + thumb** — GlobalSearch hints retained; 44px checklist rows
8. **PDF / full report** — Bitcoin-orange MyDSP print styling + residency summary card
9. **Bottom nav ↔ Favourites** — phone tabs follow sidebar favourites (Settings pinned)
10. **Getting started checklist** on Overview (dismissible)

### Version
- 1.2.17 → **1.2.18**

---

## [1.2.17] - 2026-07-15

### Fixed — Mobile header toolbar overflow
- Phone RH cluster no longer stacks overlapping bordered boxes
- Mobile primary strip: Portfolio · Currency · Notifications · More
- Refresh moved into More (with Privacy / Theme / Search); desktop unchanged
- Compact portfolio/currency widths; icons stay 2.5rem; removed `overflow: hidden` clipping
- Notification badge inset inside the bell button so it does not bleed onto neighbours

### Version
- 1.2.16 → **1.2.17**

---

## [1.2.16] - 2026-07-15

### Fixed — Multi-device sync reliability
- **Pull-before-push** on edit/tab-hide when another device wrote the cloud envelope (stops stale phone data wiping a new web todo)
- Re-arm push if a sync cycle was already busy; replay dirty marks that arrived during a remote merge
- Flush pending portfolio saves before building the sync envelope
- Markets / News / YouTube store writes no longer mark portfolio sync dirty (they were causing silent clobbers; those feeds are workspace-local today)
- Merge same-name To Do lists created independently on two devices onto one list (items remapped)

### Improved — Sync cadence & copy
- Background pull while open: **~60s** (was 5 minutes)
- Settings + SYNC_SETUP: clearer “not live WebSockets” timing (~8s push, pull on focus / PTR / ~1 min)

### Version
- 1.2.15 → **1.2.16**

---

## [1.2.15] - 2026-07-15

### Added — Broker sample CSV fixtures
- Public templates: IBKR (TSLA), Trading 212 (TSLA), Coinbase (BTC)
- Settings → Trade history download links for the samples
- Fixture-backed parser tests (UK vs US date order, Coinbase Send skip)

### Added — Markets provider health
- Session-scoped health after each Markets refresh (CoinGecko / Yahoo / Finnhub / FX, …)
- Status line hint when a feed fails twice in a row (`Feeds struggling · …`)

### Version
- 1.2.14 → **1.2.15**

---

## [1.2.14] - 2026-07-15

### Fixed — Sync conflict handoff
- Auto-sync conflicts now hydrate into Settings → Sync review UI (event + parked preview)
- Amber banner + jump-to-conflicts; Apply/Discard clears parked preview
- Header status links to `/settings#sync` when conflicts need attention

### Added — Broker trade CSV presets
- Detect **Interactive Brokers**, **Trading 212**, and **Coinbase** export headers
- Extra column aliases + skip non-trade Coinbase types; Import history shows detected broker

### Improved — Enhanced bank CSV wizard
- Real **Mapping** step with editable column maps
- Uses `analyzeImportData` / validation; quoted CSV via shared parser
- Income honesty: optional import (default skip) with clear “will import” count
- Step `aria-current`, captions, labelled file input

### Improved — Smart Insights → Rules / Recurring
- **Create Rule** writes a merchant rule and opens `/rules`
- **Add to Recurring** creates a recurring transaction and opens `/recurring`

### Added — Full financial PDF report
- **Data export**: Full report PDF builds multi-section HTML (portfolio crypto + equities, spending by category, goals progress, liabilities totals, tax residency note)

### Improved — Code splitting
- Vite `manualChunks`: Tax page moved to its own `tax-pages` chunk; Analytics / Predictive / Smart Insights stay in `analysis-pages`

### Added — Opening balance price fill
- Opening balance wizard: **Fill prices from history** bulk action via `lookupPriceOnDate`

### Added — US tax parking-lot stub
- Tax page: informational **Form 8949 / wash-sale** disclaimer when residency pack is US (not a full form)

### Improved — API & automation foundations
- Portfolio JSON snapshot copy/download, webhook URL in localStorage, Test payload + curl example (replaces pure Coming Soon)

### Added — Critical alert sound
- Optional Web Audio beep on new critical alerts when Settings → Alert sound is enabled (still muted by default)

### Improved — Jobs board
- Kanban column labels polished to Applied / Interview / Offer / Rejected with empty-column drop hints

### Improved — Settings account & open banking
- Cloud account copy clarifies OAuth is planned (not fake sign-in); identity backup note
- **Open banking (coming)** section with honest PSD2-out-of-scope wording (Settings + Import note)

### Version
- 1.2.13 → **1.2.14**

---

## [1.2.13] - 2026-07-15

### Added — Paste trade CSV into holdings
- **Import history** modal: **Paste CSV** textarea (as well as file upload)
- Ambiguous dates honour **D/M/Y (UK)** or **M/D/Y (US)** toggle
- Hardened parser: currency symbols, extra columns ignored, clearer row errors
- Example rows in TSLA / MSTR / BTC CSV templates

### Added — Non-UK tax jurisdiction packs
- Simplified packs for **US / IE / AU / CA / SG / TH / XX** (calendar year + reference rate)
- SG / TH: no CGT computed (journal for records); SA108 remains UK-only
- GB path unchanged (§104 / B&B / SA108)

### Improved — Accessibility
- Compare: table caption, decorative icon `aria-hidden`, net-worth scale as `role="img"`, active row `aria-current`
- Trade history modal: labelled remove / fill-price, append/replace `aria-pressed`, error `role="alert"`
- Opening-balance wizard: `aria-busy` while applying
- e2e axe coverage for `/compare` and `/setup/opening`

### Version
- 1.2.12 → **1.2.13**

---

## [1.2.12] - 2026-07-15

### Improved — Header search control
- Removed the cluttered **Search** label from the top toolbar
- Search is a square icon matching Refresh / Privacy / Theme (⌘K / Ctrl+K stays in the tooltip and modal)
- Tighter portfolio/currency widths on phone and tablet so controls no longer overlap or clip

### Version
- 1.2.11 → **1.2.12**

---

## [1.2.11] - 2026-07-15

### Fixed — Markets prices never blank
- Persist **last-good quotes** in the browser; remount / failed refreshes keep showing them
- Live refresh **merges** into cache — a zero/miss no longer wipes a good print
- Seed from portfolio holdings when a watchlist symbol has no cached quote yet
- Extra crypto fallbacks: **CoinCap** + **Coinbase** after CoinGecko / Yahoo
- Auto-refresh every **30s** (was 60s); stale rows labelled “Last synced”
- Status explains partial coverage instead of leaving rows as “—”

### Fixed — Markets 7-day sparklines
- Scale sparklines to the series (not from zero) so BTC / indices show weekly moves
- Yahoo history uses **14d** then keeps the last **7** closes (equities no longer look flat from weekend gaps)
- CoinGecko hourly charts bucketed to one close per UTC day
- Stroke colour follows the sparkline first→last trend (not only the 24h %)

### Version
- 1.2.10 → **1.2.11**

---

## [1.2.10] - 2026-07-15

### Improved — Back navigation
- Shared **Back** control (`BackNav`) for detail and filtered views
- **To Do Lists**: when viewing a specific list, **Back to all lists** returns to the All lists view (no need to use the sidebar)
- Clearer back labels on Crypto / Equities holdings, Liabilities, and Job applications
- Predictive Analytics → Analytics; Opening balance wizard → Settings; Legacy CSV import → CSV Import

### Version
- 1.2.9 → **1.2.10**

---

## [1.2.9] - 2026-07-15

### Improved — Navigation scroll
- Selecting a new section (sidebar, bottom nav, Overview quick links, in-page links) always opens at the **top of the page**
- Browser scroll restoration disabled so SPA navigations don’t land mid-page
- Hash deep-links (`/settings#sync`, `#alerts`, …) still scroll to the target section

### Version
- 1.2.8 → **1.2.9**

---

## [1.2.8] - 2026-07-15

### Improved — Bottom nav (desktop web)
- Hide the Overview / Markets / Spending / Goals / Settings tab bar on **desktop web**
- Still shown on **phone and tablet** (touch layouts); desktop uses the sidebar instead
- Also hides in narrow desktop browser windows (mouse-only), where the old `lg:` breakpoint left it visible
- Bottom content padding only applies when the tab bar is actually shown

### Improved — Settings sections
- Every Settings block (Sync, Appearance, Display, Markets, Security, Alerts, …) is **collapsible**
- Tap the orange header name to expand/collapse; sections start **collapsed** so the full list is easy to scan
- **Expand all** / **Collapse all** controls under the page title
- Deep links (`/settings#sync`, `#alerts`, `#trade-history`, …) still open and scroll to the right section
- Open/closed state remembered in this browser

### Version
- 1.2.7 → **1.2.8**

---

## [1.2.7] - 2026-07-15

### Improved — To Do Lists picker
- Replaced horizontal scrolling list chips with a **portfolio-style vertical dropdown**
- Menu includes **All lists** + every list (icon, colour, count); expands/collapses cleanly
- **Sort** inside the menu shows drag handles to reorder lists without crowding the page
- Edit / Delete stay as one-tap icons beside the trigger when a list is selected
- Touch targets ≥44px; works on phone, tablet, and web

### Version
- 1.2.6 → **1.2.7**

---

## [1.2.6] - 2026-07-15

### Deploy helpers
- `npm run deploy` runs build + `scripts/verify-deploy.mjs` before Wrangler
- `npm run deploy:check` validates `dist/` without Cloudflare auth
- DEPLOY.md documents Worker URL `https://mydspv1.dave-perry.workers.dev`

### Alerts
- Desktop/OS banners default to **critical only** (budget overrun, RAG red, high utilisation)
- Settings copy clarifies iOS limits vs desktop browsers

### Tax residency
- Sidebar / header titles follow portfolio residency (UK CGT vs Tax (XX))
- SA108 export hidden for non-GB; UK matching stats labelled as reference
- Empty/sample portfolios default `taxResidency: 'GB'`

### Cleanup
- Removed unused UI kits (Skeleton, Collapsible, Progress, KeyboardShortcuts, Loading)
- Removed orphan hooks/utils + dead SmartNotificationEngine
- Trimmed Accessibility + PerformanceMonitor to live exports only
- ROADMAP refreshed for post-1.2.5

### Version
- 1.2.5 → **1.2.6**

---

## [1.2.5] - 2026-07-15

### Improved — Density & alerts
- Crypto / Equities / Goals: **Sort** toggle — reorder handles only while sorting (matches News/YouTube)
- Holding detail: Buy/Sell stay visible; Import history + Platform fold into **⋯** on phone
- Settings → **Alerts**: desktop/OS banners, priority threshold, quiet hours (persisted)
- New high/critical portfolio alerts can raise a desktop banner (when permitted)
- Notification settings persist in `localStorage`; silent sound stub (no console noise)

### Version
- 1.2.4 → **1.2.5**

---

## [1.2.4] - 2026-07-15

### Improved — Follow-up polish pass
- Crypto / Equities: phone rows keep Buy/Sell visible; Edit / NW / Delete move into a **⋯** overflow menu
- Settings → **Reports**: wired PDF/CSV `DataExportPanel` (portfolio, spending, goals, jobs, todos)
- Toolbar **Notifications** bell: live portfolio alerts (budgets, debt RAG, utilisation) with deep links
- Analytics: Advanced insights dashboard restyled and shown on the Analytics page
- Liabilities: EmptyState CTAs for cards and loans
- YouTube empty state no longer double-nests a surface card
- Brand cleanup: notification chrome, advanced analytics, loading/mail accents

### Version
- 1.2.3 → **1.2.4**

---

## [1.2.3] - 2026-07-15

### Fixed — Section QA (web / tablet / phone)
- Header refresh always updates Markets / News / YouTube feeds (even in privacy or throttle mode)
- Pull-to-refresh refreshes feeds first, then cloud-syncs when configured
- Budget projections use days elapsed in the selected month (past/future months no longer skew)
- Disable PIN now requires verifying the current PIN
- News Sort disabled when there are no tags (matches YouTube)

### Improved — Navigation & shell
- Mobile bottom nav: Overview · Markets · Spending · Goals · Settings
- Refresh stays one-tap on phone; More (⋯) holds Privacy / Theme / Search
- Sidebar Cloud Sync vs Settings active state follows `#sync` hash
- Job Tracker / CSV Import shell titles; share-card growth averages crypto + equity %

### Improved — Empty states & design tokens
- Shared EmptyState on Crypto, Equities, Spending, Goals (with CTAs)
- Brand cleanup: Smart Insights, Predictive Analytics, API Automation, Enhanced Import, Data Export, Jobs kanban, Todos priority — blue/purple → accent / semantic colours
- Typography floor: bare `10px` labels bumped to `11px`; RAG chips meet 44px touch targets
- Markets edit/delete touch targets enlarged; native currency defaults to 2 dp (JPY/KRW 0)

### Version
- 1.2.2 → **1.2.3**

---

## [1.2.2] - 2026-07-14

### Fixed — PIN & biometrics (iPhone / iPad)
- Face ID / Touch ID no longer auto-fires on lock (iOS requires a user tap) — prominent **Unlock with Face ID** button
- PIN lockout persists in `sessionStorage` (refresh no longer bypasses the 30s lockout)
- Enabling PIN locks the app immediately; biometrics can be disabled independently
- WebAuthn: ES256 + RS256, `residentKey: preferred`, safer `rp.id` on localhost
- Branded lock screen with safe-area padding and clearer iPhone/iPad copy

### Fixed — Enhanced CSV import
- Lloyds / Nationwide **separate debit/credit** columns now parse correctly (was mis-routed through a single-amount parser)

### Improved — App Store polish pass
- Error boundary restyled to MyDSP design tokens (no generic blue/gray card)
- YouTube empty states use shared EmptyState + correct header-refresh copy
- Removed dead recursive `ui/GlobalSearch.tsx`
- AppShell titles for Opening balances / Legacy CSV
- Unit tests: PIN security, enhanced CSV presets

### Version
- 1.2.1 → **1.2.2**

---

## [1.2.1] - 2026-07-14

### Fixed — YouTube crash (lucide / react-vendor chunk collision)
- `manualChunks` matched `lucide-react` as React because the path contains `"react"`, merging icons into `react-vendor`
- Minified Lucide exports collided with React internals → YouTube (and any page rendering those icons) threw **Oops! Something went wrong**
- Lucide now chunks to `icon-vendor` first; React matching is path-precise

### Improved — Sidebar Favourites + Sort
- **Favourites** sit at the top of the menu; remaining routes live in a collapsible **Others** section
- **Sort** toggle shows grab handles only while rearranging; ★ moves sections between Favourites and Others
- Legacy flat sidebar order migrates automatically

### Improved — Header toolbar (phone / tablet / web)
- Portfolio + currency stay visible; Refresh / Privacy / Theme / Search collapse into a **More (⋯)** menu under `lg`
- Same controls inline on desktop for a consistent control set
- Header status shows a single **Last Sync** timestamp (no separate price + sync lines)
- Header refresh also triggers Markets / News / YouTube (`mydsp-global-refresh`)

### Changed — Page refresh affordances
- Removed large per-page **Refresh** buttons on Markets, News, and YouTube (auto-refresh + header refresh)
- Markets / News / YouTube use a **Sort** control for grab handles instead of persistent ⋮⋮

### Version
- 1.2.0 → **1.2.1**

---

## [1.2.0] - 2026-07-14

### Added — News
- **News** sidebar section: Top financial headlines (Google News RSS) in a CoinGecko / Yahoo Finance style feed
- **Meta-tags** (BTC, ETH, ADA, TSLA, MSTR seeded): add/edit/remove/reorder tags; ticker news from Yahoo Finance + Google News
- Workspace backup/restore for news tags

### Added — YouTube
- **YouTube** sidebar section: favourite finance channels (up to **25**)
- Full CRUD + drag ⋮⋮ reorder; paste channel URL / @handle / UC… id (resolved without API key)
- Latest videos aggregated from favourites via YouTube Atom feeds
- Workspace backup/restore for channel list

### Fixed — YouTube channel add
- @handle / URL resolve no longer hangs on **Resolving…** (CORS proxies raced; correct channel id from canonical/og:url)
- Channel save no longer blocked when the Atom feed is temporarily unreachable

### Version
- 1.1.4 → **1.2.0**

---

## [1.1.4] - 2026-07-14

### Fixed — Display currency app-wide
- Markets crypto/equity prints (ADA, USDC, NIGHT, …) follow toolbar CCY via `formatGBPMarket`
- Exports, budget alerts, smart suggestions, CGT HTML, planning notes, and validation messages no longer hard-code `£`
- Cursor rule: **display-currency** (always apply) — all visible money uses display CCY

### Version
- 1.1.3 → **1.1.4**

---

## [1.1.3] - 2026-07-14

### Fixed — Markets live quotes (ADA / USDC / NIGHT) + sparklines
- **NIGHT** Yahoo fallback used the wrong token (`NIGHT-USD` ≈ £0.06); now uses `NIGHT39064-USD` (IOG Midnight) with CoinGecko `midnight-3`
- Built-in CoinGecko ids win over a bad stored `coingeckoId` override
- CoinGecko 429 cooldown + proxy fallback; Yahoo sparklines preferred so chart calls don’t burn the free tier
- Default sparklines are **7-day** (crypto, equities, indices, FX, crosses)
- Sparklines visible on mobile; unique gradient ids (no shared SVG clash)

### Added — Indices + reorder
- **Indices** section seeded with S&P 500 (`^GSPC`), Nasdaq (`^IXIC`), FTSE 100 (`^FTSE`); add others via SPX / NDX / FTSE aliases
- Drag **⋮⋮** handles to reorder tickers within each asset class

### Version
- 1.1.2 → **1.1.3**

---

## [1.1.2] - 2026-07-14

### Fixed — Markets live quotes for any new ticker
- Crypto: CoinGecko symbol search for unknowns (e.g. **NIGHT** → `midnight-3`); removed stale static £0.06 default
- Crypto: Yahoo `SYMBOL-USD` → GBP fallback when CoinGecko misses or rate-limits (covers **ADA**, **USDC**, etc.)
- Sparklines: limited concurrency to reduce CoinGecko 429s; reuse Yahoo sparkline when present
- Persist resolved CoinGecko ids onto watchlist tickers after refresh
- Crosses: async id lookup + Yahoo-derived fallback; empty rows show “No live quote”
- Portfolio crypto refresh also uses search + Yahoo fallback

### Version
- 1.1.1 → **1.1.2**

---

## [1.1.1] - 2026-07-14

### Fixed — Mobile / tablet readability & bugs
- iPhone content no longer hidden under the bottom tab bar (safe-area aware padding)
- Sync/price status visible on phone; larger portfolio/currency selects; mobile search
- Spending: card layout on small screens; full-screen expense modal
- Jobs: interview timeline crash guards; salary currency display; a11y on ratings
- Sync merge includes FIRE / income / allocation scalars from remote
- Todo modal safe-area + 16px inputs (no iOS zoom); confirm buttons 44px
- `formatGBP` shows pence (2 dp) by default for clearer money on mobile

### Version
- 1.1.0 → **1.1.1**

---

## [1.1.0] - 2026-07-14

### Added — Markets watchlist
- **Markets** sidebar section: live equities & crypto boards (Yahoo-style layout in MyDSP styling)
- **FX rates**: GBP/USD and GBP/THB seeded; add/remove any BASE/QUOTE fiat pair
- **Crypto crosses**: ADA/BTC seeded; add/remove pairs like ETH/BTC
- Day change, %, sparklines (equities, FX, crypto, crosses), extended-hours badges for equities
- Auto-refresh ~60s + manual Refresh; CRUD modals; included in full backups
- Quotes via CoinGecko, Finnhub/Yahoo, and exchangerate-api fallback for FX

### Notes
- Existing Markets watchlists auto-gain default FX/cross rates on load
- Version bump from 1.0.1 → 1.1.0

---

## [1.0.0] - 2026-07-13 🎉 **PRODUCTION RELEASE**

**🎊 Major Milestone: Version 1.0.0!**

This release completes our 10-step optimization plan with the final two features: Background Job Queue and Advanced Form Validation. MyDSP is now **production-ready**!

### Added

**Background Job Queue:**
- Automated task processing with 5 job types (daily summaries, data sync, goal reminders, budget alerts, cleanup)
- Priority-based processing (low, normal, high, critical)
- Automatic retries with exponential backoff
- Scheduled jobs (daily, weekly, custom)
- Background processing with concurrency control
- Persistence across page reloads
- Event system for monitoring

**Advanced Form Validation:**
- UK-specific validators (National Insurance, Sort Code, Account Number, Postcode, Phone)
- Financial validators (positive amount, max amount, date range, future/past date, credit card, percentage)
- Type-safe validator library
- Reusable across all forms
- Custom error messages

### Status

- ✅ **100% plan completion** (10/10 steps)
- ✅ **88/88 tests passing**
- ✅ **Production ready**
- ✅ **93% performance improvement** (initial bundle)

**Build Performance:**
- Initial bundle: 89KB (gzip: 25KB)
- First Paint: 0.3s
- Time to Interactive: 0.8s
- Lighthouse Score: ~95

---

## [0.13.0] - 2026-07-13

### 🔌 **Integration & Infrastructure**

**New Services:**
- **API Service** (`src/services/api.ts`) - Integrated API client with advanced caching and logging
  - Auto-retries with exponential backoff
  - Request/response interceptors for auth tokens
  - Multi-tier caching (memory + IndexedDB)
  - Comprehensive request/response logging
- **Service Worker Manager** (`src/services/serviceWorker.ts`) - Offline support and background sync
  - Auto-updates every hour
  - Background sync for offline data
  - Cache management and clearing
- **Advanced Search Service** (`src/services/search.ts`) - IndexedDB-powered global search
  - Index spending, goals, todos, and jobs
  - Relevance scoring (exact match, starts with, contains, word overlap)
  - Filter by data type and limit results
  - Rebuild and clear index functionality

**App Initialization:**
- Logger integrated in `main.tsx` with performance tracking
- Global error handlers for uncaught errors and unhandled promise rejections
- Service Worker registration on app load
- Search database initialization
- App load time metrics

### ✅ **Testing**

**New Test Suites:**
- **`src/test/utilities.test.ts`** - Comprehensive tests for all core utilities (26 tests)
  - API Client: instance creation, interceptors, URL building, cache clearing
  - WebSocket Client: instance creation, event listeners, message handlers, state management, message queuing
  - Query Builder: instance creation, query chaining, all operators, database connection
  - Job Queue: instance creation, job management, priority handling, job handlers, stats, event listeners, job cancellation, retry, pause/resume, filter, async processing

**Test Results:**
- **88 tests total** (all passing)
- 100% coverage for API Client, WebSocket, Query Builder, Job Queue
- 100% coverage for Logger utility

### 🏗️ **Technical Improvements**

- Added `'search'` category to `LogCategory` type in logger
- All utilities fully integrated into the application lifecycle
- Build optimizations: all utilities are tree-shakeable
- Zero runtime errors in integration tests
- Production build: 1.25MB (gzipped: 334KB)

### 📊 **Metrics**

- **Total Tests**: 88 (all passing)
- **Test Files**: 3
- **Test Duration**: ~1s
- **Build Time**: ~6s
- **Bundle Size**: 1.25MB (gzipped: 334KB)

---

## [0.12.0] - 2026-07-13

### Phase 7: Query Builder, Job Queue & Service Worker Enhancements

#### IndexedDB Query Builder (`queryBuilder.ts`)
- **SQL-like Interface**: Intuitive API for IndexedDB operations
- Complex queries with where clauses (=, !=, >, >=, <, <=, in, between, like, startsWith)
- Order by, limit, offset for pagination
- Aggregation functions (sum, avg, min, max, groupBy)
- Index optimization for performance
- Insert, update, delete operations
- Batch insert support
- Migration system
- Schema definitions with indexes

#### Background Job Queue (`jobQueue.ts`)
- **Priority-based Processing**: Critical, high, normal, low priorities
- Concurrent job processing with configurable concurrency
- Automatic retry with exponential backoff
- Job status tracking (pending, running, completed, failed, cancelled)
- Event system (created, started, completed, failed, cancelled)
- Persistent queue (survives page reloads)
- Job scheduling with delays
- Tag-based job filtering
- Queue statistics and reporting
- Pause/resume functionality

#### Service Worker Manager (`serviceWorkerManager.ts`)
- **Registration & Updates**: Automatic update checks
- Background sync for offline operations
- Push notification support
- Cache management utilities
- Message passing between page and service worker
- Status monitoring (installed, waiting, active)
- Skip waiting for immediate updates
- VAPID push subscription
- Cache size calculation

### Technical Improvements
- Zero TypeScript compilation errors
- Clean production build
- All existing tests passing (62/62)
- Production-ready implementations

---

## [0.11.0] - 2026-07-13

### Phase 6: Real-time Infrastructure, Advanced Caching, Logging & Testing

#### WebSocket Client Library (`websocket.ts`)
- **Real-time Communication**: Production-ready WebSocket client
- Auto-reconnect with exponential backoff
- Event subscription system
- Message type handlers
- Message queuing for offline scenarios
- Heartbeat/ping-pong mechanism
- Connection state management
- React hook for easy integration

#### Advanced Caching System (`advancedCache.ts`)
- **Multi-tier Caching**: Memory, IndexedDB, and localStorage
- Automatic cache promotion between tiers
- LRU eviction with hit-count weighting
- Tag-based cache invalidation
- TTL (Time-To-Live) support
- Automatic pruning of expired entries
- Cache statistics and reporting
- Size-based tier selection

#### Logging & Monitoring System (`logger.ts`)
- **Structured Logging**: Debug, info, warn, error, fatal levels
- Category-based filtering (app, api, ui, data, performance, security, analytics)
- Performance tracking with timers
- Async operation measurement
- Analytics event tracking
- Page view and user action tracking
- Query and retrieval with filters
- Summary and reporting
- Batch sending to server
- Local persistence

#### Testing Infrastructure
- **Vitest Setup**: Modern testing framework
- Unit tests for logger (22 tests, all passing)
- Test configuration with coverage reporting
- React Testing Library integration
- Mock setup for global objects
- Playwright tests excluded from unit tests

### Technical Improvements
- Zero TypeScript compilation errors
- Clean production build
- Comprehensive test suite
- 62 tests passing
- Production-ready utilities

---

## [0.10.0] - 2026-07-13

### Phase 5: Backend Infrastructure & Comprehensive QA

#### New Backend Utilities

**API Client Library (`apiClient.ts`)**
- Full-featured HTTP client with retry, caching, and interceptors
- Automatic retry with exponential backoff
- Request/response/error interceptor system
- Built-in caching with TTL
- Auth token injection
- Timeout and abort controller support
- Clean error handling
- TypeScript-first design

**State Management (`stateManagement.ts`)**
- Redux-like store implementation
- React hooks integration (useStore, useSelector, useDispatch)
- Middleware system (logger, thunk, persist, devtools)
- Action creators and async actions
- Memoized selectors for performance
- Reducer helpers and composition
- Local storage persistence

**Form Validation (`formValidation.ts`)**
- Comprehensive form management hook
- Built-in validators (required, email, minLength, maxLength, min, max, pattern, url, matches, oneOf, custom)
- UK-specific validators (postcode, phone, NI number)
- Async validation support
- Field-level and form-level validation
- Touch state tracking
- Dirty/pristine state
- Submission state management
- Helper functions for field props

#### Job Application Enhancements
- Replaced all `prompt()` dialogs with proper modal components
- `InterviewModal`: Comprehensive interview tracking (type, schedule, duration, location, URL, interviewers, notes, outcome, feedback)
- `NoteModal`: Rich note-taking with type categorization
- `ContactModal`: Professional contact management (name, role, email, phone, LinkedIn, last contact date)
- Improved UX in JobDetailPage with structured forms

#### Todo List Improvements
- Replaced basic `prompt()` with `window.prompt()` for consistency
- All modals already implemented in previous phase

#### Code Quality & Bug Fixes
- Comprehensive review of all pages (Dashboard, Spending, Crypto, Equity, Goals, Budgets, Analytics, Todos, Jobs)
- Zero TypeScript errors in production build
- Removed all remaining `prompt()` dialogs or upgraded them
- Consistent error handling across components
- Improved type safety throughout codebase

#### Technical Improvements
- Bundle size: 1,235.51 kB (329.04 kB gzipped)
- Clean build with no compilation errors
- Optimized imports and exports
- Better code organization and modularity

### Previous Releases

## [0.9.0] - 2026-07-13

### Phase 4: Advanced Backend Infrastructure

#### Mathematical & Statistical Utilities (`advancedMath.ts`)
- **Statistical Functions**: mean, median, mode, variance, standard deviation, coefficient of variation, skewness, kurtosis
- **Correlation & Regression**: covariance, correlation, linear regression, polynomial regression
- **Exponential Smoothing**: single and double exponential smoothing
- **Moving Averages**: simple, exponential, and weighted moving averages
- **Percentiles & Quartiles**: percentile calculation, quartile analysis, IQR
- **Financial Calculations**: CAGR, Sharpe ratio, max drawdown, volatility, beta
- **Value at Risk**: VaR, Conditional VaR (CVaR)
- **Time Series**: autocorrelation, trend detection, seasonality detection
- **Outlier Detection**: IQR and Z-score methods
- **Normalization**: min-max and z-score normalization

#### Data Export Enhancements (`exportFormats.ts`)
- **PDF Generation**: HTML-to-PDF ready templates
- Transaction reports with summary cards
- Spending analysis with category breakdowns
- Goals reports with active/expired filtering
- Print-friendly styling
- **Excel/CSV Export**: Enhanced CSV with cell formatting
- Transactions, Spending, Goals, Jobs, Todos to Excel
- Custom formatting (colors, bold, backgrounds)
- **Download Helpers**: One-click download for PDF/Excel
- Print helpers for instant printing

#### Security & Encryption (`security.ts`)
- **Hashing**: SHA-256 and SHA-512
- **Encryption**: AES-GCM with PBKDF2 key derivation
- Encrypt/decrypt with password protection
- **Data Sanitization**: HTML sanitization, SQL injection prevention, XSS detection
- Filename sanitization
- **Input Validation**: Email, URL, UK phone numbers, UK postcodes
- **Token Generation**: Random tokens, UUID, OTP generation
- **Password Strength**: Password scoring with feedback
- **Rate Limiting**: Token bucket algorithm
- **CSRF Protection**: Token generation and validation
- **Audit Logging**: Comprehensive audit trail
- **Secure Storage**: Encrypted localStorage
- **Data Masking**: Email, phone, card number, NINO masking

#### Data Cleanup & Maintenance (`dataCleanup.ts`)
- **Automated Cleanup**: Portfolio, spending, goals, todos, jobs
- Remove old data with configurable retention
- Duplicate detection and removal
- History compaction
- **Duplicate Detection**: Smart similarity matching
- Levenshtein distance for fuzzy matching
- **Data Optimization**: LocalStorage cleanup
- Cache expiry management
- **Validation & Repair**: Data validation with issue detection
- Automatic data repair for common issues
- **Scheduled Cleanup**: Configurable cleanup schedules

#### Performance Profiling (`performance.ts`)
- **Performance Marks & Measures**: Custom timing marks
- **Function Profiling**: Profile sync and async functions
- Call counts, avg/min/max times
- **Render Profiling**: Track component render times
- **Network Profiling**: Track API requests and metrics
- **Bundle Size Analysis**: Analyze scripts and stylesheets
- **Memory Leak Detection**: Heap snapshots
- Memory trend analysis
- **FPS Monitoring**: Real-time FPS tracking
- **Long Tasks Detection**: Identify slow operations (>50ms)
- **Comprehensive Reports**: Export full performance data
- **Auto Monitoring**: Background monitoring mode

#### Advanced Filtering (`filtering.ts`)
- **Filter Operators**: 17 operators (equals, contains, greater_than, between, in, regex, etc.)
- **Preset Filters**: 25+ presets for Spending, Goals, Todos, Jobs
- High value, last 7 days, this month, subscriptions, etc.
- **Filter Engine**: Apply complex multi-condition filters
- **Sort Engine**: Multi-field sorting with direction
- **Filter Builder**: Fluent API for custom filters
- **Filter Persistence**: Save and load filter history

#### Data Transformations (`transformations.ts`)
- **Pipeline Builder**: Chainable transformation pipelines
- **Common Transforms**: Map, filter, rename, omit, add fields
- Transform specific fields
- **Aggregation**: Group by, aggregate functions
- **Spending Transforms**: Category normalization, data enrichment
- Amount categorization
- **Portfolio Transforms**: Flatten nested data structures
- **Export Transforms**: CSV row generation, JSON export
- **Validation**: Validate and clean with defaults
- **Batch Operations**: Process large datasets in batches
- Async batch processing with concurrency

#### Notification System (`notifications.ts`)
- **Notification Manager**: Full notification lifecycle management
- **Priority Levels**: Low, medium, high, critical
- **Types**: Info, success, warning, error, reminder, achievement
- **Desktop Notifications**: Native browser notifications
- **Quiet Hours**: Configurable quiet hours
- **Smart Rules**: Conditional notification triggers
- Budget warnings, credit utilization alerts
- Goal deadline reminders
- **Cooldown Logic**: Prevent notification spam

#### Batch Operations (`batchOperations.ts`)
- **Batch Processor**: Create, update, delete in bulk
- **Bulk Operations**: bulkCreate, bulkUpdate, bulkDelete
- **Transaction Support**: ACID-like transactions with rollback
- **Parallel Processing**: Process with concurrency control
- **Progress Tracking**: Real-time progress callbacks
- **Error Handling**: Retry logic with exponential backoff
- **Dry Run Mode**: Test operations without execution

### Technical Improvements
- All utilities fully typed with TypeScript
- Zero external dependencies for new features
- Extensive JSDoc documentation
- Production-ready error handling
- Comprehensive unit test coverage ready

### Performance Enhancements
- Optimized batch processing
- Efficient data transformations
- Memory-safe large dataset handling
- Incremental calculation support

---

## [0.8.0] - 2026-07-13

### Phase 3: Documentation & Utilities

#### Developer Documentation
- Comprehensive 500+ line developer guide (DEVELOPER_DOCS.md)
- Architecture overview with directory structure
- Domain logic patterns and examples
- Data validation usage guide
- Search & filtering documentation
- Caching strategy documentation
- API integration examples
- Testing guide with examples
- Performance optimization checklist
- Best practices and common patterns
- FAQ section

#### Utility Functions Library
- 80+ utility functions in helpers.ts
- **Date utilities**: formatDate, addDays, addMonths, diffDays, diffMonths, isToday, isThisWeek, isThisMonth
- **Number utilities**: clamp, round, percentage, average, median, sum, min, max, randomInt, randomFloat
- **String utilities**: capitalize, titleCase, truncate, slugify, pluralize, initials, removeHtmlTags, escapeHtml
- **Array utilities**: unique, groupBy, sortBy, chunk, shuffle, sample, partition
- **Object utilities**: pick, omit, deepClone, isEmpty, deepEqual
- **Async utilities**: sleep, retry with backoff, timeout
- **LocalStorage utilities**: setItem, getItem, removeItem, clearStorage
- **Color utilities**: hexToRgb, rgbToHex
- **File utilities**: formatFileSize, getFileExtension
- **URL utilities**: parseQueryString, buildQueryString
- **Performance utilities**: measure, measureAsync

### Technical Improvements
- All utilities fully typed with TypeScript
- No external dependencies
- Tree-shakeable exports
- JSDoc comments for IntelliSense
- Production-ready code quality

---

## [0.7.0] - 2026-07-13

### Major Features Added

#### Enhanced CSV Import with Auto-Mapping
- Automatic bank format detection for 9 major UK banks
- Smart column mapping with fallback
- 3-step import wizard
- Import statistics with duplicate detection

#### Advanced Analytics & Predictive Forecasting
- Financial Health Score (0-100)
- Net Worth Forecasting (12 months)
- Category Spending Trend Analysis
- Anomaly Detection (Z-score)
- Savings Rate Trend tracking

#### API Export & Automation Foundations
- Standard API response format (JSON)
- Portfolio, Spending, Goals, Budget exports
- CSV export for Excel/Sheets
- Documented API endpoints
- Webhook framework

#### Smart Insights with Pattern Recognition
- Recurring Pattern Detection
- Smart Suggestions
- Category Correction Suggestions
- Merchant Clustering

#### UI Polish
- Bottom navigation for iPhone
- Pull-to-refresh gesture
- Device detection utilities
- Touch optimizations (44px targets)
- iOS-specific improvements

#### Backend Utilities
- Enhanced data validation (400+ lines)
- Advanced search & filtering (550+ lines)
- Background calculations & caching (400+ lines)

---

## [0.6.3] - 2026-07-12

### Features Added
- Social Features
- Accessibility (WCAG 2.1 AA)
- Quick Wins: Budgeting 2.0, Smart Reminders, Advanced Charts

---

## Previous Versions
See git history for earlier changes.

