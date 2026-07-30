# Resize-safe layouts (remembered)

**User ask (2026-07-30):** Resizing the browser on Equities left HOLDINGS / description crushed into one-word columns under Import / Fill / Sort / Weight % / Add. Must not happen on web, tablet, or mobile; all development going forward must stay resize-safe.

## Cause

Phone/mid-width `.page-header` sat in a row with `shrink-0` multi-button action clusters. Equities/Crypto had not migrated to `PagePrimaryActions`.

## Fix (v1.2.110+)

- `.page-header` stacks by default; side-by-side only ≥1024px with copy min-width
- Equities / Crypto / Compare / History → `PagePrimaryActions` (compact ⋯)
- Job detail hero uses `.page-header__*` + compact OverflowMenu
- Always-apply rule: `.cursor/rules/resize-safe-layouts.mdc`
