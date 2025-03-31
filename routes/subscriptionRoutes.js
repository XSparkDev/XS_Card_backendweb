const express = require('express');
const router = express.Router();
const { 
    initializeTrialSubscription, 
    handleTrialCallback,
    handleSubscriptionWebhook,
    getSubscriptionPlans,
    getSubscriptionStatus,
    cancelSubscription,
    getSubscriptionLogs  // Add new controller function
} = require('../controllers/subscriptionController');
const { authenticateUser } = require('../middleware/auth');

// Public routes - no authentication needed
router.get('/subscription/trial/callback', handleTrialCallback);
router.post('/subscription/webhook', handleSubscriptionWebhook);

// Protected routes - authentication required
router.post('/subscription/trial/initialize', authenticateUser, initializeTrialSubscription);
router.get('/subscription/plans', authenticateUser, getSubscriptionPlans);
router.get('/subscription/status', authenticateUser, getSubscriptionStatus);
router.post('/subscription/cancel', authenticateUser, cancelSubscription);
router.get('/subscription/logs', authenticateUser, getSubscriptionLogs);  // Add new route

module.exports = router;
