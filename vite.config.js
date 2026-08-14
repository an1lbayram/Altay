import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('leaflet')) {
            return 'leaflet';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    // Only unit/component specs — Playwright's tests/**/*.spec.js files import
    // '@playwright/test' and are run by `playwright test`, not Vitest.
    include: ['tests/unit/**/*.test.js', 'tests/component/**/*.test.js'],
    environment: 'jsdom',
  }
});
