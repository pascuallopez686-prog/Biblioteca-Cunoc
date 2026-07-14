const http = require('http');
const fs = require('fs');
const path = require('path');

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
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: 'Error interno del servidor' }));
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
