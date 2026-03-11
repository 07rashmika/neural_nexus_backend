require('dotenv').config();
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id             SERIAL PRIMARY KEY,
        player_id      INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        round          INTEGER NOT NULL,
        answer         INTEGER NOT NULL,
        correct        BOOLEAN NOT NULL,
        time_taken     INTEGER NOT NULL,
        carrots_earned INTEGER NOT NULL DEFAULT 0,
        played_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ Created game_rounds table');

    await client.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS carrots INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('✓ Added carrots column to players');

    // Required by game_controller shield logic — missing from previous migration
    await client.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS last_shield_lost_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('✓ Added last_shield_lost_at column to players');

    await client.query('COMMIT');
    console.log('✓ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});