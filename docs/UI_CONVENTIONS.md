# MyDSP UI conventions

Data entry across MyDSP should match the **Jobs** section: dark surfaces, tight labeled fields, sectioned modals — never native browser prompts or confirms.

## Why this exists

Cursor agents (and future you) need a single source of truth for forms. The living examples are:

| Pattern | File |
|--------|------|
| Multi-section modal | `src/components/JobFormModal.tsx` |
| Compact list modal | `src/components/TodoListModal.tsx` |
| Task modal | `src/components/TodoModal.tsx` |
| Destructive confirm | `ConfirmDialog` in `src/components/ui/Modal.tsx` |
| Screenshot → todos | `TodoScreenshotImportModal` + `domain/todoOcr.ts` |
| Phone thumb CTAs | `.thumb-cta-bar` in `index.css` (Todos / Jobs / Markets) |
| Success feedback | `utils/successFlash.ts` + `.success-haptic-flash` |
| Spending → Rules | `Make rule` link → `/rules?pattern=&category=` prefill |
| Today money pulse | `domain/moneyPulse.ts` NW Δ since yesterday |
| Today next-action stack | `domain/nextActionStack.ts` — todo / bill / mover (max 3) |
| Compare invite sheet | Compare → Add a portfolio modal → Settings `#portfolios` |
| Sync chip long-press | `SyncStatusChip` → `syncNow` + success flash |
| Holdings master–detail | Equities/Crypto ≥900px list + detail panel |
| Windowed holdings lists | `hooks/useWindowedList.ts` — first 40, sentinel loads more |
| TradeModal phone sheet | `TradeModal` + `Modal` `sheet` on &lt;640px |
| Sell → Tax disposal CTA | TradeModal toast → `/tax?disposal=1&symbol=` |
| Concentration banner | `domain/portfolioConcentration.ts` + Settings threshold |

## Form recipe

- **Shell:** `fixed inset-0 bg-black/50` overlay + `surface rounded-xl` panel (or shared `Modal`)
- **Labels:** `text-xs text-text-subtle` above the control (`Field` helper uses the same)
- **Controls:** `px-3 py-2 bg-surface-hover border border-border rounded text-sm`
- **Layout:** `grid grid-cols-1 md:grid-cols-2 gap-4` under bold section titles
- **Actions:** Cancel (`btn-ghost`) + Save (`btn-primary`)
- **Deletes / danger:** always `ConfirmDialog` — never `window.confirm`

## Cursor rules & skills

| Path | Purpose |
|------|---------|
| `.cursor/rules/mydsp-ui.mdc` | Project rule (picked up by Cursor when editing matching files) |
| `.cursor/skills/mydsp-ui/SKILL.md` | Reusable skill agents can load for UI work |

These are committed (see `.gitignore` exceptions). To add another skill: create `.cursor/skills/<name>/SKILL.md` with `name` + `description` frontmatter.

You do **not** need a separate `memory.md` for styling — prefer rules/skills + this doc. Use agent memory only for personal preferences that should not live in the repo.
