import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The app is fully client-side: logs never leave the device.
 * vite-plugin-pwa precaches the shell so it opens offline (and from the
 * home screen) with zero network.
 */
export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: {
    host: '0.0.0.0',
    // Accept the sandbox preview host (https://<port>-<id>.e2b.app) as well as localhost.
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'favicon.svg',
      ],
      manifest: {
        name: 'log · search',
        short_name: 'log search',
        description:
          'Search WhatsApp-style chat logs by speaker, date and keyword. Everything stays on your device.',
        theme_color: '#f8fafc',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        id: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search log', short_name: 'Search', url: '/?tab=search', description: 'Open the search filters' },
          { name: 'Results', short_name: 'Results', url: '/?tab=results' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
});
