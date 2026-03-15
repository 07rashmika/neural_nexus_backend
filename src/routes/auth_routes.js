const { Router } = require('express');
const { register, login } = require('../controllers/auth_controller');
const { registerValidators, loginValidators } = require('../middleware/validators');

const router = Router();

router.post('/register', registerValidators, register);

router.post('/login', loginValidators, login);

module.exports = router;