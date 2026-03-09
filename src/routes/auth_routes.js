const { Router } = require('express');
const { register, login, me } = require('../controllers/auth_controller');
const { requireAuth } = require('../middleware/auth_middleware');
const { registerValidators, loginValidators } = require('../middleware/validators');

const router = Router();

// POST /api/auth/register
router.post('/register', registerValidators, register);

// POST /api/auth/login
router.post('/login', loginValidators, login);

// GET  /api/auth/me  (protected)
router.get('/me', requireAuth, me);

module.exports = router;