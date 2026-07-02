const crypto = require('crypto');

// Credenciales desde variables de entorno (NO en el código)
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

module.exports = (req, res) => {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { nombre, cargo, password } = req.body;

  // Validar que existan los campos
  if (!nombre || !cargo || !password) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }

  // Validar que el cargo sea válido
  if (!credentials[cargo]) {
    return res.status(400).json({ success: false, message: 'Cargo inválido' });
  }

  // Calcular hash de la contraseña ingresada
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  // Buscar usuario en las credenciales del cargo seleccionado
  const usuarioEncontrado = credentials[cargo].find(
    (cred) => cred.user === nombre && cred.hash === passwordHash
  );

  if (usuarioEncontrado) {
    // Login exitoso - generar token simple
    const token = crypto.randomBytes(32).toString('hex');
    
    return res.status(200).json({
      success: true,
      token: token,
      usuario: nombre,
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
