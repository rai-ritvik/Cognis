const express = require('express');
const router = express.Router();
const { adminLogin, startSession, endSession, rotateToken, getAttendance } = require('../controllers/adminController');

router.post('/login', adminLogin);
router.post('/start', startSession);
router.post('/end', endSession);
router.post('/rotate', rotateToken);
router.get('/attendance/:session_id', getAttendance);

module.exports = router;