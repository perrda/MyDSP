# MyDSP Development Roadmap

**Current version: 1.2.14**

## Completed (through v1.2.14)

- Markets / News / YouTube, Favourites nav, PIN/Face ID iOS polish
- Full section QA, empty states, overflow menus, live notification bell
- Settings Alerts (desktop banners + quiet hours + optional critical beep)
- Per-portfolio display currency + tax residency (Tax page + Settings)
- Encrypted sync + conflict handoff to Settings review UI
- Full backups, Compare, Jobs/Todos (board columns polished)
- Markets last-good quote cache + 7-day sparkline fixes
- Header Search icon redesign
- Paste trade CSV + IBKR / Trading 212 / Coinbase header detection
- Enhanced bank CSV wizard (mapping + income honesty + a11y)
- Smart Insights → Merchant Rules / Recurring wiring
- Compare / opening-wizard accessibility; fill prices from history
- Non-UK tax packs + US 8949/wash-sale informational stub
- Full financial PDF report; TaxPage `tax-pages` chunk split
- API webhook ping foundations; open-banking honesty section

## Next (manual / ongoing)

1. Cross-device sync smoke on phone + Mac after every deploy
2. Real IBKR/T212/Coinbase sample fixtures from your exports (tune aliases)
3. Remittance-basis notes for non-dom packs
4. Markets provider health monitoring

## Parking lot

- Open banking (PSD2) — informational only in Settings today  
- OAuth identity — planned; passphrase sync remains primary  
- Achievement confetti  
- Full wash-sale / Form 8949 generation  
- Todo `recurring` flag — use Recurring transactions / Insights instead  
