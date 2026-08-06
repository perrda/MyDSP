# Session handoff — MyDSP

**Last updated:** 2026-08-06  
**Sole build home:** `/Users/davidperry/AI_Projects/MyDSP`  
**Do not modify:** `/Users/davidperry/AI_Projects/FCC`

Paste into a new agent session: *“Continue MyDSP from SESSION_HANDOFF.md”*

---

## Current state

| Item | Value |
|------|--------|
| Version | **1.2.113** |
| Branch | `main` |
| Commits (local at handoff) | `d6629e9` v1.2.112 QA · `ec6d43c` v1.2.113 sync CAS |
| Push to origin | Confirm with `git status` / `git log origin/main..HEAD` — may still be unpushed |
| Tests | `npm test` → **904** pass (at handoff) |
| Build | `npm run build` + `tsc -b` clean |

---

## What shipped

### v1.2.112 — Full QA bug hunt
- Sync crypto: view-safe AES-GCM / PBKDF2 bytes
- Conflicts: portfolio-scoped keys; recurring / trips / merchant rules
- Markets: re-add wins over older tombstone
- Family merge: same-id remote LWW
- CGT + CSV: timezone-safe local dates
- Offline queue: max attempts + backoff
- Portfolio save: flush latest pending snapshot
- UX: shared Modal (Esc/trap), skip links, GlobalSearch dialog, digest SPA navigate, spending `?highlight=` preserve

### v1.2.113 — Sync trust Wave 1
- **CAS:** client sends `X-MyDSP-Base-ExportedAt`; Worker **409** if remote moved
- Auto-sync: one pull-merge then retry push on 409
- Worker validates MyDSP envelope shape before KV write
- `?meta=1` includes `encryptedBytes`
- `X-MyDSP-Force: 1` for intentional overwrite
- Shared rules: `src/services/sync/syncCas.ts` ↔ `sync-endpoint/worker.js`
- Docs: `SYNC_KEY` **required in production** (`SYNC_SETUP.md`, `sync-endpoint/README.md`)

---

## Ops still required (human)

1. **Redeploy sync Worker** so CAS is live:
   ```bash
   npm run deploy:sync
   # or paste latest sync-endpoint/worker.js in Cloudflare dashboard → Deploy
   ```
2. Confirm **`SYNC_KEY`** secret is set and Remote URL still has `?key=…`.
3. Optionally **push `main`** if commits are only local.

---

## Recommended sequence (next events)

| Priority | Wave | Version | Work |
|----------|------|---------|------|
| **Next** | 1.4 | **1.2.114** | Entity **delete tombstones** / `deletedAt` LWW for holdings, todos, jobs, spending, recurring (match Markets/News/YouTube) |
| After | 2 | 1.2.115 | Per-entity LWW by `updatedAt`; family conflict UI; Settings “what syncs” matrix |
| After | 3 | 1.2.116 | PIN lockout in localStorage; gate public CORS quote relays; shared offline flusher |
| After | 4 | 1.2.117 | Body-scroll lock refcount; GlobalSearch portal + focus trap |
| Later | 5–6 | — | Docs/README drift; Section 104 tests; CSV bank presets; product backlog |

**Do not** open CAS + entity tombstones in the same PR if avoidable — CAS is already landed; tombstones are the next isolated PR.

---

## Key files

| Area | Path |
|------|------|
| Project facts | `.cursor/rules/mydsp-project.mdc` |
| UI conventions | `docs/UI_CONVENTIONS.md` |
| Release notes (in-app) | `src/domain/releaseNotes.ts` |
| Changelog | `CHANGELOG.md` |
| Roadmap | `ROADMAP.md` |
| Sync client | `src/services/sync/syncService.ts`, `autoSyncService.ts`, `syncCas.ts`, `conflicts.ts`, `merge.ts` |
| Sync Worker | `sync-endpoint/worker.js` |
| Quote Worker | `quote-endpoint/worker.js` |
| Dev server | `http://localhost:5173` |

**Version bump rule:** +0.01 patch per release (e.g. 1.2.113 → 1.2.114). Many tip tests pin `package.json` version + `RELEASE_NOTES[0]` — update them when bumping.

---

## Suggested first message for next session

```text
Continue MyDSP from SESSION_HANDOFF.md.
Implement Wave 1.4 entity delete tombstones as v1.2.114.
Do not touch FCC. Run tests and build before calling it done.
```

---

## Delete this file?

Optional after the next successful wave lands — or keep and refresh the “Current state” table each handoff.
