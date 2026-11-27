/**
 * vitePackMiddleware — Vite Dev & Preview Middleware for Optional Local Custom Art Packs.
 *
 * Serves `/.wannabehades-assets/*` strictly read-only from the repository's gitignored
 * `.wannabehades-assets/` directory with proper `Content-Type` headers (`application/json`,
 * `image/png`, etc.), strict path-traversal containment, and quiet 404 JSON responses when
 * no local pack has been extracted yet.
 */

import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';

export const PACK_URL_PREFIX = '/.wannabehades-assets';

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function resolveDefaultAssetsDir(): string {
  return path.resolve(process.cwd(), '.wannabehades-assets');
}

function sendJsonStatus(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}

/**
 * Creates a Connect-compatible middleware serving `/.wannabehades-assets/*` from `assetsDir`.
 */
export function createPackMiddleware(assetsDir?: string): Connect.NextHandleFunction {
  const rootDir = path.resolve(assetsDir ?? resolveDefaultAssetsDir());
  const rootPrefix = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  return (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction): void => {
    const rawUrl = req.url ?? '';
    const queryIdx = rawUrl.indexOf('?');
    const pathname = queryIdx >= 0 ? rawUrl.slice(0, queryIdx) : rawUrl;

    if (pathname !== PACK_URL_PREFIX && !pathname.startsWith(`${PACK_URL_PREFIX}/`)) {
      next();
      return;
    }

    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      sendJsonStatus(res, 405, { error: 'Method not allowed' });
      return;
    }

    const relEncoded = pathname.slice(PACK_URL_PREFIX.length).replace(/^\/+/, '');
    if (!relEncoded) {
      sendJsonStatus(res, 404, { error: 'Custom pack asset not found' });
      return;
    }

    let relDecoded: string;
    try {
      relDecoded = decodeURIComponent(relEncoded);
    } catch {
      sendJsonStatus(res, 400, { error: 'Malformed asset path' });
      return;
    }

    if (relDecoded.includes('\0')) {
      sendJsonStatus(res, 400, { error: 'Invalid asset path' });
      return;
    }

    const targetPath = path.resolve(rootDir, relDecoded);
    if (!targetPath.startsWith(rootPrefix)) {
      sendJsonStatus(res, 403, { error: 'Forbidden asset path' });
      return;
    }

    fs.stat(targetPath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        sendJsonStatus(res, 404, { error: 'Custom pack asset not found' });
        return;
      }

      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'no-cache');

      if (method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(targetPath);
      stream.on('error', () => {
        if (!res.headersSent) {
          sendJsonStatus(res, 500, { error: 'Failed to read custom pack asset' });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    });
  };
}

/**
 * Attaches the custom pack middleware to a Vite dev or preview server.
 * Compatible with existing `optionalPackMiddlewarePlugin()` in `vite.config.ts`.
 */
export function attachPackMiddleware(
  server: { middlewares: Connect.Server },
  assetsDir?: string
): void {
  server.middlewares.use(createPackMiddleware(assetsDir));
}

/**
 * Vite plugin serving `.wannabehades-assets/` at `/.wannabehades-assets/*`
 * during both `vite dev` and `vite preview`.
 */
export function createPackMiddlewarePlugin(assetsDir?: string): Plugin {
  return {
    name: 'krunked-wannabehades-pack-middleware',
    configureServer(server) {
      attachPackMiddleware(server, assetsDir);
    },
    configurePreviewServer(server) {
      attachPackMiddleware(server, assetsDir);
    },
  };
}

export default createPackMiddlewarePlugin;
