const express = require('express');
const router = express.Router();
const { 
    initializeSubscription,
    initializeTrialSubscription, 
    handleTrialCallback,
    handleSubscriptionWebhook,
    getSubscriptionPlans,
    getSubscriptionStatus,
    cancelSubscription,
    getSubscriptionLogs,
    updateSubscriptionPlan
} = require('../controllers/subscriptionController');
const { authenticateUser } = require('../middleware/auth');

// Public routes - no authentication needed
router.get('/subscription/trial/callback', handleTrialCallback);
router.post('/subscription/webhook', handleSubscriptionWebhook);

// Protected routes - authentication required
router.post('/subscription/initialize', authenticateUser, initializeSubscription);
router.post('/subscription/trial/initialize', authenticateUser, initializeTrialSubscription);
router.get('/subscription/plans', authenticateUser, getSubscriptionPlans);
router.get('/subscription/status', authenticateUser, getSubscriptionStatus);
router.put('/subscription/plan', authenticateUser, updateSubscriptionPlan);
router.post('/subscription/cancel', authenticateUser, cancelSubscription);
router.get('/subscription/logs', authenticateUser, getSubscriptionLogs);

module.exports = router;
