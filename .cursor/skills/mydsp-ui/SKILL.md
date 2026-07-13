---
name: mydsp-ui
description: Apply MyDSP Jobs-style form, modal, and data-entry UI patterns. Use when building or restyling create/edit flows, filters, or empty states in MyDSP.
---

# MyDSP UI skill

## When to use

- Adding or redesigning any create/edit form in MyDSP
- Replacing browser `prompt()` / `confirm()` for structured data entry
- Keeping Todos, Jobs, Goals, Settings, etc. visually consistent

## Canonical reference

Copy structure and classes from:

- `src/components/JobFormModal.tsx` — multi-section modal (gold standard)
- `src/components/TodoListModal.tsx` — compact create/edit modal
- `src/components/TodoModal.tsx` — task modal aligned with Jobs
- `src/pages/JobsPage.tsx` — page chrome + empty state opening a modal

## Checklist

1. Custom modal (not `window.prompt`)
2. Sticky header with title + close
3. Section headings + 1–2 column grid
4. `text-xs text-text-subtle` labels above fields
5. Shared input classes: `bg-surface-hover border border-border rounded text-sm`
6. Cancel / primary save footer
7. Empty states call the same modal opener (no alternate input path)

## Adding more Cursor skills later

1. Create `.cursor/skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`).
2. Keep `.cursor/rules/*.mdc` for always-on or glob-scoped project rules.
3. Ensure `.gitignore` allows `.cursor/rules/**` and `.cursor/skills/**` so skills travel with the repo.
4. Optional: link the skill from `docs/UI_CONVENTIONS.md` for humans.

## Related docs

See `docs/UI_CONVENTIONS.md` for the human-readable design notes.
