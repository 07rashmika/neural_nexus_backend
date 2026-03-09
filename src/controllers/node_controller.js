const { query } = require('../db/pool');
const { ok, fail } = require('../utils/response');

// ─── Get nodes for a sector with player completion status ─────────────────────

async function getNodes(req, res) {
  const playerId   = req.player.sub;
  const { sectorCode } = req.params;

  try {
    // Verify sector exists and player has access
    const { rows: sectorRows } = await query(
      `SELECT s.code, s.name, s.subtitle, s.unlock_after,
              COALESCE(np.completed_nodes, 0) AS completed_nodes,
              s.total_nodes
       FROM sectors s
       LEFT JOIN node_progress np
         ON np.sector_code = s.code AND np.player_id = $1
       WHERE s.code = $2`,
      [playerId, sectorCode]
    );

    if (sectorRows.length === 0) return fail(res, 'Sector not found', 404);

    const sector = sectorRows[0];

    // Check unlock requirement
    if (sector.unlock_after) {
      const { rows: prereq } = await query(
        `SELECT np.completed_nodes, s.total_nodes
         FROM node_progress np
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

    // Fetch nodes with completion status
    const { rows: nodeRows } = await query(
      `SELECT
         n.id,
         n.node_number,
         n.difficulty,
         n.sort_order,
         nc.completed_at
       FROM nodes n
       LEFT JOIN node_completions nc
         ON nc.node_id = n.id AND nc.player_id = $1
       WHERE n.sector_code = $2
       ORDER BY n.sort_order ASC`,
      [playerId, sectorCode]
    );

    // Determine which node is "current" (first incomplete node)
    const completedIds = new Set(
      nodeRows.filter(n => n.completed_at).map(n => n.id)
    );
    const firstIncompleteIndex = nodeRows.findIndex(n => !completedIds.has(n.id));

    const nodes = nodeRows.map((n, i) => ({
      id:           n.id,
      nodeNumber:   n.node_number,
      difficulty:   n.difficulty,
      isCompleted:  !!n.completed_at,
      isCurrent:    i === firstIncompleteIndex,
      isLocked:     firstIncompleteIndex !== -1 && i > firstIncompleteIndex,
      completedAt:  n.completed_at,
    }));

    return ok(res, {
      sector: {
        code:           sector.code,
        name:           sector.name,
        subtitle:       sector.subtitle,
        totalNodes:     sector.total_nodes,
        completedNodes: sector.completed_nodes,
      },
      nodes,
    });
  } catch (err) {
    console.error('[Node/getNodes]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

// ─── Complete a node ──────────────────────────────────────────────────────────

async function completeNode(req, res) {
  const playerId = req.player.sub;
  const { nodeId } = req.body;

  if (!nodeId) return fail(res, 'nodeId is required', 400);

  try {
    // Get the node and its sector
    const { rows: nodeRows } = await query(
      'SELECT id, sector_code, node_number FROM nodes WHERE id = $1',
      [nodeId]
    );
    if (nodeRows.length === 0) return fail(res, 'Node not found', 404);

    const node = nodeRows[0];

    // Record completion (ignore if already completed)
    await query(
      `INSERT INTO node_completions (player_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id, node_id) DO NOTHING`,
      [playerId, nodeId]
    );

    // Update node_progress for the sector
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS completed_count
       FROM node_completions nc
       JOIN nodes n ON n.id = nc.node_id
       WHERE nc.player_id = $1 AND n.sector_code = $2`,
      [playerId, node.sector_code]
    );

    const completedCount = parseInt(countRows[0].completed_count);

    // Get total nodes in sector
    const { rows: totalRows } = await query(
      'SELECT total_nodes FROM sectors WHERE code = $1',
      [node.sector_code]
    );
    const totalNodes  = totalRows[0].total_nodes;
    const isComplete  = completedCount >= totalNodes;

    // Upsert node_progress
    await query(
      `INSERT INTO node_progress (player_id, sector_code, completed_nodes, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (player_id, sector_code)
       DO UPDATE SET
         completed_nodes = $3,
         completed_at    = CASE WHEN $4 IS NOT NULL THEN $4 ELSE node_progress.completed_at END,
         updated_at      = NOW()`,
      [playerId, node.sector_code, completedCount, isComplete ? new Date().toISOString() : null]
    );

    return ok(res, {
      nodeId,
      sectorCode:     node.sector_code,
      completedNodes: completedCount,
      totalNodes,
      sectorComplete: isComplete,
    });
  } catch (err) {
    console.error('[Node/completeNode]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { getNodes, completeNode };