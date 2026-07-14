function loadLocalEnv() {
  if (process.env.SESSION_SECRET || process.env.ADMIN_USER_1) return;
  try {
    const fs = require('fs');
    const path = require('path');
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      const envPath = path.join(dir, '.env.local');
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
        break;
      }
      dir = path.dirname(dir);
    }
  } catch (e) {
    console.error('Error cargando .env.local:', e.message);
  }
}

module.exports = { loadLocalEnv };
