const { loadLocalEnv } = require('../_lib/env');
const { verifySessionToken } = require('../_lib/session');

module.exports = (req, res) => {
  loadLocalEnv();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token requerido' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
  }

  if (payload.type === 'admin') {
    return res.status(200).json({
      success: true,
      type: 'admin',
      usuario: payload.usuario,
      cargo: payload.cargo
    });
  }

  if (payload.type === 'student') {
    return res.status(200).json({
      success: true,
      type: 'student',
      id: payload.id,
      name: payload.name,
      carne: payload.carne,
      role: payload.role || 'student',
      muted: !!payload.muted
    });
  }

  return res.status(401).json({ success: false, message: 'Sesión inválida' });
};
