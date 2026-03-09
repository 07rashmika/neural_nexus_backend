require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

const SQL = `
  -- Players table
  CREATE TABLE IF NOT EXISTS players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'banned')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login  TIMESTAMPTZ
  );

  -- Auto-update updated_at on row change
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS players_updated_at ON players;

  CREATE TRIGGER players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  -- Refresh tokens table (for token rotation / logout)
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_player
    ON refresh_tokens(player_id);

  -- Game sessions table
  CREATE TABLE IF NOT EXISTS game_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    score       INTEGER DEFAULT 0,
    metadata    JSONB DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_game_sessions_player
    ON game_sessions(player_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Running migrations…');
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