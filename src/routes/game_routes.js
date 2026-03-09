// src/routes/game_routes.js
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth_middleware');
const { submitRound, getLeaderboard, getMyStats } = require('../controllers/game_controller');

router.post('/submit',          requireAuth, submitRound);
router.get('/leaderboard',      requireAuth, getLeaderboard);
router.get('/my-stats',         requireAuth, getMyStats);

module.exports = router;