import { defineConfig } from 'vite';
import { createPackMiddlewarePlugin } from './src/assets/vitePackMiddleware.js';

export default defineConfig({
  base: './',
  plugins: [createPackMiddlewarePlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
