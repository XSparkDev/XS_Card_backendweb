const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// All notification routes require authentication
router.use(authenticateUser);

// Notification preferences routes
router.get('/api/users/notifications/preferences', notificationController.getNotificationPreferences);
router.put('/api/users/notifications/preferences', notificationController.updateNotificationPreferences);
router.post('/api/users/notifications/preferences/reset', notificationController.resetNotificationPreferences);

// Admin route for getting other users' preferences
router.get('/api/users/:userId/notifications/preferences', notificationController.getUserNotificationPreferences);

// Analytics route for notification statistics
router.get('/api/notifications/statistics', notificationController.getNotificationStatistics);

module.exports = router; 