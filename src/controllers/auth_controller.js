const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { signAccessToken } = require('../utils/jwt');
const { ok, fail } = require('../utils/response');

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 12;

// ─── Register ────────────────────────────────────────────────────────────────

async function register(req, res) {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 'Validation failed', 422, errors.array());
  }

  const { email, password, username } = req.body;

  try {
    // Check for existing email or username
    const existing = await query(
      'SELECT id FROM players WHERE email = $1 OR username = $2 LIMIT 1',
      [email.toLowerCase(), username]
    );

    if (existing.rowCount > 0) {
      return fail(res, 'Email or username already taken', 409);
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert player
    const { rows } = await query(
      `INSERT INTO players (email, password, username)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, status, created_at`,
      [email.toLowerCase(), hashed, username]
    );

    const player = rows[0];
    const token = signAccessToken(player);

    return ok(
      res,
      {
        message: 'Agent registered successfully. Welcome to the Nexus.',
        token,
        player: {
          id: player.id,
          email: player.email,
          username: player.username,
          status: player.status,
          createdAt: player.created_at,
        },
      },
      201
    );
  } catch (err) {
    console.error('[Auth/register]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 'Validation failed', 422, errors.array());
  }

  const { email, password } = req.body;

  try {
    const { rows } = await query(
      `SELECT id, email, username, password, status, last_login, created_at
       FROM players
       WHERE email = $1
       LIMIT 1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      // Generic message to avoid user enumeration
      return fail(res, 'Invalid credentials', 401);
    }

    const player = rows[0];

    if (player.status !== 'active') {
      return fail(res, `Account is ${player.status}. Contact support.`, 403);
    }

    const passwordMatch = await bcrypt.compare(password, player.password);
    if (!passwordMatch) {
      return fail(res, 'Invalid credentials', 401);
    }

    // Update last login timestamp
    await query(
      'UPDATE players SET last_login = NOW() WHERE id = $1',
      [player.id]
    );

    const token = signAccessToken(player);

    return ok(res, {
      message: 'Access granted. Neural link established.',
      token,
      player: {
        id: player.id,
        email: player.email,
        username: player.username,
        status: player.status,
        lastLogin: player.last_login,
        createdAt: player.created_at,
      },
    });
  } catch (err) {
    console.error('[Auth/login]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Me (get current player from token) ──────────────────────────────────────

async function me(req, res) {
  try {
    const { rows } = await query(
      `SELECT id, email, username, status, last_login, created_at
       FROM players WHERE id = $1 LIMIT 1`,
      [req.player.sub]
    );

    if (rows.length === 0) {
      return fail(res, 'Player not found', 404);
    }

    const player = rows[0];
    return ok(res, { player });
  } catch (err) {
    console.error('[Auth/me]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { register, login, me };