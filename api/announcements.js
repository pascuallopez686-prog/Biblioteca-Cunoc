const { loadLocalEnv } = require('./_lib/env');
const { requireAuth, isAdminPayload } = require('./_lib/require-auth');
const { supabaseRequest } = require('./_lib/supabase-announcements');

// ── Máximos permitidos ─────────────────────────────────────────────────────────
const MAX_ANNS_TOTAL      = 50;   // Máximo de anuncios almacenados en total
const ADMIN_WINDOW_MS     = 3 * 24 * 60 * 60 * 1000; // 3 días en milisegundos
const ADMIN_LIMIT_WINDOW  = 50;   // Admin puede publicar hasta 50 en 3 días

module.exports = async (req, res) => {
  loadLocalEnv();

  // ── GET /api/announcements — cualquier sesión válida (admin o estudiante) ──
  if (req.method === 'GET') {
    const payload = requireAuth(req);
    if (!payload) return res.status(401).json({ success: false, message: 'No autorizado' });

    try {
      const rows = await supabaseRequest('announcements', {
        query: '?select=*&order=pinned.desc,created_at.desc&limit=50'
      });
      const anns = Array.isArray(rows) ? rows.map(mapAnn) : [];
      return res.status(200).json({ success: true, announcements: anns });
    } catch (err) {
      console.error('[API/announcements] GET error:', err);
      return res.status(500).json({ success: false, message: 'Error cargando anuncios' });
    }
  }

  // ── POST /api/announcements — solo admin ──────────────────────────────────────
  if (req.method === 'POST') {
    const payload = requireAuth(req, { types: ['admin'] });
    if (!payload || !isAdminPayload(payload)) {
      return res.status(403).json({ success: false, message: 'Solo administradores pueden publicar anuncios' });
    }

    const { title, content, type = 'general', image = null } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Título y contenido son requeridos' });
    }

    try {
      // Verificar límite total
      const existing = await supabaseRequest('announcements', {
        query: '?select=id,created_at&order=created_at.desc'
      });
      const allAnns = Array.isArray(existing) ? existing : [];

      if (allAnns.length >= MAX_ANNS_TOTAL) {
        return res.status(429).json({ success: false, message: `Se ha alcanzado el límite de ${MAX_ANNS_TOTAL} anuncios. Elimina algunos antes de publicar más.` });
      }

      // Verificar límite por ventana de 3 días
      const windowStart = new Date(Date.now() - ADMIN_WINDOW_MS).toISOString();
      const recentCount = allAnns.filter(a => a.created_at >= windowStart).length;
      if (recentCount >= ADMIN_LIMIT_WINDOW) {
        return res.status(429).json({ success: false, message: `Límite de ${ADMIN_LIMIT_WINDOW} anuncios por 3 días alcanzado.` });
      }

      const newAnn = await supabaseRequest('announcements', {
        method: 'POST',
        body: { title: title.trim(), content: content.trim(), type, image, pinned: false },
        prefer: 'return=representation'
      });

      const ann = Array.isArray(newAnn) ? newAnn[0] : newAnn;
      return res.status(201).json({ success: true, announcement: mapAnn(ann) });
    } catch (err) {
      console.error('[API/announcements] POST error:', err);
      return res.status(500).json({ success: false, message: 'Error publicando anuncio' });
    }
  }

  // ── PATCH /api/announcements — fijar/desfijar (solo admin) ───────────────────
  if (req.method === 'PATCH') {
    const payload = requireAuth(req, { types: ['admin'] });
    if (!payload || !isAdminPayload(payload)) {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    const { id, pinned } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'ID requerido' });

    try {
      await supabaseRequest('announcements', {
        method: 'PATCH',
        query: `?id=eq.${id}`,
        body: { pinned: !!pinned },
        prefer: 'return=minimal'
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error actualizando anuncio' });
    }
  }

  // ── DELETE /api/announcements — solo admin ────────────────────────────────────
  if (req.method === 'DELETE') {
    const payload = requireAuth(req, { types: ['admin'] });
    if (!payload || !isAdminPayload(payload)) {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'ID requerido' });

    try {
      await supabaseRequest('announcements', {
        method: 'DELETE',
        query: `?id=eq.${id}`
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error eliminando anuncio' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};

function mapAnn(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    image: row.image || null,
    pinned: row.pinned || false,
    createdAt: row.created_at,
    studentName: row.student_name || null,
    isStudentContribution: row.is_student_contribution || false
  };
}
