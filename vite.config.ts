import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    // Runs the worker alongside Vite in dev (via Miniflare) so /api/* hits the
    // real Hono routes + a local D1. Builds the worker bundle at build time.
    // Remove this plugin if you ever want a pure static-site dev server.
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
