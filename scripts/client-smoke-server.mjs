import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');

const portArgIndex = process.argv.indexOf('--port');
const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : 4179;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

function resolvePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requested = cleanPath === '/' ? '/practica_04.html' : cleanPath;
  const absolute = path.resolve(clientDir, `.${requested}`);
  const relative = path.relative(clientDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return absolute;
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolvePath(req.url ?? '/');
  if (!filePath) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = contentTypes.get(extension) ?? 'application/octet-stream';
    const body = method === 'HEAD' ? null : await fs.readFile(filePath);

    res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`[client-smoke-server] listening on http://127.0.0.1:${port}`);
});
