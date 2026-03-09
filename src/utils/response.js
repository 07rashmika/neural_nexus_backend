/**
 * Send a successful JSON response.
 */
function ok(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

/**
 * Send an error JSON response.
 */
function fail(res, message, statusCode = 400, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { ok, fail };