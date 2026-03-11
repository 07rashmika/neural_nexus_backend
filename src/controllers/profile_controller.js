const { validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { ok, fail } = require('../utils/response');

const MAX_SHIELDS = 3;
const SHIELD_REGEN_MS = 10 * 60 * 1000; // 10 minutes — must match game_controller & Flutter

/**
 * Calculate regenerated shields since last_shield_lost_at.
 * Returns { shieldCount, lastShieldLostAt }
 */
function calcShields(currentShields, lastShieldLostAt) {
  if (currentShields >= MAX_SHIELDS || !lastShieldLostAt) {
    return { shieldCount: currentShields, lastShieldLostAt: lastShieldLostAt || null };
  }

  const now = Date.now();
  const lostAt = new Date(lastShieldLostAt).getTime();
  const elapsed = now - lostAt;
  const regened = Math.floor(elapsed / SHIELD_REGEN_MS);

  if (regened <= 0) {
    return { shieldCount: currentShields, lastShieldLostAt };
  }

  const newCount = Math.min(currentShields + regened, MAX_SHIELDS);
  const newLastLostAt = newCount >= MAX_SHIELDS
    ? null
    : new Date(lostAt + regened * SHIELD_REGEN_MS).toISOString();

  return { shieldCount: newCount, lastShieldLostAt: newLastLostAt };
}

// ─── Setup Profile (one-time) ─────────────────────────────────────────────────

async function setupProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, 'Validation failed', 422, errors.array());

  const playerId = req.player.sub;
  const { username, avatarUrl, callsign, country } = req.body;

  try {
    const taken = await query(
      'SELECT id FROM players WHERE username = $1 AND id != $2 LIMIT 1',
      [username, playerId]
    );
    if (taken.rowCount > 0) return fail(res, 'Username already taken', 409);

    const { rows } = await query(
      `UPDATE players SET
        username = $1, avatar_url = $2, callsign = $3,
        country = $4, profile_complete = true
       WHERE id = $5
       RETURNING id, email, username, avatar_url, callsign, country,
         intel_points, level, position, streak, shield_count, chain_mult,
         profile_complete, created_at, last_shield_lost_at`,
      [username, avatarUrl, callsign || null, country || null, playerId]
    );

    if (rows.length === 0) return fail(res, 'Player not found', 404);

    const row = rows[0];
    const { shieldCount, lastShieldLostAt } = calcShields(
      row.shield_count, row.last_shield_lost_at
    );

    if (shieldCount !== row.shield_count) {
      await query(
        'UPDATE players SET shield_count = $1, last_shield_lost_at = $2 WHERE id = $3',
        [shieldCount, lastShieldLostAt, playerId]
      );
    }

    return ok(res, { player: _format(row, shieldCount, lastShieldLostAt) });
  } catch (err) {
    console.error('[Profile/setup]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Get Profile ──────────────────────────────────────────────────────────────

async function getProfile(req, res) {
  try {
    const { rows } = await query(
      `SELECT id, email, username, avatar_url, callsign, country,
              intel_points, level, position, streak, shield_count, chain_mult,
              profile_complete, created_at, last_login, last_shield_lost_at
       FROM players WHERE id = $1 LIMIT 1`,
      [req.player.sub]
    );

    if (rows.length === 0) return fail(res, 'Player not found', 404);

    const row = rows[0];
    const { shieldCount, lastShieldLostAt } = calcShields(
      row.shield_count, row.last_shield_lost_at
    );

    if (shieldCount !== row.shield_count) {
      await query(
        'UPDATE players SET shield_count = $1, last_shield_lost_at = $2 WHERE id = $3',
        [shieldCount, lastShieldLostAt, req.player.sub]
      );
    }

    return ok(res, { player: _format(row, shieldCount, lastShieldLostAt) });
  } catch (err) {
    console.error('[Profile/get]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Consume Shield ───────────────────────────────────────────────────────────

async function consumeShield(req, res) {
  try {
    const { rows } = await query(
      'SELECT shield_count, last_shield_lost_at FROM players WHERE id = $1 LIMIT 1',
      [req.player.sub]
    );

    if (rows.length === 0) return fail(res, 'Player not found', 404);

    const row = rows[0];
    const { shieldCount } = calcShields(row.shield_count, row.last_shield_lost_at);

    if (shieldCount <= 0) return fail(res, 'No shields available', 400);

    const newCount = shieldCount - 1;
    const wasFullBefore = shieldCount >= MAX_SHIELDS;
    const now = new Date().toISOString();
    const newLastLostAt = wasFullBefore ? now : row.last_shield_lost_at;

    await query(
      'UPDATE players SET shield_count = $1, last_shield_lost_at = $2, updated_at = NOW() WHERE id = $3',
      [newCount, newLastLostAt, req.player.sub]
    );

    return ok(res, {
      shieldCount: newCount,
      lastShieldLostAt: newLastLostAt,
      secondsUntilNextShield: SHIELD_REGEN_MS / 1000,
    });
  } catch (err) {
    console.error('[Profile/consumeShield]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _format(row, shieldCount, lastShieldLostAt) {
  return {
    id:               row.id,
    email:            row.email,
    username:         row.username,
    avatarUrl:        row.avatar_url,
    callsign:         row.callsign,
    country:          row.country,
    intelPoints:      parseFloat(row.intel_points),
    level:            row.level,
    position:         row.position,
    streak:           row.streak,
    shieldCount:      shieldCount ?? row.shield_count,
    lastShieldLostAt: lastShieldLostAt ?? row.last_shield_lost_at ?? null,
    chainMultiplier:  row.chain_mult,
    profileComplete:  row.profile_complete,
    createdAt:        row.created_at,
    lastLogin:        row.last_login,
  };
}

async function updateUsername(req, res) {
  const playerId      = req.player.sub;
  const { username }  = req.body;

  if (!username || username.trim().length < 3) {
    return fail(res, 'Username must be at least 3 characters', 400);
  }

  const clean = username.trim().toLowerCase();

  try {
    // Check uniqueness
    const { rows: existing } = await query(
      'SELECT id FROM players WHERE username = $1 AND id != $2',
      [clean, playerId]
    );
    if (existing.length > 0) {
      return fail(res, 'Username already taken', 409);
    }

    await query(
      'UPDATE players SET username = $1, updated_at = NOW() WHERE id = $2',
      [clean, playerId]
    );

    return ok(res, { username: clean });
  } catch (err) {
    console.error('[Profile/updateUsername]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { setupProfile, getProfile, consumeShield, updateUsername };