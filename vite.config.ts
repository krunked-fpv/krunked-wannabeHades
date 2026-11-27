import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function optionalPackMiddlewarePlugin(): Plugin {
  return {
    name: 'krunked-optional-pack-middleware',
    async configureServer(server) {
      const middlewarePath = path.resolve(__dirname, 'src/assets/vitePackMiddleware.ts');
      if (!fs.existsSync(middlewarePath)) {
        return;
      }
      try {
        const mod = (await server.ssrLoadModule('/src/assets/vitePackMiddleware.ts')) as {
          attachPackMiddleware?: (srv: typeof server) => void;
          createPackMiddleware?: () => (req: unknown, res: unknown, next: () => void) => void;
          default?: ((srv: typeof server) => void) | (() => (req: unknown, res: unknown, next: () => void) => void);
        };
        if (typeof mod.attachPackMiddleware === 'function') {
          mod.attachPackMiddleware(server);
        } else if (typeof mod.createPackMiddleware === 'function') {
          server.middlewares.use(mod.createPackMiddleware() as never);
        } else if (typeof mod.default === 'function') {
          mod.default(server as never);
        }
      } catch (err) {
        server.config.logger.warn(
          `[krunked-pack-middleware] Optional middleware skipped: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [optionalPackMiddlewarePlugin()],
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
