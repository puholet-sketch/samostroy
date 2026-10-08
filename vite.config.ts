import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // GitHub Pages: /samostroy/ ; локально и preview: /
  base: process.env.GITHUB_PAGES === '1' ? '/samostroy/' : '/',
  plugins: [react()],
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
    // HMR websocket часто ломается за туннелями → белый экран у гостей
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
