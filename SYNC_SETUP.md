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

That’s it. Edits push a few seconds after you change data; opening the app or returning to the tab pulls newer cloud data.

---

## How automatic sync works

| Event | What happens |
|-------|----------------|
| You edit data | Debounced **push** (~8s after last change) |
| Open app / return to tab / come online | **Pull** if cloud is newer, then push if you have local changes |
| Every ~5 minutes while open | Background check |
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
