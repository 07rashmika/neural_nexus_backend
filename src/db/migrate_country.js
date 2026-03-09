require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  ALTER TABLE players
    ADD COLUMN IF NOT EXISTS country TEXT;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Adding country column…');
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