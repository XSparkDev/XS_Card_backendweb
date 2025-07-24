const express = require('express');
const router = express.Router();
const { 
    getPaymentMethods,
    updatePaymentMethod,
    deletePaymentMethod,
    addPaymentMethod,
    handlePaymentMethodCallback
} = require('../controllers/billingController');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../firebase');

// Import enterprise controller for invoices functionality
const enterpriseController = require('../controllers/enterpriseController');

// All billing routes require authentication
router.use(authenticateUser);

// Debug endpoint to check payment methods data
router.get('/billing/debug/payment-methods', async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Check user document
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // Check subscription document
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;
        
        // Check payment methods collection
        const paymentMethodsSnapshot = await db.collection('paymentMethods')
            .where('userId', '==', userId)
            .get();
        
        const paymentMethods = [];
        paymentMethodsSnapshot.forEach(doc => {
            paymentMethods.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        res.status(200).json({
            status: true,
            debug: {
                userId: userId,
                userCustomerCode: userData?.customerCode || null,
                subscriptionCustomerCode: subscriptionData?.customerCode || null,
                paymentMethodsCount: paymentMethods.length,
                paymentMethods: paymentMethods,
                userData: userData,
                subscriptionData: subscriptionData
            }
        });
        
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            status: false,
            message: 'Debug failed',
            error: error.message
        });
    }
});

// Payment Methods endpoints
router.get('/billing/payment-methods', getPaymentMethods);
router.post('/billing/payment-methods', addPaymentMethod);
router.put('/billing/payment-methods/:id', updatePaymentMethod);
router.delete('/billing/payment-methods/:id', deletePaymentMethod);

// Payment method callback endpoint
router.get('/billing/payment-method/callback', handlePaymentMethodCallback);
router.post('/billing/payment-method/callback', handlePaymentMethodCallback);

// Invoices endpoint - reuses enterprise controller logic
router.get('/billing/invoices', enterpriseController.getEnterpriseInvoices);
router.get('/billing/invoices/:invoiceId/download', enterpriseController.downloadInvoice);

module.exports = router; 