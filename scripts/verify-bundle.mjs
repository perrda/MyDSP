#!/usr/bin/env node
/**
 * Perf budget: fail if the Vite main entry JS chunk exceeds the size limit.
 *
 * Limit (raw / uncompressed): MAX_MAIN_CHUNK_BYTES = 650_000 (≈ 650 KB)
 * Rationale: vite chunkSizeWarningLimit is 600 kB; allow a small headroom for
 * the entry chunk while keeping CI practical. Adjust deliberately if the app
 * grows — do not silently raise without a CHANGELOG note.
 *
 * Usage:
 *   npm run build && npm run verify:bundle
 *   node scripts/verify-bundle.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Documented size limit for the main entry chunk (bytes, uncompressed). */
export const MAX_MAIN_CHUNK_BYTES = 650_000

const root = process.cwd()
const dist = join(root, 'dist')
const assetsDir = join(dist, 'assets')
const indexHtml = join(dist, 'index.html')

function fail(msg) {
  console.error(`verify:bundle FAILED — ${msg}`)
  process.exit(1)
}

if (!existsSync(dist) || !existsSync(indexHtml)) {
  fail('Missing dist/ — run `npm run build` first')
}

const html = readFileSync(indexHtml, 'utf8')

/** Prefer the module script referenced from index.html (Vite entry). */
const scriptMatch = html.match(/src="([^"]*\/assets\/(index-[^"]+\.js))"/) ||
  html.match(/src="\.\/assets\/(index-[^"]+\.js)"/)

let mainName = null
if (scriptMatch) {
  mainName = scriptMatch[2] || scriptMatch[1].split('/').pop()
}

if (!mainName && existsSync(assetsDir)) {
  const candidates = readdirSync(assetsDir).filter(
    (f) => /^index-.*\.js$/.test(f) || /^main-.*\.js$/.test(f),
  )
  if (candidates.length === 1) mainName = candidates[0]
  else if (candidates.length > 1) {
    // Pick largest index/main chunk
    mainName = candidates
      .map((f) => ({ f, size: statSync(join(assetsDir, f)).size }))
      .sort((a, b) => b.size - a.size)[0].f
  }
}

if (!mainName) {
  fail('Could not locate main entry chunk (index-*.js) in dist/assets')
}

const mainPath = join(assetsDir, mainName)
if (!existsSync(mainPath)) {
  fail(`Main chunk missing: ${mainName}`)
}

const size = statSync(mainPath).size
const kb = (size / 1024).toFixed(1)
const limitKb = (MAX_MAIN_CHUNK_BYTES / 1024).toFixed(0)

console.log(`verify:bundle — main chunk ${mainName}`)
console.log(`  size:  ${size} bytes (${kb} KB)`)
console.log(`  limit: ${MAX_MAIN_CHUNK_BYTES} bytes (${limitKb} KB)`)

if (size > MAX_MAIN_CHUNK_BYTES) {
  fail(
    `Main chunk ${mainName} is ${kb} KB > ${limitKb} KB budget. ` +
      `Trim the entry bundle or raise MAX_MAIN_CHUNK_BYTES in scripts/verify-bundle.mjs with a changelog note.`,
  )
}

console.log('OK — within perf budget')
process.exit(0)
