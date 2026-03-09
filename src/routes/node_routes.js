const { Router } = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { getNodes, completeNode } = require('../controllers/node_controller');

const router = Router();

// GET /api/nodes/:sectorCode  — fetch nodes for a sector
router.get('/:sectorCode', requireAuth, getNodes);

// POST /api/nodes/complete  — mark a node as completed
router.post('/complete', requireAuth, completeNode);

module.exports = router;