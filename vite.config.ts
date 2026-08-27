import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
