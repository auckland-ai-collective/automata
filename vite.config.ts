import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Base is relative so the built app works both when served from a web host
// and when loaded from the local filesystem inside Electron (file://).
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@projects': fileURLToPath(new URL('./src/projects', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        standalone: fileURLToPath(new URL('./standalone.html', import.meta.url)),
      },
    },
  },
});
