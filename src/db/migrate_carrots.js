require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  ALTER TABLE node_progress
  ADD COLUMN IF NOT EXISTS carrots_used INTEGER NOT NULL DEFAULT 0;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Adding carrots_used to node_progress…');
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