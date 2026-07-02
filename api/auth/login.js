const crypto = require('crypto');

// Fallback local env loader (para desarrollo local autónomo)
function loadLocalEnv() {
  if (process.env.ADMIN_USER_1) return; // Ya están cargadas en el entorno
  try {
    const fs = require('fs');
    const path = require('path');
    let dir = __dirname;
    // Buscar .env.local subiendo hasta 4 niveles
    for (let i = 0; i < 4; i++) {
      const envPath = path.join(dir, '.env.local');
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
        console.log('Variables de entorno cargadas desde:', envPath);
        break;
      }
      dir = path.dirname(dir);
    }
  } catch (e) {
    console.error('Error cargando .env.local localmente:', e);
  }
}

module.exports = (req, res) => {
  // Asegurar que las variables locales se carguen si no están en el entorno real
  loadLocalEnv();

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { nombre, cargo, password } = req.body;

  // Validar que existan los campos
  if (!nombre || !cargo || !password) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }

  // Definir credenciales de manera dinámica leyendo process.env en cada petición
  const credentials = {
    admin: [
      { user: process.env.ADMIN_USER_1, hash: process.env.ADMIN_HASH_1 }
    ],
    docente: [
      { user: process.env.DOCENTE_USER_1, hash: process.env.DOCENTE_HASH_1 },
      { user: process.env.DOCENTE_USER_2, hash: process.env.DOCENTE_HASH_2 },
      { user: process.env.DOCENTE_USER_3, hash: process.env.DOCENTE_HASH_3 },
      { user: process.env.DOCENTE_USER_4, hash: process.env.DOCENTE_HASH_4 },
      { user: process.env.DOCENTE_USER_5, hash: process.env.DOCENTE_HASH_5 },
      { user: process.env.DOCENTE_USER_6, hash: process.env.DOCENTE_HASH_6 },
      { user: process.env.DOCENTE_USER_7, hash: process.env.DOCENTE_HASH_7 },
      { user: process.env.DOCENTE_USER_8, hash: process.env.DOCENTE_HASH_8 },
      { user: process.env.DOCENTE_USER_9, hash: process.env.DOCENTE_HASH_9 },
      { user: process.env.DOCENTE_USER_10, hash: process.env.DOCENTE_HASH_10 }
    ],
    aso: [
      { user: process.env.ASO_USER_1, hash: process.env.ASO_HASH_1 },
      { user: process.env.ASO_USER_2, hash: process.env.ASO_HASH_2 },
      { user: process.env.ASO_USER_3, hash: process.env.ASO_HASH_3 },
      { user: process.env.ASO_USER_4, hash: process.env.ASO_HASH_4 },
      { user: process.env.ASO_USER_5, hash: process.env.ASO_HASH_5 },
      { user: process.env.ASO_USER_6, hash: process.env.ASO_HASH_6 },
      { user: process.env.ASO_USER_7, hash: process.env.ASO_HASH_7 },
      { user: process.env.ASO_USER_8, hash: process.env.ASO_HASH_8 },
      { user: process.env.ASO_USER_9, hash: process.env.ASO_HASH_9 },
      { user: process.env.ASO_USER_10, hash: process.env.ASO_HASH_10 }
    ]
  };

  // Validar que el cargo sea válido
  if (!credentials[cargo]) {
    return res.status(400).json({ success: false, message: 'Cargo inválido' });
  }

  // Verificar si las variables de entorno están vacías
  const firstCred = credentials[cargo][0];
  if (!firstCred || !firstCred.user || !firstCred.hash) {
    console.error(`Variables de entorno no configuradas para el cargo: ${cargo}`);
    return res.status(500).json({
      success: false,
      message: 'Error de servidor: Las credenciales no han sido configuradas en las variables de entorno.'
    });
  }

  // Normalizar y calcular hash de la contraseña ingresada
  const normalizedPassword = password.trim();
  const passwordHash = crypto
    .createHash('sha256')
    .update(normalizedPassword, 'utf8')
    .digest('hex');

  // Buscar usuario con normalización para evitar fallos por mayúsculas, minúsculas o espacios extra
  const usuarioEncontrado = credentials[cargo].find((cred) => {
    if (!cred.user || !cred.hash) return false;
    
    const normalizedCred = cred.user.trim().toLowerCase();
    const normalizedNombre = nombre.trim().toLowerCase();

    // Comparación básica normalizada
    if (normalizedCred === normalizedNombre) {
      return cred.hash === passwordHash;
    }

    // Para el administrador, permitir también usar "admin" como alias de usuario
    if (cargo === 'admin' && normalizedNombre === 'admin') {
      return cred.hash === passwordHash;
    }

    // Comparación robusta sin espacios intermedios (ej. "docente 1" -> "docente1")
    const cleanCred = normalizedCred.replace(/\s+/g, '');
    const cleanNombre = normalizedNombre.replace(/\s+/g, '');
    if (cleanCred === cleanNombre) {
      return cred.hash === passwordHash;
    }

    return false;
  });

  if (usuarioEncontrado) {
    // Login exitoso - generar token simple
    const token = crypto.randomBytes(32).toString('hex');
    
    return res.status(200).json({
      success: true,
      token: token,
      usuario: usuarioEncontrado.user, // Devolvemos el nombre real almacenado en el servidor
      cargo: cargo,
      message: 'Autenticación exitosa'
    });
  }

  // Login fallido
  return res.status(401).json({
    success: false,
    message: 'Credenciales inválidas'
  });
};
