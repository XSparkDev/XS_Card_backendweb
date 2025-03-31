const https = require('https');
const { db, admin } = require('../firebase');
const crypto = require('crypto');

// This file is no longer needed as we're migrating payment functionality
// to the subscription controller.

// Simple redirect for backward compatibility
const initializePayment = async (req, res) => {
    try {
        const { planId } = req.body;
        
        // If planId is not provided, use default monthly plan
        const planToUse = planId || 'MONTHLY_PLAN';
        
        // Redirect to the subscription controller
        req.body.planId = planToUse;
        
        // Import and call the subscription controller
        const { initializeTrialSubscription } = require('./subscriptionController');
        return initializeTrialSubscription(req, res);
    } catch (error) {
        console.error('Payment redirect error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Payment initialization failed',
            error: error.message 
        });
    }
};

// Keep this for backward compatibility
const handlePaymentCallback = (req, res) => {
    try {
        // Import and call the subscription callback handler
        const { handleTrialCallback } = require('./subscriptionController');
        return handleTrialCallback(req, res);
    } catch (error) {
        console.error('Payment callback redirect error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Payment callback failed',
            error: error.message 
        });
    }
};

module.exports = {
    initializePayment,
    handlePaymentCallback
};
