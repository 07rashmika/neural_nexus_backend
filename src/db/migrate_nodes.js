require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  -- Nodes table (static game content per sector)
  CREATE TABLE IF NOT EXISTS nodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_code   TEXT NOT NULL REFERENCES sectors(code) ON DELETE CASCADE,
    node_number   INTEGER NOT NULL,
    difficulty    TEXT NOT NULL DEFAULT 'standard'
                    CHECK (difficulty IN ('standard', 'secured', 'critical', 'boss')),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sector_code, node_number)
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_sector
    ON nodes(sector_code);

  -- Player node completions
  CREATE TABLE IF NOT EXISTS node_completions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    node_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, node_id)
  );

  CREATE INDEX IF NOT EXISTS idx_node_completions_player
    ON node_completions(player_id);

  -- Seed nodes for Sector A
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order)
  VALUES
    ('A', 1,  'standard',  1),
    ('A', 2,  'standard',  2),
    ('A', 3,  'secured',   3),
    ('A', 4,  'standard',  4),
    ('A', 5,  'critical',  5),
    ('A', 6,  'standard',  6),
    ('A', 7,  'secured',   7),
    ('A', 8,  'critical',  8),
    ('A', 9,  'standard',  9),
    ('A', 10, 'boss',      10)
  ON CONFLICT (sector_code, node_number) DO NOTHING;

  -- Seed nodes for Sector B
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order)
  VALUES
    ('B', 1,  'standard',  1),
    ('B', 2,  'standard',  2),
    ('B', 3,  'secured',   3),
    ('B', 4,  'standard',  4),
    ('B', 5,  'critical',  5),
    ('B', 6,  'standard',  6),
    ('B', 7,  'secured',   7),
    ('B', 8,  'critical',  8),
    ('B', 9,  'standard',  9),
    ('B', 10, 'boss',      10)
  ON CONFLICT (sector_code, node_number) DO NOTHING;

  -- Seed nodes for Sector C
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order)
  VALUES
    ('C', 1,  'standard',  1),
    ('C', 2,  'standard',  2),
    ('C', 3,  'secured',   3),
    ('C', 4,  'standard',  4),
    ('C', 5,  'critical',  5),
    ('C', 6,  'standard',  6),
    ('C', 7,  'secured',   7),
    ('C', 8,  'critical',  8),
    ('C', 9,  'standard',  9),
    ('C', 10, 'boss',      10)
  ON CONFLICT (sector_code, node_number) DO NOTHING;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Running node migrations…');
    await client.query(SQL);
    console.log('[Migrate] Nodes done ✓');
  } catch (err) {
    console.error('[Migrate] Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();