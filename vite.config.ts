/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

import { cloudflare } from "@cloudflare/vite-plugin";

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// GitHub Pages project site lives at https://perrda.github.io/MyDSP/
const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/MyDSP/' : '/'

export default defineConfig({
  base: pagesBase,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BASE_PATH__: JSON.stringify(pagesBase),
  },
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            if (id.includes('recharts')) {
              return 'chart-vendor'
            }
            if (id.includes('lucide-react')) {
              return 'icon-vendor'
            }
            return 'vendor'
          }
          
          // Page chunks
          if (id.includes('/pages/')) {
            if (id.includes('Dashboard') || id.includes('CryptoPage') || id.includes('EquitiesPage') || id.includes('LiabilitiesPage')) {
              return 'portfolio-pages'
            }
            if (id.includes('SpendingPage') || id.includes('JournalPage') || id.includes('BudgetsPage') || id.includes('RecurringPage')) {
              return 'transaction-pages'
            }
            if (id.includes('AnalyticsPage') || id.includes('PredictiveAnalyticsPage') || id.includes('SmartInsightsPage') || id.includes('TaxPage')) {
              return 'analysis-pages'
            }
            if (id.includes('GoalsPage') || id.includes('FirePage') || id.includes('PlanningPage') || id.includes('OptimizerPage')) {
              return 'planning-pages'
            }
            if (id.includes('TodosPage') || id.includes('JobsPage') || id.includes('ImportPage') || id.includes('EnhancedImportPage')) {
              return 'tools-pages'
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})