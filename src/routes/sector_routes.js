const { Router } = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { getSectors, updateProgress } = require('../controllers/sector_controller');

const router = Router();

// GET /api/sectors  — fetch all sectors + player progress
router.get('/', requireAuth, getSectors);

// POST /api/sectors/progress  — update node progress
router.post('/progress', requireAuth, updateProgress);

module.exports = router;