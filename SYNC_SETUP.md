# MyDSP encrypted sync — automatic multi-device (Cloudflare)

Your data stays **encrypted on your device**. Cloudflare only stores a locked blob.
Same **Remote URL** + same **passphrase** on every device.

**You do not need iCloud.** Automatic sync uses your Cloudflare Worker.

---

## What you need

- A free [Cloudflare](https://dash.cloudflare.com) account  
- MyDSP open on your main device (Mac/desktop recommended first)  
- A passphrase you’ll remember (min **8** characters)

Live app (either works):

- https://mydspv1.dave-perry.workers.dev  
- https://perrda.github.io/MyDSP/

---

## Part A — Deploy the sync Worker (once)

### Already have `mydsp-sync`?

If **Workers & Pages** already lists **`mydsp-sync`**, **do not create another one**.
Open it and jump to step **4** (KV binding) below.

### Option 1 — Cloudflare Dashboard (no CLI)

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Click **Create application** (blue button top-right).  
   Cloudflare no longer shows a separate “Create Worker” button.
3. Choose **Worker** (not Pages) → start from the default “Hello World” template if asked → name it **`mydsp-sync`** → **Deploy**.
4. Open **`mydsp-sync`** → **Settings** → **Bindings** → **Add** → **KV Namespace**.
5. Variable / binding name must be exactly: **`STORE`**  
   Create a new KV namespace (e.g. `mydsp-sync-kv`) if asked → **Save**.
6. Open **Edit code** / **Code** / **Quick edit**.
7. Replace the default script with the full contents of  
   [`sync-endpoint/worker.js`](./sync-endpoint/worker.js) from this repo → **Deploy**.
8. (Strongly recommended) **Settings** → **Variables and Secrets** → add secret:
   - Name: `SYNC_KEY`  
   - Value: a long random string (e.g. password manager)  
9. Copy your Worker URL from the overview (looks like  
   `https://mydsp-sync.<your-subdomain>.workers.dev`).  
   If you set `SYNC_KEY`, append it:  
   `https://mydsp-sync.<your-subdomain>.workers.dev?key=YOUR_SECRET`

### Option 2 — CLI

```bash
cd sync-endpoint
npx wrangler login
npx wrangler kv namespace create mydsp-sync-kv
# Put the returned id into wrangler.toml under [[kv_namespaces]] id = "..."
npx wrangler secret put SYNC_KEY
npx wrangler deploy
```

---

## Part B — Turn on automatic sync (each device)

1. Open MyDSP → **Settings** → **Encrypted cloud sync**.
2. Paste **Remote URL** (with `?key=` if used).
3. Enter your **passphrase**.
4. Enable:
   - **Automatic sync**
   - **Remember passphrase on this device** (required so sync works after you close the tab)
5. On the **first** device (source of truth): click **Push** or **Sync now**.
6. On **phone / iPad / other browsers**: same URL + passphrase + both toggles. Open the app — it **pulls automatically**.

That’s it. Edits push about **4 seconds** after you change data (and pull first if another device updated cloud). Opening the app, returning to the tab, pull-to-refresh, or about **every 30 seconds** while open pulls newer cloud data.

**What syncs:** portfolios + holdings, To Do's / Jobs, Favourites/nav layout (**LWW** by `updatedAt`), Bottom nav **middle slots**, Launch path, UI panel open/collapsed prefs, Settings section open/collapsed prefs, Markets tag/Yield chip visibility, Settings recent jumps, Tax year selection, Journal asset filter, Today NW spark window (7d/30d), API webhook URL, Achievements seen ids, Getting started dismissed, What arrived dismiss fingerprint, Todos **sort**, Jobs **viewMode + list sort**, Liabilities **RAG filter**, Monthly Review **month**, **Glass mode**, **Large text**, **Theme preference**, **Accessibility prefs**, **Notification settings** (quiet hours · desktop banners preference · sound · category toggles incl. YouTube uploads), Markets **watchlist** (union merge + **deletion tombstones**), Markets **last-good quote cache** (prices show on another device before it refreshes), News tags + collapsed/seenAt (**LWW** by `prefsUpdatedAt`) + **last-good headlines cache**, YouTube channels (**union** + seenAt LWW) + **video cache**, ISA remaining override (clearing syncs via empty remaining + meta), price-alert thresholds, Compare **week-Δ snapshots**, Digest **highlight edits**, Compare **selection**, Recurring **sort**, holdings **drift %**, portfolio **concentration %**, Spending **filters**, News **tag filter**, Todos **quick filter**, Jobs **filter** (incl. Needs follow-up), and full-backup extras.

**What does not sync:** Finnhub (and other live provider) API keys, PIN / Face ID credentials, remembered passphrase storage, session-only provider health counters, OS notification permission prompts. Enter the Finnhub key on each device (Settings → Prices).

### Device-local prefs matrix

| Pref / data | Syncs? | Notes |
|-------------|--------|--------|
| Portfolios, holdings, todos, jobs, goals | Yes | Core workspace blobs |
| Markets watchlist + last-good quotes | Yes | Union merge / deletion tombstones / LWW quotes |
| News tags + collapsed/seenAt + headlines | Yes | Tag union + prefsUpdatedAt LWW; headlines last-good |
| YouTube channels + video cache | Yes | Channel union + seenAt LWW |
| Favourites / Others nav layout | Yes | LWW by updatedAt |
| ISA remaining override | Yes | Tax page override (LWW; clear syncs) |
| Price-alert thresholds | Yes | OS notification permission stays per device |
| Digest highlight edits | Yes | LWW fullArchive |
| Compare selection | Yes | LWW fullArchive |
| Recurring sort preference | Yes | LWW fullArchive |
| Holdings drift % threshold | Yes | LWW fullArchive |
| Portfolio concentration % | Yes | LWW fullArchive |
| Spending filters | Yes | Query + category LWW |
| News tag filter | Yes | LWW fullArchive |
| Todos quick filter (Due today / High) | Yes | LWW fullArchive |
| Jobs filter (Needs follow-up chip) | Yes | LWW fullArchive |
| Bottom nav middle slots | Yes | LWW fullArchive |
| Launch path (on-open home) | Yes | LWW fullArchive |
| UI panel open / collapsed | Yes | LWW fullArchive |
| Settings section open / collapsed | Yes | LWW fullArchive |
| Markets tag + Yield % chips visibility | Yes | LWW fullArchive |
| Settings recent jumps | Yes | LWW fullArchive |
| Tax year selection | Yes | LWW fullArchive |
| Journal asset filter | Yes | LWW fullArchive |
| Today NW spark window (7d / 30d) | Yes | LWW fullArchive |
| API webhook URL | Yes | LWW fullArchive |
| Achievements seen ids | Yes | LWW fullArchive |
| Getting started dismissed | Yes | LWW fullArchive |
| What arrived dismiss fingerprint | Yes | LWW fullArchive |
| Todos sort | Yes | LWW fullArchive |
| Jobs viewMode + list sort | Yes | LWW fullArchive |
| Liabilities RAG filter | Yes | LWW fullArchive |
| Monthly Review month | Yes | LWW fullArchive |
| Glass mode | Yes | LWW fullArchive |
| Large text | Yes | LWW fullArchive |
| Theme preference (auto / light / dark) | Yes | LWW fullArchive |
| Accessibility prefs | Yes | Reduced motion · high contrast · chart CB LWW |
| Notification quiet hours | Yes | LWW fullArchive |
| Desktop banners preference | Yes | Preference syncs; OS permission stays per device |
| Sound toggle | Yes | LWW fullArchive |
| Category toggles (price alerts · YouTube uploads) | Yes | LWW fullArchive |
| OS notification permission | No | Browser / device prompt |
| Finnhub / provider API keys | No | Enter on each device |
| PIN / Face ID / unlock timeout | No | Security is device-local |
| Remembered sync passphrase | No | Stored only in that browser |
| Provider health counters | No | Session-only |

---

## How automatic sync works

| Event | What happens |
|-------|----------------|
| You edit data | Debounced **push** (~4s after last change) |
| Markets refresh / **Sync prices now** | Quote cache saved + workspace dirty → push (~4s); button also runs Sync now when cloud sync is on |
| **Pull down** on iPhone / iPad | Immediate **sync** (pull cloud, then push local) — page content stays put (indicator only) |
| Open app / return to tab / come online | **Pull** if cloud is newer, then push if you have local changes |
| Every ~30 seconds while open | Background check |
| Same item edited on two devices | By default **prefer cloud** on pull (toggle in Settings) |

Manual **Push** / **Pull & merge** remain available as overrides.

---

## Redeploy Worker (recommended)

If your Worker was deployed before automatic sync, paste the latest [`sync-endpoint/worker.js`](./sync-endpoint/worker.js) again and **Deploy**.  
The new script supports `?meta=1` for faster “is cloud newer?” checks (older workers still work).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Status: needs-passphrase | Enter passphrase + enable **Remember passphrase** |
| Test = 404 | Nothing pushed yet → **Push** from a device that has data |
| Test = 401 | `SYNC_KEY` and `?key=` must match |
| Phone still old | Confirm Automatic sync + Remember passphrase; open the app (or Sync now); hard-refresh PWA |
| Conflicts | Open Settings → resolve, or leave **Auto-resolve (prefer cloud)** on |

---

## Security notes

- Cloudflare never sees plaintext — only encrypted JSON.  
- **Remember passphrase** stores the passphrase in this browser’s localStorage. Use only on devices you trust.  
- Anyone with your Worker URL **and** passphrase (and `SYNC_KEY` if set) can pull.  

---

## Optional: no Cloudflare

**Settings → Download `.enc.json`** on one device → transfer file → **Import `.enc.json`** on another (same passphrase).
