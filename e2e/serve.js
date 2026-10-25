// A tiny static server for the repo root that answers the way GitHub Pages does,
// so the tests need no build tooling and no dependencies:
//   - a directory serves its index.html (/routes/x/ -> routes/x/index.html)
//   - a directory asked for without its trailing slash is redirected to it
//   - an unknown path gets 404.html with a 404 status
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gpx': 'application/gpx+xml', '.geojson': 'application/geo+json', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };

function notFound(res) {
  const nf = path.join(ROOT, '404.html');
  res.writeHead(404, { 'Content-Type': 'text/html' });
  return fs.existsSync(nf) ? fs.createReadStream(nf).pipe(res) : res.end();
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return notFound(res); }
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return notFound(res);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return notFound(res);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:4173'));
