/**
 * Dependency-free static server for the published build at the repo root.
 *
 * This is the safety net: if no dev server is running, the app still works
 * because the root contains a real build (see scripts/publish-root.mjs).
 *
 *   npm run serve        # http://0.0.0.0:8080
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const port = Number(process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Keep requests inside the repo root.
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safe);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    // Single-page app: unknown paths get the shell.
    file = join(root, 'index.html');
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    // The service worker must never be cached, everything else can be.
    'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=60',
  });
  createReadStream(file).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`log · search (static root build) → http://0.0.0.0:${port}`);
});
