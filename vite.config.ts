import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const crmJson = fileURLToPath(new URL('./data/clients_from_crm.json', import.meta.url))

/** Dev-only: отдать локальный CRM-импорт без попадания в prod-бандл */
function localCrmSeedApi(): Plugin {
  return {
    name: 'local-crm-seed-api',
    configureServer(server) {
      server.middlewares.use('/api/local-crm-seed', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (!existsSync(crmJson)) {
          res.end('[]')
          return
        }
        res.end(readFileSync(crmJson, 'utf8'))
      })
    },
  }
}

/**
 * GitHub Pages: missing deep routes (/control, /calculator, …) must serve the SPA.
 * Copy index.html → 404.html so Pages returns the app shell; React Router keeps the URL.
 */
function spaGithubPagesFallback(): Plugin {
  return {
    name: 'spa-github-pages-fallback',
    closeBundle() {
      const outDir = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
      const indexHtml = join(outDir, 'index.html')
      if (!existsSync(indexHtml)) return
      copyFileSync(indexHtml, join(outDir, '404.html'))
      writeFileSync(join(outDir, '.nojekyll'), '')
    },
  }
}

export default defineConfig({
  // GitHub Pages: /samostroy/ ; локально и preview: /
  base: process.env.GITHUB_PAGES === '1' ? '/samostroy/' : '/',
  plugins: [react(), localCrmSeedApi(), spaGithubPagesFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    host: true,
    allowedHosts: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5174,
      clientPort: 5174,
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
})
