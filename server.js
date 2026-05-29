const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3456;
const PASSWORD = process.env.NOTEBOOK_PASSWORD || '';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
};

function checkAuth(req) {
  if (!PASSWORD) return true;
  const auth = req.headers['authorization'] || '';
  const b64 = auth.replace('Basic ', '');
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  const [, pass] = decoded.split(':');
  return pass === PASSWORD;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API endpoints require auth
  if (url.pathname.startsWith('/api/')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="mynotebook"' });
      return res.end('Unauthorized');
    }
  }

  // API: GET /api/notes
  if (req.method === 'GET' && url.pathname === '/api/notes') {
    if (!fs.existsSync(NOTES_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('[]');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(fs.readFileSync(NOTES_FILE, 'utf8'));
  }

  // API: POST /api/notes
  if (req.method === 'POST' && url.pathname === '/api/notes') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        JSON.parse(body);
        fs.writeFileSync(NOTES_FILE, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400);
        res.end('bad json');
      }
    });
    return;
  }

  // Static files (index.html etc. — no auth required so login prompt works)
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(DIR, filePath);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); return res.end(); }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`起動しました → http://localhost:${PORT}`);
  if (!PASSWORD) console.warn('警告: NOTEBOOK_PASSWORD が未設定です');
});
