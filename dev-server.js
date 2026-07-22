const http = require('http');
const fs = require('fs');
const path = require('path');
// Simple in‑memory rate limiter (30 req/s per IP)
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const ipCounters = {};
function allowRequest(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = ipCounters[ip] || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.start = now;
  } else {
    entry.count++;
  }
  ipCounters[ip] = entry;
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    }
  });
} else {
  console.warn('ADVERTENCIA: .env.local no encontrado.');
}

const API_ROUTES = {
  '/api/auth/login': require('./api/auth/login.js'),
  '/api/auth/verify': require('./api/auth/verify.js'),
  '/api/auth/student-register': require('./api/auth/student-register.js'),
  '/api/auth/student-login': require('./api/auth/student-login.js'),
  '/api/students': require('./api/students/index.js'),
  '/api/aetsro-documents': require('./api/aetsro-documents.js')
};

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function handleApi(req, res, handler) {
  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      req.body = body ? JSON.parse(body) : {};
    } catch {
      req.body = {};
    }

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    };

    try {
    await handler(req, res);
  } catch (err) {
    console.error('Error en API:', err);
    if (!res.headersSent) {
      // If the handler threw a Supabase error (status >=500), map to 503
      const status = err && err.status && err.status >= 500 ? 503 : 500;
      const msg = err && err.status && err.status >= 500 ? 'Servicio temporalmente indisponible' : 'Error interno del servidor';
      res.statusCode = status;
      res.end(JSON.stringify({ success: false, message: msg }));
    }
  }
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.statusCode = 404;
    res.end();
    return;
  }

  const route = req.url.split('?')[0];
  if (API_ROUTES[route]) {
    // Apply rate limiting for API routes
    if (!allowRequest(req)) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: 'Demasiadas peticiones, intente más tarde.' }));
      return;
    }
    handleApi(req, res, API_ROUTES[route]);
    return;
  }

  let safeUrl = route === '/' ? '/index.html' : route;
  // Decodifica %20 y otros caracteres para que coincidan con nombres reales en disco
  try { safeUrl = decodeURIComponent(safeUrl); } catch(e) {}
  const filePath = path.join(PUBLIC_DIR, safeUrl);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Acceso denegado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor local: http://localhost:${PORT}`);
});
