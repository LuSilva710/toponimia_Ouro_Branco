import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/toponimia_Ouro_Branco/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        admin: 'admin.html',
        mapa: 'mapa.html',
        estatisticas: 'estatisticas.html',
        portal: 'portaleducativo.html',
        quiz: 'games/quiz.html',
        associacao: 'games/associacao.html',
        ranking: 'games/ranking.html',
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Toponímia Urbana de Ouro Branco',
        short_name: 'Toponímia OB',
        description: 'Dicionário de Ruas e Portal Educativo de Ouro Branco, MG',
        theme_color: '#1a1a2e',
        background_color: '#0f0f23',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            // Cache-first for static assets
            urlPattern: /\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            // Network-first for Supabase API
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 10
            }
          },
          {
            // Cache-first for CDN resources (Bootstrap, fonts)
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ]
})
