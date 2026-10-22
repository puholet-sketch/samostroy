import { existsSync, readFileSync } from 'node:fs'
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

export default defineConfig({
  // GitHub Pages: /samostroy/ ; локально и preview: /
  base: process.env.GITHUB_PAGES === '1' ? '/samostroy/' : '/',
  plugins: [react(), localCrmSeedApi()],
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
