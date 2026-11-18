import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await realpath(path.join(project, process.argv.includes('--dist') ? 'dist' : '.'));
const requestedPort = process.env.PORT || '4173';
if (!/^\d+$/.test(requestedPort) || Number(requestedPort) > 65535) throw new Error('Invalid PORT');
const host = '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const inside = target => target === root || target.startsWith(root + path.sep);
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
  try {
    let pathname;
    try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); }
    catch { res.writeHead(400); res.end('Invalid URL'); return; }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.'))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const target = path.resolve(root, '.' + pathname);
    if (!inside(target)) { res.writeHead(403); res.end('Forbidden'); return; }
    let resolved = await realpath(target);
    if (!inside(resolved)) { res.writeHead(403); res.end('Forbidden'); return; }
    let metadata = await stat(resolved);
    if (metadata.isDirectory()) {
      resolved = await realpath(path.join(resolved, 'index.html'));
      if (!inside(resolved)) { res.writeHead(403); res.end('Forbidden'); return; }
      metadata = await stat(resolved);
    }
    if (!metadata.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] || 'application/octet-stream', 'Content-Length': metadata.size });
    res.end(req.method === 'HEAD' ? undefined : await readFile(resolved));
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500);
    res.end(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Server error');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(requestedPort), host, () => console.log(`Taiwan Talk: http://${host}:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
