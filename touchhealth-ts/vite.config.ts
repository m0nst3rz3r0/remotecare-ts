import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Vercel serves from domain root — must use '/'
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Ensures assets are placed in assets/ folder and referenced correctly
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
});
