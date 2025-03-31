const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

// Changed PUT to PATCH for partial updates
router.get('/meetings/:userId', meetingController.getAllMeetings);
router.post('/meetings', meetingController.createMeeting);
router.patch('/meetings/:userId/:meetingIndex', meetingController.updateMeeting);
router.delete('/meetings/:userId/:meetingIndex', meetingController.deleteMeeting);

// New endpoint for sending meeting invites
router.post('/meetings/invite', meetingController.sendMeetingInvite);

module.exports = router;
