require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

// Difficulty rules (source of truth — matches NodeModel in Flutter):
//   standard  → 2 puzzles, 30 s, 0 lives  (all must pass)
//   secured   → 3 puzzles, 25 s, 0 lives
//   critical  → 4 puzzles, 20 s, 0 lives
//   boss      → 5 puzzles, 15 s, 1 life   (can fail once)

const SQL = `
  BEGIN;

  -- Nodes table (static game content per sector)
  CREATE TABLE IF NOT EXISTS nodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_code   TEXT NOT NULL REFERENCES sectors(code) ON DELETE CASCADE,
    node_number   INTEGER NOT NULL,
    difficulty    TEXT NOT NULL DEFAULT 'standard'
                    CHECK (difficulty IN ('standard', 'secured', 'critical', 'boss')),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    puzzle_count  INTEGER NOT NULL DEFAULT 2,
    timer_seconds INTEGER NOT NULL DEFAULT 30,
    lives         INTEGER NOT NULL DEFAULT 0,
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

  -- Add config columns to existing installs (safe no-op on fresh DBs)
  ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS puzzle_count  INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS timer_seconds INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS lives         INTEGER NOT NULL DEFAULT 0;

  -- Seed nodes for Sector A
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order, puzzle_count, timer_seconds, lives)
  VALUES
    ('A', 1,  'standard',  1,  2, 30, 0),
    ('A', 2,  'standard',  2,  2, 30, 0),
    ('A', 3,  'secured',   3,  3, 25, 0),
    ('A', 4,  'standard',  4,  2, 30, 0),
    ('A', 5,  'critical',  5,  4, 20, 0),
    ('A', 6,  'standard',  6,  2, 30, 0),
    ('A', 7,  'secured',   7,  3, 25, 0),
    ('A', 8,  'critical',  8,  4, 20, 0),
    ('A', 9,  'standard',  9,  2, 30, 0),
    ('A', 10, 'boss',      10, 5, 15, 1)
  ON CONFLICT (sector_code, node_number) DO UPDATE SET
    puzzle_count  = EXCLUDED.puzzle_count,
    timer_seconds = EXCLUDED.timer_seconds,
    lives         = EXCLUDED.lives;

  -- Seed nodes for Sector B
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order, puzzle_count, timer_seconds, lives)
  VALUES
    ('B', 1,  'standard',  1,  2, 30, 0),
    ('B', 2,  'standard',  2,  2, 30, 0),
    ('B', 3,  'secured',   3,  3, 25, 0),
    ('B', 4,  'standard',  4,  2, 30, 0),
    ('B', 5,  'critical',  5,  4, 20, 0),
    ('B', 6,  'standard',  6,  2, 30, 0),
    ('B', 7,  'secured',   7,  3, 25, 0),
    ('B', 8,  'critical',  8,  4, 20, 0),
    ('B', 9,  'standard',  9,  2, 30, 0),
    ('B', 10, 'boss',      10, 5, 15, 1)
  ON CONFLICT (sector_code, node_number) DO UPDATE SET
    puzzle_count  = EXCLUDED.puzzle_count,
    timer_seconds = EXCLUDED.timer_seconds,
    lives         = EXCLUDED.lives;

  -- Seed nodes for Sector C
  INSERT INTO nodes (sector_code, node_number, difficulty, sort_order, puzzle_count, timer_seconds, lives)
  VALUES
    ('C', 1,  'standard',  1,  2, 30, 0),
    ('C', 2,  'standard',  2,  2, 30, 0),
    ('C', 3,  'secured',   3,  3, 25, 0),
    ('C', 4,  'standard',  4,  2, 30, 0),
    ('C', 5,  'critical',  5,  4, 20, 0),
    ('C', 6,  'standard',  6,  2, 30, 0),
    ('C', 7,  'secured',   7,  3, 25, 0),
    ('C', 8,  'critical',  8,  4, 20, 0),
    ('C', 9,  'standard',  9,  2, 30, 0),
    ('C', 10, 'boss',      10, 5, 15, 1)
  ON CONFLICT (sector_code, node_number) DO UPDATE SET
    puzzle_count  = EXCLUDED.puzzle_count,
    timer_seconds = EXCLUDED.timer_seconds,
    lives         = EXCLUDED.lives;

  -- Backfill any rows that already exist but have default values
  UPDATE nodes SET puzzle_count = 2, timer_seconds = 30, lives = 0 WHERE difficulty = 'standard';
  UPDATE nodes SET puzzle_count = 3, timer_seconds = 25, lives = 0 WHERE difficulty = 'secured';
  UPDATE nodes SET puzzle_count = 4, timer_seconds = 20, lives = 0 WHERE difficulty = 'critical';
  UPDATE nodes SET puzzle_count = 5, timer_seconds = 15, lives = 1 WHERE difficulty = 'boss';

  COMMIT;
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