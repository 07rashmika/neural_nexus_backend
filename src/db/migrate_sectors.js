require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  -- Sectors table (static game content)
  CREATE TABLE IF NOT EXISTS sectors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT UNIQUE NOT NULL,        -- 'A', 'B', 'C'
    name          TEXT NOT NULL,               -- 'Sector A'
    subtitle      TEXT NOT NULL,               -- 'Memory Bank'
    total_nodes   INTEGER NOT NULL DEFAULT 10,
    unlock_after  TEXT REFERENCES sectors(code) ON DELETE SET NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
  );

  -- Player node progress
  CREATE TABLE IF NOT EXISTS node_progress (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    sector_code   TEXT NOT NULL REFERENCES sectors(code) ON DELETE CASCADE,
    completed_nodes INTEGER NOT NULL DEFAULT 0,
    completed_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, sector_code)
  );

  CREATE INDEX IF NOT EXISTS idx_node_progress_player
    ON node_progress(player_id);

  -- Seed default sectors if not present
  INSERT INTO sectors (code, name, subtitle, total_nodes, unlock_after, sort_order)
  VALUES
    ('A', 'Sector A', 'Memory Bank',    10, NULL, 1),
    ('B', 'Sector B', 'Data Vault',     10, 'A',  2),
    ('C', 'Sector C', 'Archive Ruins',  10, 'B',  3)
  ON CONFLICT (code) DO NOTHING;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Running sector migrations…');
    await client.query(SQL);
    console.log('[Migrate] Sectors done ✓');
  } catch (err) {
    console.error('[Migrate] Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();