# MyDSP sync endpoint (Cloudflare Worker)

Encrypted envelopes only — passphrase crypto stays in the browser.

**Full walkthrough:** [SYNC_SETUP.md](../SYNC_SETUP.md)

## Quick deploy (Dashboard)

1. Workers & Pages → open **`mydsp-sync`** if it exists, else **Create application** → **Worker** → name `mydsp-sync`.
2. Bind KV namespace as **`STORE`** (exact name).
3. Paste [`worker.js`](./worker.js) → Deploy.
4. **REQUIRED:** Set secret `SYNC_KEY` (Settings → Variables and Secrets → Add secret) → long random string.
5. MyDSP → Settings → Sync → paste URL with `?key=YOUR_SECRET` + passphrase → **Push**.

## Quick deploy (CLI)

```bash
cd sync-endpoint
npx wrangler login
npx wrangler kv namespace create mydsp-sync-kv
# Edit wrangler.toml — set id under [[kv_namespaces]]
npx wrangler secret put SYNC_KEY  # REQUIRED — enter a long random string
npx wrangler deploy
```

Remote URL example:

```text
https://mydsp-sync.<subdomain>.workers.dev?key=YOUR_SECRET
```

The Worker stores one JSON blob under KV key `envelope` (max ~25 MB).
