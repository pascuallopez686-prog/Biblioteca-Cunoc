const { loadLocalEnv } = require('../_lib/env');
const { createSessionToken } = require('../_lib/session');
const { hashStudentPassword } = require('../_lib/student-hash');
const { findStudentByCarne, createStudent, mapStudent } = require('../_lib/supabase');

module.exports = async (req, res) => {
  loadLocalEnv();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  if (!process.env.SESSION_SECRET) {
    return res.status(500).json({ success: false, message: 'SESSION_SECRET no configurado.' });
  }

  const { name, carne, password } = req.body || {};
  if (!name || !carne || !password) {
    return res.status(400).json({ success: false, message: 'Nombre, carné y contraseña son obligatorios.' });
  }

  if (String(password).length < 4) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  try {
    const existing = await findStudentByCarne(carne);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Este carné ya está registrado.' });
    }

    const passwordHash = hashStudentPassword(carne, password);
    const row = await createStudent({ name: name.trim(), carne, passwordHash });
    const user = mapStudent(row);

    const token = createSessionToken({
      type: 'student',
      id: user.id,
      name: user.name,
      carne: user.carne,
      role: user.role,
      muted: user.muted
    });

    return res.status(201).json({ success: true, token, user });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ success: false, message: 'Este carné ya está registrado.' });
    }
    console.error('student-register:', err.message);
    return res.status(500).json({
      success: false,
      message: 'No se pudo completar el registro. Verifica la configuración de Supabase.'
    });
  }
};
