// src/controllers/daily_challenge_controller.js
const { query } = require('../db/pool');
const { ok, fail } = require('../utils/response');

const PUZZLE_COUNT   = 5;
const TIMER_SECONDS  = 12;   // strict — tighter than boss nodes
const BONUS_CARROTS  = 10;

// Today's date in UTC as a string YYYY-MM-DD
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ── GET /api/daily/status ─────────────────────────────────────────────────────
// Returns whether the player has already attempted/completed today's challenge
async function getStatus(req, res) {
  const playerId = req.player.sub;
  const today    = todayUTC();

  try {
    const { rows: playerRows } = await query(
      `SELECT daily_challenges_completed FROM players WHERE id = $1`,
      [playerId]
    );

    const { rows: attemptRows } = await query(
      `SELECT completed, puzzles_passed, bonus_carrots, attempted_at, completed_at
       FROM daily_challenge_attempts
       WHERE player_id = $1 AND challenge_date = $2`,
      [playerId, today]
    );

    const attempt = attemptRows[0] ?? null;

    // Seconds until midnight UTC (when next challenge unlocks)
    const now          = new Date();
    const midnight     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const secondsUntilNext = Math.floor((midnight - now) / 1000);

    return ok(res, {
      today,
      alreadyAttempted:  !!attempt,
      alreadyCompleted:  attempt?.completed ?? false,
      puzzlesPassed:     attempt?.puzzles_passed ?? 0,
      bonusCarrots:      attempt?.bonus_carrots ?? 0,
      totalCompleted:    playerRows[0].daily_challenges_completed,
      secondsUntilNext,
      config: {
        puzzleCount:  PUZZLE_COUNT,
        timerSeconds: TIMER_SECONDS,
        bonusCarrots: BONUS_CARROTS,
      },
    });
  } catch (err) {
    console.error('[Daily/getStatus]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ── POST /api/daily/start ─────────────────────────────────────────────────────
// Creates the attempt row — blocks if already attempted today
async function startChallenge(req, res) {
  const playerId = req.player.sub;
  const today    = todayUTC();

  try {
    const { rows: existing } = await query(
      `SELECT id FROM daily_challenge_attempts
       WHERE player_id = $1 AND challenge_date = $2`,
      [playerId, today]
    );

    if (existing.length > 0) {
      return fail(res, 'Already attempted today\'s challenge', 409);
    }

    await query(
      `INSERT INTO daily_challenge_attempts (player_id, challenge_date)
       VALUES ($1, $2)`,
      [playerId, today]
    );

    return ok(res, {
      started:      true,
      puzzleCount:  PUZZLE_COUNT,
      timerSeconds: TIMER_SECONDS,
    });
  } catch (err) {
    console.error('[Daily/startChallenge]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ── POST /api/daily/complete ──────────────────────────────────────────────────
// Called when the gauntlet ends (pass or fail)
// Body: { passed: bool, puzzlesPassed: int }
async function completeChallenge(req, res) {
  const playerId              = req.player.sub;
  const today                 = todayUTC();
  const { passed, puzzlesPassed = 0 } = req.body;

  try {
    const { rows: existing } = await query(
      `SELECT id, completed FROM daily_challenge_attempts
       WHERE player_id = $1 AND challenge_date = $2`,
      [playerId, today]
    );

    if (existing.length === 0) {
      return fail(res, 'No active challenge found for today', 404);
    }
    if (existing[0].completed) {
      return fail(res, 'Challenge already completed', 409);
    }

    const earnedCarrots = passed ? BONUS_CARROTS : 0;

    // Update attempt row
    await query(
      `UPDATE daily_challenge_attempts
       SET completed     = $1,
           puzzles_passed = $2,
           bonus_carrots  = $3,
           completed_at   = NOW()
       WHERE player_id = $4 AND challenge_date = $5`,
      [passed, puzzlesPassed, earnedCarrots, playerId, today]
    );

    if (passed) {
      // Increment player's total daily_challenges_completed + award carrots
      await query(
        `UPDATE players
         SET daily_challenges_completed = daily_challenges_completed + 1,
             carrots = carrots + $1
         WHERE id = $2`,
        [earnedCarrots, playerId]
      );
    }

    // Fetch updated total
    const { rows: playerRows } = await query(
      `SELECT daily_challenges_completed, carrots FROM players WHERE id = $1`,
      [playerId]
    );

    return ok(res, {
      passed,
      puzzlesPassed,
      bonusCarrots:   earnedCarrots,
      totalCompleted: playerRows[0].daily_challenges_completed,
      totalCarrots:   playerRows[0].carrots,
    });
  } catch (err) {
    console.error('[Daily/completeChallenge]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { getStatus, startChallenge, completeChallenge };