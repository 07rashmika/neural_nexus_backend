const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables');
}

/**
 * Sign an access token for a player.
 * @param {{ id: string, email: string, username: string }} payload
 */
function signAccessToken(payload) {
  return jwt.sign(
    { sub: payload.id, email: payload.email, username: payload.username },
    SECRET,
    { expiresIn: EXPIRES_IN, issuer: 'neural-nexus-protocol' }
  );
}

/**
 * Verify and decode an access token.
 * Returns the decoded payload or throws.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, SECRET, { issuer: 'neural-nexus-protocol' });
}

module.exports = { signAccessToken, verifyAccessToken };