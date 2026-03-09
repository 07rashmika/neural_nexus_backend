require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  ALTER TABLE players
    ADD COLUMN IF NOT EXISTS username        TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url      TEXT,
    ADD COLUMN IF NOT EXISTS callsign        TEXT,
    ADD COLUMN IF NOT EXISTS difficulty      TEXT DEFAULT 'normal'
                               CHECK (difficulty IN ('easy', 'normal', 'hard', 'nightmare')),
    ADD COLUMN IF NOT EXISTS bio             TEXT,
    ADD COLUMN IF NOT EXISTS intel_points    DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS level           INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS position        TEXT NOT NULL DEFAULT 'Recruit',
    ADD COLUMN IF NOT EXISTS streak          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shield_count    INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS chain_mult      INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Adding profile columns…');
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