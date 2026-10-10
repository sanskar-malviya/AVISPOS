import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'robots.txt', 'apple-touch-icon.png', 'brand/logo.jpg'],
      manifest: {
        name: "Avi's Food Corner POS",
        short_name: "Avi's POS",
        description: "Fast billing for Avi's Food Corner",
        theme_color: '#b91c1c',
        background_color: '#fff7ed',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell is precached. Firestore data persistence is handled by the
        // Firestore SDK's own IndexedDB cache, NOT Workbox — so we do not try to
        // cache Firestore/Google API calls here.
        navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
        // Install-time icons don't need to be in the offline cache.
        globIgnores: ['pwa-512.png', 'pwa-maskable-512.png'],
        // Owner-uploaded product photos live in Cloud Storage. Cache them so the
        // menu still shows pictures during an internet outage. Each upload gets
        // a new URL, so a replaced photo is never served stale.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'firebasestorage.googleapis.com' ||
              url.hostname.endsWith('.firebasestorage.app'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: true,
    // Vendor code changes rarely; keeping it in its own chunks means an app
    // update only re-downloads the small app chunk on the tablet.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
