const { loadLocalEnv } = require('./env');

function getConfig() {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados.');
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function supabaseRequest(table, { method = 'GET', query = '', body = null, prefer = null } = {}) {
  const { url, key } = getConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || data?.hint || `Error Supabase (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    carne: row.carne,
    role: row.role,
    muted: row.muted,
    registeredAt: row.created_at
  };
}

async function findStudentByCarne(carne) {
  const rows = await supabaseRequest('students', {
    query: `?carne=eq.${encodeURIComponent(carne.trim())}&select=*&limit=1`
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function createStudent({ name, carne, passwordHash }) {
  const rows = await supabaseRequest('students', {
    method: 'POST',
    body: { name, carne: carne.trim(), password_hash: passwordHash },
    prefer: 'return=representation'
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function listStudents() {
  const rows = await supabaseRequest('students', {
    query: '?select=id,name,carne,role,muted,created_at&order=created_at.desc'
  });
  return Array.isArray(rows) ? rows.map(mapStudent) : [];
}

async function setStudentMuted(carne, muted) {
  const rows = await supabaseRequest('students', {
    method: 'PATCH',
    query: `?carne=eq.${encodeURIComponent(carne.trim())}`,
    body: { muted },
    prefer: 'return=representation'
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

// ── Admin users ───────────────────────────────────────────────────────────────

/**
 * Busca un usuario administrativo por nombre (usuario) y cargo.
 * Devuelve el row completo o null si no existe / está inactivo.
 */
async function findAdminUser(usuario, cargo) {
  const rows = await supabaseRequest('admin_users', {
    query: `?usuario=eq.${encodeURIComponent(usuario.trim())}&cargo=eq.${encodeURIComponent(cargo)}&activo=eq.true&select=*&limit=1`
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Lista todos los usuarios de un cargo.
 */
async function listAdminUsersByCargo(cargo) {
  const rows = await supabaseRequest('admin_users', {
    query: `?cargo=eq.${encodeURIComponent(cargo)}&activo=eq.true&select=id,usuario,cargo,activo,created_at&order=created_at.asc`
  });
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  findStudentByCarne,
  createStudent,
  listStudents,
  setStudentMuted,
  mapStudent,
  findAdminUser,
  listAdminUsersByCargo
};
