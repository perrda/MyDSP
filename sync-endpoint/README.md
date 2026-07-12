# MyDSP sync endpoint (Cloudflare Worker)

GitHub Pages hosts the PWA. Sync needs a separate HTTPS URL that accepts JSON PUT/GET.

## Quick deploy (Cloudflare)

1. Create a Worker named `mydsp-sync` and a KV namespace bound as `STORE`.
2. Paste `worker.js` as the Worker script.
3. Deploy, copy the `*.workers.dev` URL.
4. In MyDSP → Settings → Sync, set Remote URL to that URL (optionally append `?key=YOUR_SECRET` and set the same secret in Worker env `SYNC_KEY`).

The Worker stores one encrypted envelope under key `envelope`. Passphrase encryption stays in the browser — the Worker only sees ciphertext JSON.
