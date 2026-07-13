# QA Bug Hunt — v1.0.1

**Date:** 13 Jul 2026  
**Branch:** `cursor/full-qa-bugfix-0550`  
**Status:** ✅ Fixed, built, tested (92/92)

---

## Root cause of “Jobs doesn’t work”

Jobs (and Todos) **appeared** to work in-session but **never saved**.  
`toStorageShape()` omitted `jobApplications`, `todoLists`, and `todoItems`, so every reload wiped them.

That is why it looked like “no working functionality.”

---

## Fixes shipped

### Blockers
1. **Persist jobs & todos** in `toStorageShape` + normalize on load
2. **Empty-state Jobs create** — modal now mounts so “Add First Application” works
3. **Sync merge** includes jobs & todos

### Major
4. Replaced `window.prompt` for job **tasks** and **documents** with proper modals
5. Full edit via `JobFormModal` on detail page
6. Edit/delete for interviews, notes, contacts, tasks, documents
7. DataExportPanel uses `jobApplications` / `todoItems` (was broken empty export)
8. Global Search wired into header (⌘K) using live portfolio data
9. Sidebar links for Smart Insights + API & Automation
10. Kanban includes `accepted` / `archived`

### Tests added
- `src/test/persistence.test.ts` — round-trip + merge coverage for jobs/todos  
- **92 tests passing** (was 88)

---

## Still on backlog (not blockers)

1. **Encrypted cloud sync Worker setup** (highest priority product item)
2. Todo list rename/delete UI (create still works; uses prompt for list name)
3. Enhanced CSV import bank-preset wiring
4. Drag-and-drop kanban
5. Wire NotificationCenter / DataExportPanel into Settings pages

---

## How to verify on MacBook

```bash
cd /Users/davidperry/AI_Projects/MyDSP
git fetch origin
git checkout cursor/full-qa-bugfix-0550
git pull
npm install
npm run build
npm run preview
```

Then:
1. Open Jobs → **Add First Application** → save → **refresh page** → job still there ✅  
2. Open job detail → add interview/task/document via modals ✅  
3. Todos → create item → refresh → still there ✅  
4. ⌘K search finds holdings/jobs/todos ✅  
