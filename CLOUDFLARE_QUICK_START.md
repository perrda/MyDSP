# Cloudflare Pages Deployment - Quick Reference

## One-Command Deploy

```bash
# Build locally first (optional)
npm run build

# Deploy to Cloudflare Pages (via dashboard)
# OR use Wrangler CLI:
npx wrangler pages deploy dist
```

## Cloudflare Pages Configuration

```yaml
Project name: mydsp
Production branch: main
Framework: Vite
Build command: npm run build
Build output: dist
Node version: 20
```

## Access Your App

After deployment:
- **Production:** https://mydsp.pages.dev
- **Preview (PR):** https://<commit>.mydsp.pages.dev
- **Custom Domain:** https://yourdomain.com (optional)

## Install as App

### iPad/iPhone:
1. Open in Safari
2. Tap Share → Add to Home Screen

### Desktop:
1. Click install icon in address bar (Chrome/Edge)

## Data Storage & Sync

- **Local:** portfolios live in the browser (localStorage + IndexedDB for file blobs).
- **Cross-device:** encrypted sync via a small Cloudflare Worker + KV (not D1).

**Setup guide:** [SYNC_SETUP.md](./SYNC_SETUP.md) (step-by-step, ~10 minutes).

Quick version:

1. Deploy `sync-endpoint/worker.js` with KV binding `STORE`.
2. MyDSP → Settings → Encrypted cloud sync → Remote URL + passphrase.
3. **Push** on desktop → **Pull & merge** on phone / iPad.

## Environment Variables

Optional for Cloudflare Pages:

```bash
NODE_VERSION=20
VITE_API_URL=https://api.yourdomain.com  # For future backend
```

## Automatic Deployments

✅ Push to `main` → Auto-deploy to production  
✅ Open PR → Auto-deploy preview  
✅ Merge PR → Auto-deploy production

## Troubleshooting

**Build fails:**
- Check `npm run build` works locally
- Verify Node version (20)

**Blank page:**
- Check browser console for errors
- Verify base path in `vite.config.ts`

**Routing issues:**
- Cloudflare Pages auto-handles SPA routing
- No additional config needed

## Support

- Cloudflare Docs: https://developers.cloudflare.com/pages
- MyDSP Docs: See `DEPLOYMENT_GUIDE.md`
