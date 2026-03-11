// src/routes/game_routes.js
const express = require('express');
const router  = express.Router();

// ── IMPORTANT: update this path if your auth middleware file has a different name
// The file we saw is src/middleware/auth.js exporting { requireAuth }
const { requireAuth } = require('../middleware/auth_middleware');

const { submitRound, getLeaderboard, getMyStats, getShieldStatus } = require('../controllers/game_controller');

router.post('/submit',     requireAuth, submitRound);
router.get('/leaderboard', requireAuth, getLeaderboard);
router.get('/my-stats',    requireAuth, getMyStats);
router.get('/shields',     requireAuth, getShieldStatus);

module.exports = router;