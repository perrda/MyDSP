# MyDSP sync endpoint (Cloudflare Worker)

Encrypted envelopes only — passphrase crypto stays in the browser.

**Full walkthrough:** [SYNC_SETUP.md](../SYNC_SETUP.md)

## Quick deploy (Dashboard)

1. Workers & Pages → open **`mydsp-sync`** if it exists, else **Create application** → **Worker** → name `mydsp-sync`.
2. Bind KV namespace as **`STORE`** (exact name).
3. Paste [`worker.js`](./worker.js) → Deploy.
4. **Required in production:** secret `SYNC_KEY` → append `?key=YOUR_SECRET` to the URL
   (without it, anyone who knows the Worker URL can overwrite your blob).
5. MyDSP → Settings → Sync → paste URL + passphrase → **Push**.

## Quick deploy (CLI)

```bash
cd sync-endpoint
npx wrangler login
npx wrangler kv namespace create mydsp-sync-kv
# Edit wrangler.toml — set id under [[kv_namespaces]]
npx wrangler secret put SYNC_KEY   # required for production
npx wrangler deploy
```

Remote URL example:

```text
https://mydsp-sync.<subdomain>.workers.dev?key=YOUR_SECRET
```

The Worker stores one JSON blob under KV key `envelope` (max ~25 MB).

### Optimistic concurrency (CAS)

Clients send `X-MyDSP-Base-ExportedAt: <last applied remote exportedAt>` on push.
If the stored envelope has a different `exportedAt`, the Worker returns **409** with current meta; the app pull-merges and retries once.

- `X-MyDSP-Force: 1` skips CAS (force overwrite — prefer pull-merge-push).
- Missing base header still accepts (legacy app builds).
- PUT body must be a valid MyDSP envelope (`app`, `v`, `exportedAt`, `deviceId`, `portfolios`, `blobs`).
