# MyDSP sync endpoint (Cloudflare Worker)

Encrypted envelopes only — passphrase crypto stays in the browser.

**Origin-lock (1.2.127, repo only — deploy out of band):** browser `Origin` on the allowlist (`https://mydspv1.dave-perry.workers.dev`, `http://localhost:*` / `http://127.0.0.1:*`, `https://<anything>-mydspv1.dave-perry.workers.dev`) skips the client access key. CORS echoes that Origin (never `*`). Curl / missing Origin still needs the Worker access key. Do not wrangler from this PR.

**Full walkthrough:** [SYNC_SETUP.md](../SYNC_SETUP.md)

## Quick deploy (Dashboard)

1. Workers & Pages → open **`mydsp-sync`** if it exists, else **Create application** → **Worker** → name `mydsp-sync`.
2. Bind KV namespace as **`STORE`** (exact name).
3. Paste [`worker.js`](./worker.js) → Deploy.
4. Optional secret `SYNC_KEY` → append `?key=YOUR_SECRET` to the URL.
5. MyDSP → Settings → Sync → paste URL + passphrase → **Push**.

## Quick deploy (CLI)

```bash
cd sync-endpoint
npx wrangler login
npx wrangler kv namespace create mydsp-sync-kv
# Edit wrangler.toml — set id under [[kv_namespaces]]
npx wrangler secret put SYNC_KEY
npx wrangler deploy
```

Remote URL example:

```text
https://mydsp-sync.<subdomain>.workers.dev?key=YOUR_SECRET
```

The Worker stores one JSON blob under KV key `envelope` (max ~25 MB).
