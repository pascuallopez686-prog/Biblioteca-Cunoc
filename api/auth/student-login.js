const { loadLocalEnv } = require('../_lib/env');
const { createSessionToken } = require('../_lib/session');
const { hashStudentPassword } = require('../_lib/student-hash');
const { findStudentByCarne, mapStudent } = require('../_lib/supabase');

module.exports = async (req, res) => {
  loadLocalEnv();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  if (!process.env.SESSION_SECRET) {
    return res.status(500).json({ success: false, message: 'SESSION_SECRET no configurado.' });
  }

  const { carne, password } = req.body || {};
  if (!carne || !password) {
    return res.status(400).json({ success: false, message: 'Carné y contraseña son obligatorios.' });
  }

  try {
    const row = await findStudentByCarne(carne);
    if (!row) {
      return res.status(401).json({ success: false, message: 'Carné o contraseña incorrectos.' });
    }

    const passwordHash = hashStudentPassword(carne, password);
    if (row.password_hash !== passwordHash) {
      return res.status(401).json({ success: false, message: 'Carné o contraseña incorrectos.' });
    }

    if (row.muted) {
      return res.status(403).json({ success: false, message: 'Tu cuenta ha sido silenciada. Contacta al administrador.' });
    }

    const user = mapStudent(row);
    const token = createSessionToken({
      type: 'student',
      id: user.id,
      name: user.name,
      carne: user.carne,
      role: user.role,
      muted: user.muted
    });

    return res.status(200).json({ success: true, token, user });
  } catch (err) {
    console.error('student-login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión. Verifica la configuración de Supabase.'
    });
  }
};
