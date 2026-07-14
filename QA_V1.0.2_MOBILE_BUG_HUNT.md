# QA Bug Hunt — v1.1.1 (mobile / tablet / web)

**Date:** 2026-07-14  
**Branch:** `cursor/full-mobile-bug-hunt-0550`

## Scope
Full-app bug hunt focused on iPhone/iPad readability, touch targets, layout chrome, and high-severity functional bugs. Built on top of Markets **v1.1.0** (merged from main).

## Fixes shipped

### Shell & global (iPhone/iPad)
- Bottom content no longer clipped under BottomNav + home indicator (`app-content-with-bottom-nav`)
- Sync/price status line restored on mobile (was `display: none`)
- Removed duplicate page title in sticky header on phones (PageHeader remains)
- Portfolio/currency selects readable at 12px (was 9px)
- Global search available on mobile (toolbar icon + full-screen sheet)
- Bottom nav labels at 12px; toolbar icons 44px hit area
- Sidebar close control 44px
- `scrollbar-gutter` only from `sm+` (stops stealing width on phones)
- Mobile font floor for labels/eyebrows; 16px inputs include date/time types

### Spending
- Card list on `<sm` (no 720px horizontal scroll)
- Compact month controls; full-screen expense modal

### Dashboard
- Net worth / monthly span full width on xs for large GBP amounts
- Money displays use 2 decimal places by default (`formatGBP`)

### Jobs
- Interview timeline no longer crashes on missing `type` / `interviewers`
- Salary shown in native currency (no false GBP conversion)
- Rating stars have aria-labels + larger hit targets

### Sync
- Merge now carries remote `fireInputs`, income/expenses, allocations, split settings

### Todos
- TodoModal full-viewport on phone, safe-area, 16px inputs

### Misc
- Dead `ui/GlobalSearch` liability routes fixed (`card` not `cc`)
- Confirm dialog buttons min-height 44px

## Automated QA
| Check | Result |
|-------|--------|
| `npx tsc -b` | Pass |
| `npm test` | **149 / 149** pass (includes Markets) |
| Version | **1.1.1** (on top of Markets 1.1.0) |

## Manual checklist (device)
1. iPhone: open Overview — stats readable; scroll to bottom of Spending — last row clear of tab bar  
2. Pull-to-sync — status line under header updates  
3. Tap search icon — full-screen search works  
4. Spending — card list, add expense sheet fills screen  
5. Jobs — open application with interviews; salary shows stored currency correctly  
6. Markets still present from v1.1.0  

## Follow-ups (not in this PR)
- Wire Enhanced CSV bank presets (Lloyds/Nationwide)
- Wire DataExportPanel / NotificationCenter into Settings
- Crypto/Equities mobile overflow menus
