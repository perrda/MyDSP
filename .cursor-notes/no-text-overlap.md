# No text overlapping (remembered)

**User ask (2026-07-30):** Equities holdings list had ticker (TSLA/MSTR) overlapping Cost/P&L — very messy. Fix site-wide and prevent going forward; add to memory.

## Cause

`OverflowMenu` expands all items inline on `md+`, while Equities/Crypto rows used `md:flex-nowrap` with Buy/Sell leading buttons + NW/Edit/Delete. In master-detail the list column is narrow → columns crush → symbol paints over Cost/P&L.

## Fix (v1.2.110)

- `.holdings-list-row` CSS grid with clipped cells (`src/index.css`)
- Equities + Crypto rows use that grid; actions via `OverflowMenu compact` (Buy/Sell/NW/Edit/Delete in ⋯)
- Markets list `OverflowMenu` also `compact`
- Always-apply rule: `.cursor/rules/no-text-overlap.mdc`

## Going forward

Never ship dense list rows with nowrap flex + inline action clusters. Prefer grid + compact menus.
