import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Safe City — Centro Floripa',
        short_name: 'Safe City',
        description: 'Alertas comunitários anônimos para o Centro de Florianópolis',
        theme_color: '#0c0e14',
        background_color: '#0c0e14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i, handler: 'CacheFirst', options: { cacheName: 'osm-tiles', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } } },
          { urlPattern: /\/api\/reports\/active/, handler: 'NetworkFirst', options: { cacheName: 'active-reports' } },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
