# MyDSP UI conventions

Data entry across MyDSP should match the **Jobs** section: dark surfaces, tight labeled fields, sectioned modals — never native browser prompts.

## Why this exists

Cursor agents (and future you) need a single source of truth for forms. The living examples are:

| Pattern | File |
|--------|------|
| Multi-section modal | `src/components/JobFormModal.tsx` |
| Compact list modal | `src/components/TodoListModal.tsx` |
| Task modal | `src/components/TodoModal.tsx` |

## Form recipe

- **Shell:** `fixed inset-0 bg-black/50` overlay + `surface rounded-xl` panel
- **Labels:** `text-xs text-text-subtle` above the control
- **Controls:** `px-3 py-2 bg-surface-hover border border-border rounded text-sm`
- **Layout:** `grid grid-cols-1 md:grid-cols-2 gap-4` under bold section titles
- **Actions:** Cancel (`btn-ghost`) + Save (`btn-primary`)

## Cursor rules & skills

| Path | Purpose |
|------|---------|
| `.cursor/rules/mydsp-ui.mdc` | Project rule (picked up by Cursor when editing matching files) |
| `.cursor/skills/mydsp-ui/SKILL.md` | Reusable skill agents can load for UI work |

These are committed (see `.gitignore` exceptions). To add another skill: create `.cursor/skills/<name>/SKILL.md` with `name` + `description` frontmatter.

You do **not** need a separate `memory.md` for styling — prefer rules/skills + this doc. Use agent memory only for personal preferences that should not live in the repo.
