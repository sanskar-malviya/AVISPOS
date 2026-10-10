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
        // Tablet landscape is the main setup, but phones are used upright.
        orientation: 'any',
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
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
        // Install-time icons don't need to be in the offline cache.
        globIgnores: ['pwa-512.png', 'pwa-maskable-512.png'],
        // Owner-uploaded photos are stored inside the product documents, so the
        // Firestore offline cache keeps them available without internet.
        // Never let the service worker answer server-function calls.
        navigateFallbackDenylist: [/^\/__/, /^\/\.netlify\//, /\/[^/?]+\.[^/]+$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    // Local dev: server functions run in scripts/dev-functions.ts (port 8888).
    // On Netlify the same path is served by the real functions.
    proxy: {
      '/.netlify/functions': 'http://127.0.0.1:8888',
    },
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
