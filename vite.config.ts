import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The app is fully client-side: logs never leave the device.
 * vite-plugin-pwa precaches the shell so it opens offline (and from the
 * home screen) with zero network.
 *
 * Relative base + assets in `dist/` keep the built app portable: the repo root
 * can be served by any static server (or the preview's static fallback) as long
 * as the build has been published to the root. `npm run publish:root` does that
 * and derives /sw.js and the manifest from the same files.
 */
export default defineConfig({
  // Build input: the dev/source entry in web/. The repo-root index.html is a
  // published artifact (see scripts/publish-root.mjs), never a build input.
  root: 'web',
  base: './',
  publicDir: '../public',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: false,
    // Plain names (no content hash): the build is published to the repo root for
    // static serving, and predictable filenames keep that copy in sync.
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
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
        scope: './',
        start_url: './',
        id: './',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search log', short_name: 'Search', url: './?tab=search', description: 'Open the search filters' },
          { name: 'Results', short_name: 'Results', url: './?tab=results' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2,txt}'],
        // Published asset filenames are stable, so Workbox must revision their
        // contents to deliver updates to existing offline installations.
        dontCacheBustURLsMatching: /$^/,

        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
});
