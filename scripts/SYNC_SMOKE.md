# Cross-device sync smoke (manual)

Run after every production deploy (`npm run deploy` + `npm run deploy:sync` if sync Worker changed).

## Prerequisites
- Two devices (e.g. Mac Safari/Chrome + iPhone PWA) on the **same** Remote URL + passphrase
- Automatic sync ON and Remember passphrase ON on both

## Checklist
1. **Portfolios** — rename active portfolio on device A → within ~30s device B shows the new name (or after pull-to-refresh / Settings → Sync now)
2. **Favourites** — reorder Favourites / Others on A → B matches after sync
3. **Markets watchlist + quotes** — add a ticker on A only → B keeps its own tickers **and** gains A’s (union merge). Refresh Markets on A → B shows last-good prices (freshness **From other device**) before B refreshes; Owned/weight chips still match holdings after union.
4. **Todos** — create a todo on A → appears on B; complete on B → done on A
5. **Jobs** — move a card between columns on A → B reflects status
6. **Conflicts** — if Conflicts chip appears, open Settings → Sync and resolve (Keep local / Keep remote / Keep all remote)
7. **Offline queue** — turn airplane mode on A, edit a todo, go online → banner/chip clears after flush; B receives the edit. On Settings → Sync you can also **Retry now** a deferred job or Cancel it.
8. **Quote Worker** — Markets live prints update (or “Last synced”) without CORS blank rows; `npm run deploy:quote` must print Worker name **`mydsp-quote`** (not `mydspv1`). Settings → Prices and `/smoke` Quote Worker identity check should pass.
9. **Long-press sync chip** — on phone, long-press the sync strip → Sync now + success flash (same as Settings → Sync now)
10. **What arrived** — after a successful pull, a toast summarizes new todos/jobs/goals when highlights exist
11. **News / YouTube cross-device** — refresh News on A (Yahoo headlines) → B shows last-good headlines before B refreshes; add a YouTube favourite on A → B gains the channel + cached videos after sync (upload-alert toggle stays per device)
12. **Bottom nav + filter prefs** — reorder middle bottom-nav tabs on A → B matches after sync; set Todos Due today and Jobs Needs follow-up on A → B shows the same quick filters

## Pass criteria
All steps succeed without clearing site data. If any fail, capture the Sync activity log (Settings → Devices / Sync) before retrying.
