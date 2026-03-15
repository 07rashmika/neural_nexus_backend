const { Router } = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { getSectors, updateProgress } = require('../controllers/sector_controller');

const router = Router();

//fetch all sectors and player progress
router.get('/', requireAuth, getSectors);

//update node progress
router.post('/progress', requireAuth, updateProgress);

module.exports = router;