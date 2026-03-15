const { pool } = require('../db/pool');

const MAX_CHAIN = 5;

const LEVELS = [
  { min: 0,     level: 1, position: 'Recruit'    },
  { min: 1000,  level: 2, position: 'Operative'  },
  { min: 3000,  level: 3, position: 'Agent'       },
  { min: 7000,  level: 4, position: 'Specialist'  },
  { min: 15000, level: 5, position: 'Commander'   },
];

function _calcLevel(intelPoints) {
  let result = LEVELS[0];
  for (const entry of LEVELS) {
    if (intelPoints >= entry.min) result = entry;
  }
  return result;
}

function _chainToMult(chain) {
  return Math.min(Math.max(chain, 1), MAX_CHAIN);
}

async function _recomputeShields(client, playerId) {
  await client.query(
    `UPDATE players
     SET
       shield_count = CASE
         WHEN last_shield_lost_at IS NULL THEN shield_count
         ELSE LEAST(
           3,
           shield_count + FLOOR(
             EXTRACT(EPOCH FROM (NOW() - last_shield_lost_at)) / 600
           )::int
         )
       END,
       last_shield_lost_at = CASE
         WHEN last_shield_lost_at IS NOT NULL
          AND LEAST(
                3,
                shield_count + FLOOR(
                  EXTRACT(EPOCH FROM (NOW() - last_shield_lost_at)) / 600
                )::int
              ) >= 3
         THEN NULL
         WHEN last_shield_lost_at IS NOT NULL
          AND FLOOR(
                EXTRACT(EPOCH FROM (NOW() - last_shield_lost_at)) / 600
              )::int > 0
         THEN last_shield_lost_at + (
                FLOOR(
                  EXTRACT(EPOCH FROM (NOW() - last_shield_lost_at)) / 600
                )::int * INTERVAL '10 minutes'
              )
         ELSE last_shield_lost_at
       END
     WHERE id = $1`,
    [playerId]
  );

  const { rows } = await client.query(
    `SELECT shield_count, last_shield_lost_at FROM players WHERE id = $1`,
    [playerId]
  );
  return rows[0];
}

//streak will not updated here it will manage in node controller:
//completeNode = streak++
//node failed  = streak = 0
async function submitRound(req, res) {
  const {
    round, answer, correct, time_taken, carrots_earned,
    chain     = 0,
    time_left = 0,
  } = req.body;

  const playerId = req.player.sub;
  const client   = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO game_rounds
         (player_id, round, answer, correct, time_taken, carrots_earned, played_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [playerId, round, answer, correct, time_taken, carrots_earned]
    );

    const { rows: pr } = await client.query(
      `SELECT intel_points, level, position, streak, chain_mult
       FROM players WHERE id = $1`,
      [playerId]
    );
    const p        = pr[0];
    const oldIntel = parseFloat(p.intel_points);
    const oldLevel = p.level;

    const newChain    = correct ? chain + 1 : 0;
    const multiplier  = _chainToMult(newChain);
    const intelEarned = correct ? (10 + time_left) * multiplier : 0;

    const newIntelTotal = oldIntel + intelEarned;
    const { level: newLevel, position: newPosition } = _calcLevel(newIntelTotal);
    const levelUp      = newLevel > oldLevel;
    const newChainMult = Math.max(p.chain_mult, multiplier);

    //streak will intentionally not updated here
    await client.query(
      `UPDATE players
       SET intel_points = $1,
           level        = $2,
           position     = $3,
           chain_mult   = $4,
           carrots      = carrots + $5
       WHERE id = $6`,
      [
        newIntelTotal,
        newLevel,
        newPosition,
        newChainMult,
        correct && carrots_earned > 0 ? carrots_earned : 0,
        playerId,
      ]
    );

    let shieldData = null;
    if (!correct) {
      await _recomputeShields(client, playerId);
      const { rows } = await client.query(
        `UPDATE players
         SET shield_count        = GREATEST(shield_count - 1, 0),
             last_shield_lost_at = CASE
               WHEN shield_count > 0 THEN NOW()
               ELSE last_shield_lost_at
             END
         WHERE id = $1
         RETURNING shield_count, last_shield_lost_at`,
        [playerId]
      );
      shieldData = rows[0];
    }

    await client.query('COMMIT');

    res.json({
      success:      true,
      shieldData,
      intelEarned,
      newIntelTotal,
      newChainMult: multiplier,
      newLevel,
      newPosition,
      newStreak:    p.streak,   //return current streak unchanged
      levelUp,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Game submit error:', err);
    res.status(500).json({ error: 'Failed to record round' });
  } finally {
    client.release();
  }
}

async function getShieldStatus(req, res) {
  const playerId = req.player.sub;
  const client   = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await _recomputeShields(client, playerId);
    await client.query('COMMIT');
    res.json({ success: true, ...row });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Shield status error:', err);
    res.status(500).json({ error: 'Failed to get shield status' });
  } finally {
    client.release();
  }
}

async function getLeaderboard(req, res) {
  const currentPlayerId = req.player.sub; //highlight current player in UI
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.username,
         p.avatar_url,
         p.intel_points,
         p.level,
         p.position,
         p.streak,
         p.daily_challenges_completed,
         COUNT(gr.id)                                 AS rounds_played,
         SUM(CASE WHEN gr.correct THEN 1 ELSE 0 END) AS correct_answers
       FROM players p
       LEFT JOIN game_rounds gr ON gr.player_id = p.id
       GROUP BY p.id
       ORDER BY p.intel_points DESC
       LIMIT 20`
    );

    // Attach rank and isCurrentPlayer
    const leaderboard = rows.map((r, i) => ({
      ...r,
      rank:            i + 1,
      isCurrentPlayer: r.id === currentPlayerId,
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}

//still not implemented in FE
async function getMyStats(req, res) {
  const playerId = req.player.sub;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)                                  AS total_rounds,
              SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct,
              SUM(carrots_earned)                       AS carrots_earned,
              AVG(time_taken)                           AS avg_time
       FROM game_rounds WHERE player_id = $1`,
      [playerId]
    );
    res.json({ success: true, stats: rows[0] });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = { submitRound, getLeaderboard, getMyStats, getShieldStatus };