const { Router } = require('express');
const { requireAuth } = require('../middleware/auth_middleware');
const { getStatus, startChallenge, completeChallenge } = require('../controllers/daily_challenge_controller');

const router = Router();

router.get('/status',   requireAuth, getStatus);
router.post('/start',   requireAuth, startChallenge);
router.post('/complete',requireAuth, completeChallenge);

module.exports = router;