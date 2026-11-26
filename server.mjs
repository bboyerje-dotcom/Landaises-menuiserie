// Serveur de développement minimal, sans dépendance. Usage : node server.mjs [port] [--lan]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function demarrer(port = 8080, hote = '127.0.0.1') {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = normalize(join(racine, p));
      if (!f.startsWith(racine) || /[\\/](tests|node_modules)[\\/]|server\.mjs$/.test(f)) throw Object.assign(new Error(), { code: 'ENOENT' });
      const data = await readFile(f);
      res.writeHead(200, { 'Content-Type': types[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch (e) {
      res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500).end('Introuvable');
    }
  });
  return new Promise((ok) => srv.listen(port, hote, () => ok(srv)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  const lan = process.argv.includes('--lan');
  await demarrer(port, lan ? '0.0.0.0' : '127.0.0.1');
  console.log(`Pilotage Terrain : http://localhost:${port}/` + (lan ? '  (accessible sur le réseau local)' : ''));
}
