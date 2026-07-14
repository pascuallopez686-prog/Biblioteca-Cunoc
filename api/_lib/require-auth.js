const { verifySessionToken } = require('./session');

function extractToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.body?.token || null;
}

function requireAuth(req, { types = null } = {}) {
  const token = extractToken(req);
  const payload = verifySessionToken(token);
  if (!payload) return null;
  if (types && !types.includes(payload.type)) return null;
  return payload;
}

function isAdminPayload(payload) {
  return payload?.type === 'admin';
}

module.exports = { extractToken, requireAuth, isAdminPayload };
