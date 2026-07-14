const crypto = require('crypto');
const { loadLocalEnv } = require('../_lib/env');
const { createSessionToken } = require('../_lib/session');
const { findAdminUser } = require('../_lib/supabase');

module.exports = async (req, res) => {
  loadLocalEnv();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  if (!process.env.SESSION_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Error de servidor: SESSION_SECRET no está configurado.'
    });
  }

  const { nombre, cargo, password } = req.body || {};

  if (!nombre || !cargo || !password) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }

  const cargosValidos = ['admin', 'docente', 'aso'];
  if (!cargosValidos.includes(cargo)) {
    return res.status(400).json({ success: false, message: 'Cargo inválido' });
  }

  // Hash de la contraseña recibida
  const passwordHash = crypto
    .createHash('sha256')
    .update(password.trim(), 'utf8')
    .digest('hex');

  // ──────────────────────────────────────────────────────────────────────────
  //  ESTRATEGIA 1 – Supabase (fuente de verdad)
  // ──────────────────────────────────────────────────────────────────────────
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      // Soporte de alias: si el usuario escribe "admin" como shortcut en cargo admin
      const usuarioBusqueda = (cargo === 'admin' && nombre.trim().toLowerCase() === 'admin')
        ? 'Juan Ribelino Aguilar Lopez'
        : nombre.trim();

      const row = await findAdminUser(usuarioBusqueda, cargo);

      if (row && row.password_hash === passwordHash) {
        const token = createSessionToken({
          type: 'admin',
          usuario: row.usuario,
          cargo: row.cargo
        });
        return res.status(200).json({
          success: true,
          token,
          usuario: row.usuario,
          cargo: row.cargo,
          message: 'Autenticación exitosa'
        });
      }

      // No encontrado en Supabase → caer a fallback de env vars antes de rechazar
    } catch (supabaseErr) {
      // Si Supabase falla (red, tabla no existe…), continuamos con fallback
      console.warn('[login] Supabase no disponible, usando env vars como fallback:', supabaseErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  ESTRATEGIA 2 – Variables de entorno (fallback / desarrollo local)
  // ──────────────────────────────────────────────────────────────────────────
  const credentials = {
    admin: [
      { user: process.env.ADMIN_USER_1, hash: process.env.ADMIN_HASH_1 }
    ],
    docente: [
      { user: process.env.DOCENTE_USER_1,  hash: process.env.DOCENTE_HASH_1  },
      { user: process.env.DOCENTE_USER_2,  hash: process.env.DOCENTE_HASH_2  },
      { user: process.env.DOCENTE_USER_3,  hash: process.env.DOCENTE_HASH_3  },
      { user: process.env.DOCENTE_USER_4,  hash: process.env.DOCENTE_HASH_4  },
      { user: process.env.DOCENTE_USER_5,  hash: process.env.DOCENTE_HASH_5  },
      { user: process.env.DOCENTE_USER_6,  hash: process.env.DOCENTE_HASH_6  },
      { user: process.env.DOCENTE_USER_7,  hash: process.env.DOCENTE_HASH_7  },
      { user: process.env.DOCENTE_USER_8,  hash: process.env.DOCENTE_HASH_8  },
      { user: process.env.DOCENTE_USER_9,  hash: process.env.DOCENTE_HASH_9  },
      { user: process.env.DOCENTE_USER_10, hash: process.env.DOCENTE_HASH_10 }
    ],
    aso: [
      { user: process.env.ASO_USER_1,  hash: process.env.ASO_HASH_1  },
      { user: process.env.ASO_USER_2,  hash: process.env.ASO_HASH_2  },
      { user: process.env.ASO_USER_3,  hash: process.env.ASO_HASH_3  },
      { user: process.env.ASO_USER_4,  hash: process.env.ASO_HASH_4  },
      { user: process.env.ASO_USER_5,  hash: process.env.ASO_HASH_5  },
      { user: process.env.ASO_USER_6,  hash: process.env.ASO_HASH_6  },
      { user: process.env.ASO_USER_7,  hash: process.env.ASO_HASH_7  },
      { user: process.env.ASO_USER_8,  hash: process.env.ASO_HASH_8  },
      { user: process.env.ASO_USER_9,  hash: process.env.ASO_HASH_9  },
      { user: process.env.ASO_USER_10, hash: process.env.ASO_HASH_10 }
    ]
  };

  const lista = credentials[cargo] || [];

  const usuarioEncontrado = lista.find((cred) => {
    if (!cred.user || !cred.hash) return false;

    const normalizedCred   = cred.user.trim().toLowerCase();
    const normalizedNombre = nombre.trim().toLowerCase();

    // Alias "admin" para el administrador
    if (cargo === 'admin' && normalizedNombre === 'admin') {
      return cred.hash === passwordHash;
    }

    if (normalizedCred === normalizedNombre) return cred.hash === passwordHash;

    // Tolerancia a espacios extra
    const cleanCred   = normalizedCred.replace(/\s+/g, '');
    const cleanNombre = normalizedNombre.replace(/\s+/g, '');
    if (cleanCred === cleanNombre) return cred.hash === passwordHash;

    return false;
  });

  if (!usuarioEncontrado) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }

  try {
    const token = createSessionToken({
      type: 'admin',
      usuario: usuarioEncontrado.user,
      cargo
    });
    return res.status(200).json({
      success: true,
      token,
      usuario: usuarioEncontrado.user,
      cargo,
      message: 'Autenticación exitosa'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error de servidor al crear la sesión.'
    });
  }
};
