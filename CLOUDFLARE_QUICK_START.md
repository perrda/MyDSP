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

## Data Storage

Currently: **Local Storage** (device-only)

To add cloud sync later:
1. Set up Cloudflare Workers
2. Add D1 database
3. Implement sync API
4. Update frontend to sync on changes

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
