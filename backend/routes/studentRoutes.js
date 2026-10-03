const express = require('express');
const router = express.Router();
const { registerStudent, checkInStudent } = require('../controllers/studentController');
const { checkInLimiter } = require('../middleware/rateLimiter')

router.post('/register', registerStudent);
router.post('/checkin', checkInLimiter, checkInStudent);

module.exports = router;