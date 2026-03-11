require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  -- Daily challenge attempts — one row per player per day
  CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL,           -- the UTC date this challenge belongs to
    completed    BOOLEAN NOT NULL DEFAULT false,
    puzzles_passed INTEGER NOT NULL DEFAULT 0,
    bonus_carrots  INTEGER NOT NULL DEFAULT 0,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(player_id, challenge_date)
  );

  CREATE INDEX IF NOT EXISTS idx_daily_attempts_player
    ON daily_challenge_attempts(player_id);

  -- Add daily_challenges_completed counter to players
  ALTER TABLE players
    ADD COLUMN IF NOT EXISTS daily_challenges_completed INTEGER NOT NULL DEFAULT 0;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Running daily challenge migration…');
    await client.query(SQL);
    console.log('[Migrate] Done ✓');
  } catch (err) {
    console.error('[Migrate] Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();