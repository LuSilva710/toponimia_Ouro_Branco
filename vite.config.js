import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/toponimia_Ouro_Branco/' : '/',
  resolve: {
    alias: [
      { find: '@lib', replacement: path.resolve(__dirname, 'src/lib') },
      { find: '@features', replacement: path.resolve(__dirname, 'src/features') },
      { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@pages', replacement: path.resolve(__dirname, 'src/pages') },
      { find: '@styles', replacement: path.resolve(__dirname, 'src/styles') },
      { find: '@legacy', replacement: path.resolve(__dirname, 'src/legacy') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: 'langchain/agents', replacement: 'langchain/agents' },
    ],
  },
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
        cruzadinha: 'games/cruzadinha.html',
        ranking: 'games/ranking.html',
      },
    },
  },
  optimizeDeps: {
    include: ['langchain/agents', '@langchain/openai', '@langchain/core'],
  },
  plugins: [
    react(),
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
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
          {
            src: 'toponimia.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.(css|js|png|jpg|jpeg|svg|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
})
