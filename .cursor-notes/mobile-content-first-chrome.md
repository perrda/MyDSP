# Owner preference — mobile content-first chrome

Always apply (also encoded in `.cursor/rules/mobile-content-first-chrome.mdc`):

- Phone / short-landscape: **no fixed bottom create button bars** (New Task, New List, Add X, etc.).
- Screen real estate is for **information**, not stacked CTAs above bottom nav.
- Creates live in PageHeader (`PagePrimaryActions` / OverflowMenu), quick-add, or empty states.
- Full QA (`vitest` + `tsc`) on every PR that touches mobile chrome.
