const { randomBytes } = require('crypto');

// Cryptographically Secure random 128 hex digit
const generateCSRFToken = () => {
  const buffer = randomBytes(64);
  return buffer.toString('hex').trim();
}


module.exports = {
  generateCSRFToken
};