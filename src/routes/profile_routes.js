const { Router } = require('express');
const { setupProfile, getProfile, consumeShield, updateUsername } = require('../controllers/profile_controller');
const { requireAuth } = require('../middleware/auth_middleware');

const router = Router();

router.get('/me', requireAuth, getProfile);

router.post('/setup', requireAuth, setupProfile);

router.post('/shield/consume', requireAuth, consumeShield);

router.patch('/username', requireAuth, updateUsername);

module.exports = router;