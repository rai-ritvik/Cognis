const express = require('express');
const router = express.Router();
const { startSession, endSession, rotateToken, getAttendance } = require('../controllers/adminController');

router.post('/start', startSession);
router.post('/end', endSession);
router.post('/rotate', rotateToken);
router.get('/attendance/:session_id', getAttendance);

module.exports = router;