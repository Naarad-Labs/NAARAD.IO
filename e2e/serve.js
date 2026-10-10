// A tiny static server for the repo root, so the tests need no build step and no dependencies.
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gpx': 'application/gpx+xml', '.geojson': 'application/geo+json' };

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // Like GitHub Pages: an unknown path gets 404.html with a 404 status (it redirects to /?page=...).
    const nf = path.join(ROOT, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html' });
    return fs.existsSync(nf) ? fs.createReadStream(nf).pipe(res) : res.end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:4173'));
