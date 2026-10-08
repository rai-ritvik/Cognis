const router = require('express').Router();
const c = require('../controllers/authController');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');
const { loginLimiter, otpLimiter, registerLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerLimiter, validate(s.register), c.register);
router.post('/login', loginLimiter, validate(s.login), c.login);
router.post('/forgot', otpLimiter, validate(s.forgot), c.forgotPassword);
router.post('/verify-otp', otpLimiter, validate(s.verifyOtp), c.verifyOtp);
router.post('/reset-password', otpLimiter, validate(s.resetPassword), c.resetPassword);

module.exports = router;
