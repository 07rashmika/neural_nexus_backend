const { query } = require('../db/pool');
const { ok, fail } = require('../utils/response');

// ─── Get all sectors with player progress ────────────────────────────────────

async function getSectors(req, res) {
  const playerId = req.player.sub;

  try {
    // Fetch all sectors joined with this player's progress
    const { rows } = await query(
      `SELECT
         s.code,
         s.name,
         s.subtitle,
         s.total_nodes,
         s.unlock_after,
         s.sort_order,
         COALESCE(np.completed_nodes, 0) AS completed_nodes,
         np.completed_at
       FROM sectors s
       LEFT JOIN node_progress np
         ON np.sector_code = s.code AND np.player_id = $1
       ORDER BY s.sort_order ASC`,
      [playerId]
    );

    // Build a set of fully completed sector codes for unlock logic
    const completedCodes = new Set(
      rows
        .filter(r => r.completed_nodes >= r.total_nodes)
        .map(r => r.code)
    );

    const sectors = rows.map(r => {
      let status;
      if (r.completed_nodes >= r.total_nodes) {
        status = 'completed';
      } else if (!r.unlock_after || completedCodes.has(r.unlock_after)) {
        status = r.completed_nodes > 0 ? 'partial' : 'available';
      } else {
        status = 'locked';
      }

      return {
        code:             r.code,
        name:             r.name,
        subtitle:         r.subtitle,
        totalNodes:       r.total_nodes,
        completedNodes:   r.completed_nodes,
        unlockAfter:      r.unlock_after,
        status,
        unlockRequirement: r.unlock_after
          ? `Complete Sector ${r.unlock_after}`
          : null,
        completedAt: r.completed_at,
      };
    });

    const totalNodes     = sectors.reduce((s, r) => s + r.totalNodes, 0);
    const completedNodes = sectors.reduce((s, r) => s + r.completedNodes, 0);

    return ok(res, { sectors, totalNodes, completedNodes });
  } catch (err) {
    console.error('[Sector/getSectors]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Update node progress for a sector ──────────────────────────────────────

async function updateProgress(req, res) {
  const playerId = req.player.sub;
  const { sectorCode, completedNodes } = req.body;

  if (!sectorCode || completedNodes === undefined) {
    return fail(res, 'sectorCode and completedNodes are required', 400);
  }

  try {
    // Verify sector exists
    const { rows: sectorRows } = await query(
      'SELECT code, total_nodes, unlock_after FROM sectors WHERE code = $1',
      [sectorCode]
    );
    if (sectorRows.length === 0) return fail(res, 'Sector not found', 404);

    const sector = sectorRows[0];

    // Check unlock requirement
    if (sector.unlock_after) {
      const { rows: prereq } = await query(
        `SELECT completed_nodes, total_nodes FROM node_progress np
         JOIN sectors s ON s.code = np.sector_code
         WHERE np.player_id = $1 AND np.sector_code = $2`,
        [playerId, sector.unlock_after]
      );
      const prereqDone =
        prereq.length > 0 && prereq[0].completed_nodes >= prereq[0].total_nodes;
      if (!prereqDone) {
        return fail(res, `Complete Sector ${sector.unlock_after} first`, 403);
      }
    }

    const clamped = Math.min(Math.max(0, completedNodes), sector.total_nodes);
    const isComplete = clamped >= sector.total_nodes;

    // Upsert progress
    const { rows } = await query(
      `INSERT INTO node_progress (player_id, sector_code, completed_nodes, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (player_id, sector_code)
       DO UPDATE SET
         completed_nodes = GREATEST(node_progress.completed_nodes, $3),
         completed_at    = CASE WHEN $4 IS NOT NULL THEN $4 ELSE node_progress.completed_at END,
         updated_at      = NOW()
       RETURNING *`,
      [playerId, sectorCode, clamped, isComplete ? new Date().toISOString() : null]
    );

    return ok(res, {
      progress: {
        sectorCode,
        completedNodes: rows[0].completed_nodes,
        totalNodes: sector.total_nodes,
        isComplete,
      },
    });
  } catch (err) {
    console.error('[Sector/updateProgress]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { getSectors, updateProgress };