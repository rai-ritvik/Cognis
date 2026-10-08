const router = require('express').Router();
const { checkIn } = require('../controllers/attendanceController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');
const { checkInLimiter } = require('../middleware/rateLimiter');

router.post('/checkin', verifyToken, checkInLimiter, validate(s.checkin), checkIn);

module.exports = router;
