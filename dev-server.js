const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Load .env.local
const envPath = path.join(__dirname, '.env.local');
console.log('Cargando variables desde:', envPath);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
  console.log('Variables de entorno cargadas con éxito.');
} else {
  console.warn('ADVERTENCIA: .env.local no encontrado en la raíz del proyecto.');
}

// Importar el manejador de la API de login
const loginHandler = require(path.join(__dirname, 'api', 'auth', 'login.js'));

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

const server = http.createServer((req, res) => {
  // Ignorar peticiones de favicon
  if (req.url === '/favicon.ico') {
    res.statusCode = 404;
    res.end();
    return;
  }

  console.log(`[DEV SERVER] ${req.method} ${req.url}`);

  if (req.url === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }

      // Mockear helpers de respuesta de Vercel
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(obj));
      };

      try {
        loginHandler(req, res);
      } catch (err) {
        console.error('Error en el login handler:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: 'Error interno del servidor' }));
      }
    });
    return;
  }

  // Servir archivos estáticos
  let safeUrl = req.url.split('?')[0];
  if (safeUrl === '/') {
    safeUrl = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safeUrl);

  // Seguridad para evitar Directory Traversal
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
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Servidor local de desarrollo ejecutándose en:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
