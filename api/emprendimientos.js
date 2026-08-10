const { loadLocalEnv } = require('./_lib/env');
const { requireAuth, isAdminPayload } = require('./_lib/require-auth');
const { supabaseRequest } = require('./_lib/supabase-announcements');

const MAX_EMPS_TOTAL = 100;

module.exports = async (req, res) => {
  loadLocalEnv();

  // ── GET /api/emprendimientos — público ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await supabaseRequest('emprendimientos', {
        query: '?select=*&order=created_at.desc&limit=100'
      });
      const emps = Array.isArray(rows) ? rows.map(mapEmp) : [];
      return res.status(200).json({ success: true, emprendimientos: emps });
    } catch (err) {
      console.error('[API/emprendimientos] GET error:', err);
      return res.status(500).json({ success: false, message: 'Error cargando emprendimientos' });
    }
  }

  // ── POST /api/emprendimientos — solo admin ──────────────────────────────────
  if (req.method === 'POST') {
    const payload = requireAuth(req, { types: ['admin'] });
    if (!payload || !isAdminPayload(payload)) {
      return res.status(403).json({ success: false, message: 'Solo administradores pueden publicar emprendimientos' });
    }

    const { owner, name, desc, category, website, facebook, instagram, whatsapp, imageBase64 } = req.body || {};
    if (!owner || !name || !desc || !category) {
      return res.status(400).json({ success: false, message: 'Campos obligatorios: owner, name, desc, category' });
    }

    try {
      const existing = await supabaseRequest('emprendimientos', { query: '?select=id' });
      if (Array.isArray(existing) && existing.length >= MAX_EMPS_TOTAL) {
        return res.status(429).json({ success: false, message: `Límite de ${MAX_EMPS_TOTAL} emprendimientos alcanzado. Elimina algunos antes de publicar más.` });
      }

      const newEmp = await supabaseRequest('emprendimientos', {
        method: 'POST',
        body: {
          owner:        owner.trim(),
          name:         name.trim(),
          description:  desc.trim(),
          category:     category.trim(),
          website:      website  || null,
          facebook:     facebook || null,
          instagram:    instagram|| null,
          whatsapp:     whatsapp || null,
          image_base64: imageBase64 || null
        },
        prefer: 'return=representation'
      });

      const emp = Array.isArray(newEmp) ? newEmp[0] : newEmp;
      return res.status(201).json({ success: true, emprendimiento: mapEmp(emp) });
    } catch (err) {
      console.error('[API/emprendimientos] POST error:', err);
      return res.status(500).json({ success: false, message: 'Error publicando emprendimiento: ' + err.message });
    }
  }

  // ── DELETE /api/emprendimientos — solo admin ────────────────────────────────
  if (req.method === 'DELETE') {
    const payload = requireAuth(req, { types: ['admin'] });
    if (!payload || !isAdminPayload(payload)) {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'ID requerido' });

    try {
      await supabaseRequest('emprendimientos', {
        method: 'DELETE',
        query: `?id=eq.${id}`
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[API/emprendimientos] DELETE error:', err);
      return res.status(500).json({ success: false, message: 'Error eliminando emprendimiento' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};

function mapEmp(row) {
  return {
    id:          row.id,
    owner:       row.owner,
    name:        row.name,
    desc:        row.description,
    category:    row.category,
    website:     row.website    || null,
    facebook:    row.facebook   || null,
    instagram:   row.instagram  || null,
    whatsapp:    row.whatsapp   || null,
    imageBase64: row.image_base64 || null,
    createdAt:   row.created_at
  };
}
