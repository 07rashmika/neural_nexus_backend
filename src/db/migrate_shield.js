require('dotenv').config();
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS last_shield_lost_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('✓ Added last_shield_lost_at column');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});