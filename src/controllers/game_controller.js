// src/controllers/game_controller.js
const { pool } = require('../db/pool');

async function submitRound(req, res) {
  const { round, answer, correct, time_taken, carrots_earned } = req.body;
  const playerId = req.player.id;

  try {
    await pool.query(
      `INSERT INTO game_rounds
         (player_id, round, answer, correct, time_taken, carrots_earned, played_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [playerId, round, answer, correct, time_taken, carrots_earned]
    );

    if (correct && carrots_earned > 0) {
      await pool.query(
        `UPDATE players SET carrots = carrots + $1 WHERE id = $2`,
        [carrots_earned, playerId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Game submit error:', err);
    res.status(500).json({ error: 'Failed to record round' });
  }
}

async function getLeaderboard(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.username, p.avatar_url, p.carrots,
              COUNT(gr.id)                                    AS rounds_played,
              SUM(CASE WHEN gr.correct THEN 1 ELSE 0 END)    AS correct_answers
       FROM players p
       LEFT JOIN game_rounds gr ON gr.player_id = p.id
       GROUP BY p.id
       ORDER BY p.carrots DESC
       LIMIT 20`
    );
    res.json({ success: true, leaderboard: rows });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}

async function getMyStats(req, res) {
  const playerId = req.player.id;
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                          AS total_rounds,
         SUM(CASE WHEN correct THEN 1 ELSE 0 END)         AS correct,
         SUM(carrots_earned)                               AS carrots_earned,
         AVG(time_taken)                                   AS avg_time
       FROM game_rounds
       WHERE player_id = $1`,
      [playerId]
    );
    res.json({ success: true, stats: rows[0] });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = { submitRound, getLeaderboard, getMyStats };