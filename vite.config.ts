import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 12_000,
          maxSize: 320_000,
          groups: [
            {
              name: 'react-core',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
              priority: 4,
            },
            {
              name: 'firebase',
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
              priority: 3,
              includeDependenciesRecursively: false,
              maxSize: 300_000,
            },
            {
              name: 'icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 3,
              includeDependenciesRecursively: false,
            },
            {
              name: 'date-utils',
              test: /node_modules[\\/]date-fns[\\/]/,
              priority: 3,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Student Buddy Planner',
        short_name: 'Buddy Planner',
        description: 'Homework, tests, projects and class chat — all in one place.',
        id: '/',
        scope: '/',
        lang: 'en-IN',
        theme_color: '#4a55e1',
        background_color: '#f8f4ea',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        start_url: '/',
        categories: ['education', 'productivity', 'social'],
        shortcuts: [
          { name: 'Open Planner', short_name: 'Planner', url: '/planner', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Study Help', short_name: 'Study', url: '/study', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Open Chats', short_name: 'Chats', url: '/messages', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/firebase-cloud-messaging-push-scope/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-font-styles' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-font-files',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\/image\/upload\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
