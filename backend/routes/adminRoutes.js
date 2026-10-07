const router = require('express').Router();
const c = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(verifyToken, requireAdmin);

router.get('/dashboard', c.dashboard);
router.get('/analytics', c.analytics);
router.get('/members', c.listMembers);
router.post('/members/:id/remove', validate(s.idParam, 'params'), c.removeMember);
router.post('/members/:id/restore', validate(s.idParam, 'params'), c.restoreMember);
router.post('/members/:id/flag', validate(s.idParam, 'params'), validate(s.flag), c.flagMember);
router.post('/members/:id/unflag', validate(s.idParam, 'params'), c.unflagMember);
router.get('/flags', c.listFlags);
router.post('/events', validate(s.event), c.createEvent);
router.delete('/events/:id', validate(s.idParam, 'params'), c.deleteEvent);
router.get('/alerts', c.listAlerts);
router.get('/alerts/:id', validate(s.idParam, 'params'), c.getAlert);
router.post('/alerts/:id/review', validate(s.idParam, 'params'), validate(s.review), c.reviewAlert);
router.get('/projects', c.listProjects);

module.exports = router;
