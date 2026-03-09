require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id             SERIAL PRIMARY KEY,
        player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});