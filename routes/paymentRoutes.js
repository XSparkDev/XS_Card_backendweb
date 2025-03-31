const express = require('express');
const router = express.Router();
const { initializePayment, handlePaymentCallback } = require('../controllers/paymentController');
const { authenticateUser } = require('../middleware/auth');

// Public route - no authentication needed
router.get('/payment/callback', handlePaymentCallback);
router.post('/payment/webhook', handlePaymentCallback);

// Protected route - needs authentication
router.post('/payment/initialize', authenticateUser, initializePayment);

module.exports = router;