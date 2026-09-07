import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Service worker: makes repeat opens instant and lets the app shell load
      // with no signal at all. Data was already offline-capable via the sync
      // queue; the shell itself was re-downloaded on every cold open.
      VitePWA({
        registerType: 'autoUpdate',   // new deploy -> SW updates in background, no stale-shell lock-in
        injectRegister: 'auto',
        manifest: false,              // keep the hand-written public/manifest.json
        workbox: {
          // Precache ONLY the shell a field worker needs on first paint. Precaching
          // everything would pull ~400KB gz (recharts, hierarchy manager, ...) over
          // rural 3G on install, for screens most field roles never open.
          globPatterns: [
            'index.html',
            'favicon.svg',
            'manifest.json',
            'icon-*.png',
            'assets/index-*.{js,css}',
            'assets/vendor-react-*.js',
            'assets/vendor-lucide-*.js',
            'assets/*.woff2',
          ],
          // Everything else is content-hashed and immutable: cache on first use.
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-immutable',
                expiration: {maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
            // Never intercept the API: the app's own offline queue owns that.
            {urlPattern: ({url}) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly'},
          ],
          // SPA routing (incl. QR deep links like /?id=AWD-...), but never for the API.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Target ES2015 for broadest mobile browser compatibility including older Android WebViews
      target: 'es2015',
      // Raise warning threshold — our lazy chunks are intentionally large
      chunkSizeWarningLimit: 600,
      // No source maps in production (saves ~30% of total output size)
      sourcemap: false,
      rollupOptions: {
        output: {
          // Manual chunk splitting: separates heavy vendor libraries into individually
          // cacheable files. A return value of undefined falls through to default chunking.
          manualChunks(id) {
            // React ecosystem — smallest critical chunk, loaded first
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
              return 'vendor-react';
            }
            // Recharts + D3 dependencies — only loaded on Dashboard tab
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
              return 'vendor-recharts';
            }
            // Leaflet — only loaded on Map tab
            if (id.includes('node_modules/leaflet')) {
              return 'vendor-leaflet';
            }
            // Radix UI primitives — UI components used across the app
            if (id.includes('node_modules/@radix-ui')) {
              return 'vendor-radix';
            }
            // jsQR — camera/QR scanner, only used when scanning
            if (id.includes('node_modules/jsqr')) {
              return 'vendor-jsqr';
            }
            // lucide-react icons — tree-shaken but can be isolated for caching
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
          },
        },
      },
    },
  };
});
