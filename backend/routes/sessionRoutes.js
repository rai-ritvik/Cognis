const router = require('express').Router();
const c = require('../controllers/sessionController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(verifyToken);
router.get('/active', c.getActive); // students + admins

router.use(requireAdmin); // everything below is admin only
router.get('/', c.listSessions);
router.post('/schedule', validate(s.scheduleSession), c.scheduleSession);
router.post('/start', validate(s.startSession), c.startSession);
router.post('/rotate', validate(s.sessionIdBody), c.rotateToken);
router.post('/end', validate(s.sessionIdBody), c.endSession);
router.get('/:id/attendance', validate(s.idParam, 'params'), c.getSessionAttendance);

module.exports = router;
