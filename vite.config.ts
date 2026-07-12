/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// GitHub Pages project site lives at https://perrda.github.io/MyDSP/
const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/MyDSP/' : '/'

export default defineConfig({
  base: pagesBase,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BASE_PATH__: JSON.stringify(pagesBase),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
