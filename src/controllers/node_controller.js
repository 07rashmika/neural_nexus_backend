const { query } = require('../db/pool');
const { ok, fail } = require('../utils/response');

const MAX_CARROTS = 3;

//get nodes for a sector
async function getNodes(req, res) {
  const playerId    = req.player.sub;
  const { sectorCode } = req.params;

  try {
    const { rows: sectorRows } = await query(
      `SELECT s.code, s.name, s.subtitle, s.unlock_after,
              COALESCE(np.completed_nodes, 0) AS completed_nodes,
              COALESCE(np.carrots_used, 0)    AS carrots_used,
              s.total_nodes
       FROM sectors s
       LEFT JOIN node_progress np
         ON np.sector_code = s.code AND np.player_id = $1
       WHERE s.code = $2`,
      [playerId, sectorCode]
    );

    if (sectorRows.length === 0) return fail(res, 'Sector not found', 404);

    const sector = sectorRows[0];

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

    const { rows: nodeRows } = await query(
      `SELECT n.id, n.node_number, n.difficulty, n.sort_order, nc.completed_at
       FROM nodes n
       LEFT JOIN node_completions nc
         ON nc.node_id = n.id AND nc.player_id = $1
       WHERE n.sector_code = $2
       ORDER BY n.sort_order ASC`,
      [playerId, sectorCode]
    );

    const completedIds = new Set(nodeRows.filter(n => n.completed_at).map(n => n.id));
    const firstIncompleteIndex = nodeRows.findIndex(n => !completedIds.has(n.id));

    const nodes = nodeRows.map((n, i) => ({
      id:          n.id,
      nodeNumber:  n.node_number,
      difficulty:  n.difficulty,
      isCompleted: !!n.completed_at,
      isCurrent:   i === firstIncompleteIndex,
      isLocked:    firstIncompleteIndex !== -1 && i > firstIncompleteIndex,
      completedAt: n.completed_at,
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
      carrotsRemaining: MAX_CARROTS - sector.carrots_used,
      maxCarrots:       MAX_CARROTS,
    });
  } catch (err) {
    console.error('[Node/getNodes]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

//carrot hint
async function useHint(req, res) {
  const playerId    = req.player.sub;
  const { sectorCode } = req.body;

  if (!sectorCode) return fail(res, 'sectorCode is required', 400);

  try {
    await query(
      `INSERT INTO node_progress (player_id, sector_code, completed_nodes, carrots_used, updated_at)
       VALUES ($1, $2, 0, 0, NOW())
       ON CONFLICT (player_id, sector_code) DO NOTHING`,
      [playerId, sectorCode]
    );

    const { rows } = await query(
      'SELECT carrots_used FROM node_progress WHERE player_id = $1 AND sector_code = $2',
      [playerId, sectorCode]
    );

    const used = rows[0]?.carrots_used ?? 0;
    if (used >= MAX_CARROTS) {
      return fail(res, 'No carrots remaining for this sector', 400);
    }

    const { rows: updated } = await query(
      `UPDATE node_progress
       SET carrots_used = carrots_used + 1, updated_at = NOW()
       WHERE player_id = $1 AND sector_code = $2
       RETURNING carrots_used`,
      [playerId, sectorCode]
    );

    return ok(res, {
      carrotsUsed:      updated[0].carrots_used,
      carrotsRemaining: MAX_CARROTS - updated[0].carrots_used,
      maxCarrots:       MAX_CARROTS,
    });
  } catch (err) {
    console.error('[Node/useHint]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

//pass a node
async function completeNode(req, res) {
  const playerId = req.player.sub;
  const { nodeId } = req.body;

  if (!nodeId) return fail(res, 'nodeId is required', 400);

  try {
    const { rows: nodeRows } = await query(
      'SELECT id, sector_code, node_number FROM nodes WHERE id = $1',
      [nodeId]
    );
    if (nodeRows.length === 0) return fail(res, 'Node not found', 404);

    const node = nodeRows[0];

    await query(
      `INSERT INTO node_completions (player_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id, node_id) DO NOTHING`,
      [playerId, nodeId]
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS completed_count
       FROM node_completions nc
       JOIN nodes n ON n.id = nc.node_id
       WHERE nc.player_id = $1 AND n.sector_code = $2`,
      [playerId, node.sector_code]
    );

    const completedCount = parseInt(countRows[0].completed_count);

    const { rows: totalRows } = await query(
      'SELECT total_nodes FROM sectors WHERE code = $1',
      [node.sector_code]
    );
    const totalNodes = totalRows[0].total_nodes;
    const isComplete = completedCount >= totalNodes;

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

    //increment streak on node completion
    const { rows: streakRows } = await query(
      `UPDATE players
       SET streak = streak + 1
       WHERE id = $1
       RETURNING streak`,
      [playerId]
    );
    const newStreak = streakRows[0].streak;

    return ok(res, {
      nodeId,
      sectorCode:     node.sector_code,
      completedNodes: completedCount,
      totalNodes,
      sectorComplete: isComplete,
      newStreak,
    });
  } catch (err) {
    console.error('[Node/completeNode]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

//fail a node
async function failNode(req, res) {
  const playerId = req.player.sub;

  try {
    //reset streak on node failure
    const { rows } = await query(
      `UPDATE players
       SET streak = 0
       WHERE id = $1
       RETURNING streak`,
      [playerId]
    );

    return ok(res, { newStreak: rows[0].streak });
  } catch (err) {
    console.error('[Node/failNode]', err.message);
    return fail(res, 'Internal server error', 500);
  }
}

module.exports = { getNodes, useHint, completeNode, failNode };