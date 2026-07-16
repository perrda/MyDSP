#!/usr/bin/env node
/**
 * Pre-deploy checks for MyDSP (Cloudflare Workers static assets).
 * Usage: node scripts/verify-deploy.mjs
 * Does not require Wrangler auth — validates build artifacts + prints deploy steps.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dist = join(root, 'dist')
const index = join(dist, 'index.html')

const errors = []
const notes = []

if (!existsSync(join(root, 'wrangler.jsonc'))) {
  errors.push('Missing wrangler.jsonc')
}
if (!existsSync(dist) || !existsSync(index)) {
  errors.push('Missing dist/ — run `npm run build` first')
} else {
  const size = statSync(index).size
  if (size < 200) errors.push('dist/index.html looks empty')
  notes.push(`dist/index.html ${size} bytes`)
}

const favicon = join(root, 'public', 'favicon.svg')
if (!existsSync(favicon)) notes.push('Warning: public/favicon.svg missing')

const syncSmoke = join(root, 'scripts', 'SYNC_SMOKE.md')
if (!existsSync(syncSmoke)) notes.push('Warning: scripts/SYNC_SMOKE.md missing')

const quoteToml = join(root, 'quote-endpoint', 'wrangler.toml')
if (existsSync(quoteToml)) {
  notes.push('Quote Worker project present — deploy once with: npm run deploy:quote')
}

console.log(`MyDSP v${pkg.version} — deploy verify`)
for (const n of notes) console.log(`  · ${n}`)

if (errors.length) {
  console.error('\nFailed:')
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

console.log(`
OK — ready to deploy.

  Live Worker (production):  https://mydspv1.dave-perry.workers.dev
  Quote Worker (Markets):    https://mydsp-quote.dave-perry.workers.dev
  Sync Worker (if used):     see Settings → Cloud Sync / DEPLOY.md

  Deploy app:    npm run deploy
  Deploy sync:   npm run deploy:sync
  Deploy quote:  npm run deploy:quote

  After deploy:
    1. Hard-refresh / re-open PWA (update banner → Reload; See all → What’s new archive)
    2. Open /smoke — Quote Worker ping + Sync URL reachability should pass
    3. Cross-device sync smoke — see scripts/SYNC_SMOKE.md
    4. Markets live quotes + header sync chip (no “Now” next to “Synced · Xm ago”)
    5. Settings search → Sync / Alerts / Glass / What’s new
`)
process.exit(0)
