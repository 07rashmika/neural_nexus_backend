// const { Router } = require('express');
// const { body } = require('express-validator');
// const { setupProfile, getProfile } = require('../controllers/profile_controller');
// const { requireAuth } = require('../middleware/auth_middleware');

// const router = Router();
// router.use(requireAuth);

// router.post('/setup', [
//   body('username').trim().notEmpty().withMessage('Username is required')
//     .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters')
//     .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Letters, numbers, _ or - only'),
//   body('avatarUrl').notEmpty().withMessage('Avatar URL is required').isURL(),
//   body('callsign').optional().trim().isLength({ max: 40 }),
//   body('country').optional().trim().isLength({ max: 60 }),
// ], setupProfile);

// router.get('/me', getProfile);
// module.exports = router;

const { Router } = require('express');
const { setupProfile, getProfile, consumeShield } = require('../controllers/profile_controller');
const { requireAuth } = require('../middleware/auth_middleware');

const router = Router();

// GET /api/profile/me
router.get('/me', requireAuth, getProfile);

// POST /api/profile/setup
router.post('/setup', requireAuth, setupProfile);

// POST /api/profile/shield/consume
router.post('/shield/consume', requireAuth, consumeShield);

module.exports = router;