const { loadLocalEnv } = require('../_lib/env');
const { requireAuth } = require('../_lib/require-auth');
const { listStudents, setStudentMuted, mapStudent } = require('../_lib/supabase');

module.exports = async (req, res) => {
  loadLocalEnv();

  const admin = requireAuth(req, { types: ['admin'] });
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Acceso denegado.' });
  }

  if (req.method === 'GET') {
    try {
      const students = await listStudents();
      return res.status(200).json({ success: true, students });
    } catch (err) {
      console.error('students GET:', err.message);
      return res.status(500).json({ success: false, message: 'No se pudo cargar la lista de estudiantes.' });
    }
  }

  if (req.method === 'PATCH') {
    const { carne, muted } = req.body || {};
    if (!carne || typeof muted !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Carné y estado muted son obligatorios.' });
    }

    try {
      const row = await setStudentMuted(carne, muted);
      if (!row) {
        return res.status(404).json({ success: false, message: 'Estudiante no encontrado.' });
      }
      return res.status(200).json({ success: true, student: mapStudent(row) });
    } catch (err) {
      console.error('students PATCH:', err.message);
      return res.status(500).json({ success: false, message: 'No se pudo actualizar al estudiante.' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};
