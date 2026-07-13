# MyDSP encrypted sync — simple setup (all devices)

Your data stays **encrypted on your device**. Cloudflare only stores a locked blob.
Same **Remote URL** + same **passphrase** on every device.

**Time:** about 10–15 minutes the first time.

---

## What you need

- A free [Cloudflare](https://dash.cloudflare.com) account  
- MyDSP open on your main device (Mac/desktop recommended first)  
- A passphrase you’ll remember (min **8** characters) — write it down once  

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

### Option 2 — CLI (if you prefer terminal)

```bash
cd sync-endpoint
npx wrangler login
npx wrangler kv namespace create mydsp-sync-kv
# Put the returned id into wrangler.toml under [[kv_namespaces]] id = "..."
npx wrangler secret put SYNC_KEY   # paste your secret when prompted
npx wrangler deploy
```

Then use the printed `*.workers.dev` URL + `?key=…` in MyDSP.

---

## Part B — First Push (desktop / source of truth)

1. Open MyDSP → **Settings** → scroll to **Encrypted cloud sync**.
2. **Remote URL** = the Worker URL from Part A (with `?key=` if used).
3. **Passphrase** = your sync password (same on every device).
4. Click **Test endpoint**  
   - Before any Push: **404** is normal (“empty store”).  
   - **401** = wrong `SYNC_KEY` / `?key=`.  
   - Network/CORS error = wrong URL or Worker not deployed.
5. Click **Push**. Wait for “Pushed…” success.
6. Click **Test endpoint** again — should be **200**.

---

## Part C — Each other device (phone / iPad / another browser)

1. Open the **same** MyDSP HTTPS URL in Safari (iOS) or Chrome.
2. (Optional) Share → **Add to Home Screen**.
3. **Settings → Encrypted cloud sync**.
4. Paste the **same Remote URL** and type the **same passphrase**.
5. Click **Pull & merge**.
6. If conflicts appear: pick **Keep local** / **Keep remote** (or Keep all…) → **Apply merge**.
7. Confirm your portfolios look right.

Repeat Part C on every device.

---

## Day-to-day habit

| You edited on… | Then do… |
|----------------|----------|
| Desktop | **Push** when finished |
| Phone | **Pull** first (get latest), edit, then **Push** |
| Both offline | Prefer one device as source → Push from there → Pull on others |

**Rules of thumb**

- Passphrase is **not saved** — re-enter when you open a new tab/session.  
- Last successful **Push** wins on the server.  
- Pull before editing if someone else may have pushed.  
- CV/PDF attachments sync when under size limits (2 MB each / 20 MB total).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test = 404 | Nothing pushed yet → **Push** from a device that has data |
| Test = 401 | `SYNC_KEY` and `?key=` must match exactly |
| Pull: wrong passphrase / decrypt error | Same passphrase as the device that Pushed |
| Pull: checksum mismatch | Push again from a good device; avoid editing the Worker store by hand |
| Phone has old data after Pull | Hard-refresh / close PWA and reopen; confirm URL is HTTPS (not localhost) |
| Offline Push | Queued in Settings → **Flush queue** when back online (passphrase still needed) |

---

## Security notes

- Cloudflare never sees plaintext — only encrypted JSON.  
- Anyone with your Worker URL **and** passphrase (and `SYNC_KEY` if set) can pull.  
- Keep `SYNC_KEY` and passphrase private; rotate by creating a new secret + Push.

---

## Optional: no Cloudflare

**Settings → Download `.enc.json`** on one device → transfer file → **Import `.enc.json`** on another (same passphrase). Same merge/conflict UI as Pull.
