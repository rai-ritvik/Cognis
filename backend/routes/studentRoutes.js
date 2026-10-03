const express = require('express');
const router = express.Router();
const { registerStudent, checkInStudent } = require('../controllers/studentController');

router.post('/register', registerStudent);
router.post('/checkin', checkInStudent);

module.exports = router;