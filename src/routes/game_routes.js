const express = require('express');
const router  = express.Router();

const { requireAuth } = require('../middleware/auth_middleware');

const { submitRound, getLeaderboard, getMyStats, getShieldStatus } = require('../controllers/game_controller');

router.post('/submit',     requireAuth, submitRound);
router.get('/leaderboard', requireAuth, getLeaderboard);
router.get('/shields',     requireAuth, getShieldStatus);
router.get('/my-stats',    requireAuth, getMyStats);//still not implemented in FE

module.exports = router;