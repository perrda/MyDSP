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
  Sync Worker (if used):     see Settings → Cloud Sync / DEPLOY.md

  Deploy app:   npm run deploy
  Deploy sync:  npm run deploy:sync

  After deploy, smoke on iPhone:
    1. Hard-refresh / re-open PWA
    2. Sort grips on Crypto, header bell, Settings → Alerts
    3. Tax nav label matches residency
    4. Pull-to-refresh + Face ID lock
`)
process.exit(0)
