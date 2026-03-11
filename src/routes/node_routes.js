const { Router } = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { getNodes, useHint, completeNode, failNode } = require('../controllers/node_controller');

const router = Router();

router.post('/complete', requireAuth, completeNode);
router.post('/fail',     requireAuth, failNode);
router.post('/hint',     requireAuth, useHint);
router.get('/:sectorCode', requireAuth, getNodes);

module.exports = router;