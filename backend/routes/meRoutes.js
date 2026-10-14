const router = require('express').Router();
const c = require('../controllers/meController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(verifyToken);
router.get('/profile', c.getProfile);
router.patch('/profile', validate(s.updateProfile), c.updateProfile);
router.get('/home', c.getHome);
router.get('/analytics', c.getAnalytics);
router.get('/events', c.getEvents);
router.get('/projects', c.myProjects);
router.get('/friends', c.listFriends);
router.post('/friends', validate(s.friendRequest), c.sendFriendRequest);
router.patch('/friends/requests/:id', validate(s.idParam, 'params'), validate(s.friendRequestStatus), c.respondFriendRequest);
router.post('/projects', validate(s.project), c.submitProject);

module.exports = router;
