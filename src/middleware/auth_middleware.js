const { verifyAccessToken } = require('../utils/jwt');
const { fail } = require('../utils/response');

/**
 * Middleware: verify Bearer token and attach decoded payload to req.player.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return fail(res, 'Authorization token required', 401);
  }

  const token = header.slice(7);

  try {
    req.player = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return fail(res, 'Token expired. Please log in again.', 401);
    }
    return fail(res, 'Invalid token', 401);
  }
}

module.exports = { requireAuth };