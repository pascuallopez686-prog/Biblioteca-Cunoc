const crypto = require('crypto');

function hashStudentPassword(carne, password) {
  const data = `${String(carne).trim().toLowerCase()}:${password}`;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

module.exports = { hashStudentPassword };
