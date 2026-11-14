'use strict';
// Test-only loopback server. No repository files are fetched from the network.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

async function startPreview(root = path.resolve(__dirname, '..')) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(root, '.' + pathname);
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

module.exports = { startPreview };
