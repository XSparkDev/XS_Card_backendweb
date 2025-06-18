const express = require('express');
const router = express.Router();
const { 
    getPaymentMethods,
    updatePaymentMethod,
    deletePaymentMethod
} = require('../controllers/billingController');
const { authenticateUser } = require('../middleware/auth');

// All billing routes require authentication
router.use(authenticateUser);

// Payment Methods endpoints
router.get('/billing/payment-methods', getPaymentMethods);
router.put('/billing/payment-methods/:id', updatePaymentMethod);
router.delete('/billing/payment-methods/:id', deletePaymentMethod);

module.exports = router; 