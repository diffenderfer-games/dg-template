/**
 * scripts/kit/lib: serve dist/ under /<slug>/ on a port the OS picks (like the catalog mounts it).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md
 */
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

/** Serve `dist` at `http://127.0.0.1:<port>/<slug>/`; anything else (the hub's /_api) is a 404. */
export async function serveDist(dist: string, slug: string): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (!path.startsWith(`/${slug}/`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    let rel = path.slice(slug.length + 2) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(dist, rel));
    if (!file.startsWith(normalize(dist))) {
      res.writeHead(404);
      res.end();
      return;
    }
    readFile(file).then(
      (body) => {
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      },
      () => {
        res.writeHead(404);
        res.end();
      },
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  return { url: `http://127.0.0.1:${port}/${slug}/`, server };
}
