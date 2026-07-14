const crypto = require('crypto');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function getSecret() {
  return process.env.SESSION_SECRET || '';
}

function createSessionToken(payload) {
  const secret = getSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET no configurado');
  }

  const data = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');

  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.type || !payload.exp || payload.exp < Date.now()) return null;

    if (payload.type === 'admin') {
      if (!payload.usuario || !payload.cargo) return null;
    } else if (payload.type === 'student') {
      if (!payload.id || !payload.name || !payload.carne) return null;
    } else {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

module.exports = { createSessionToken, verifySessionToken, TOKEN_TTL_MS };
