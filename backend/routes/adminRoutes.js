const express = require('express');
const router = express.Router();
const { adminLogin, startSession, endSession, rotateToken, getAttendance } = require('../controllers/adminController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

router.post('/login', adminLogin);
router.post('/start', verifyAdminToken, startSession);
router.post('/end', verifyAdminToken, endSession);
router.post('/rotate', verifyAdminToken, rotateToken);
router.get('/attendance/:session_id', getAttendance);

module.exports = router;