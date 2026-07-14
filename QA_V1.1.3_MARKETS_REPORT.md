# QA — Markets v1.1.3

## Bugs confirmed
1. **NIGHT £0.06** — Yahoo `NIGHT-USD` is a different token; IOG Midnight is `NIGHT39064-USD` / CoinGecko `midnight-3`.
2. **ADA / USDC —** CoinGecko `simple/price` often 429’d after many `market_chart?days=1` calls; Yahoo fallback then failed or was wrong for NIGHT.
3. **Sparklines** — shared SVG gradient id + mobile `hidden sm:block` + 1-day charts.

## Fixes verified in unit tests
- [x] `resolveGeckoId('NIGHT')` → `midnight-3`; built-in wins over bad override
- [x] `yahooCryptoSymbol('NIGHT')` → `NIGHT39064-USD`
- [x] Yahoo fallback when CoinGecko batch empty (includes 7d sparkline)
- [x] Markets refresh fills ADA / USDC / NIGHT; persists coingecko ids
- [x] Indices seed `^GSPC` / `^IXIC` / `^FTSE`; alias normalize SPX→^GSPC
- [x] Reorder within crypto only
- [x] Full suite: 158 tests

## Manual checklist (post-deploy)
1. Hard refresh / clear SW if needed (Settings → or DevTools → Application → Unregister).
2. Markets → **Refresh** — ADA, USDC show live GBP; NIGHT ≈ £0.02 (not £0.06).
3. Sparklines show on phone and desktop (7-day shape).
4. **Indices** section lists S&P 500, Nasdaq, FTSE with points + %.
5. Drag ⋮⋮ within My Crypto to reorder; order persists after reload.
6. Add a new crypto (e.g. SOL) — quote + sparkline appear after save/refresh.
7. Add index alias `NDX` if removed — maps to `^IXIC`.
