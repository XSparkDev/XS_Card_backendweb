const https = require('https');
const { db, admin } = require('../firebase.js');
const { SUBSCRIPTION_PLANS, SUBSCRIPTION_CONSTANTS, getPlanById } = require('../config/subscriptionPlans');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Initialize a subscription with Paystack
 * Uses the authenticated user's email and the selected plan ID
 */
const initializeSubscription = async (req, res) => {
    try {
        const { planId } = req.body;
        const userEmail = req.user.email;

        // Validate request
        if (!planId) {
            return res.status(400).json({
                status: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details from configuration
        const plan = getPlanById(planId);
        if (!plan) {
            return res.status(400).json({
                status: false,
                message: 'Invalid plan ID'
            });
        }

        const baseUrl = process.env.APP_URL;

        // Prepare Paystack request parameters
        const params = JSON.stringify({
            email: userEmail,
            amount: plan.amount * 100, // Convert to kobo/cents
            plan: plan.planCode,
            callback_url: `${baseUrl}/subscription/callback`,
            metadata: {
                planId: plan.id,
                cancel_action: `${baseUrl}/subscription/cancel`
            }
        });

        // Configure Paystack API request
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Make the request to Paystack
        const subscriptionReq = https.request(options, subscriptionRes => {
            let data = '';

            subscriptionRes.on('data', (chunk) => {
                data += chunk;
            });

            subscriptionRes.on('end', () => {
                const response = JSON.parse(data);
                res.status(200).json(response);
            });
        });

        subscriptionReq.on('error', (error) => {
            console.error('Subscription error:', error);
            res.status(500).json({ 
                status: false,
                message: 'Subscription initialization failed',
                error: error.message 
            });
        });

        subscriptionReq.write(params);
        subscriptionReq.end();

    } catch (error) {
        console.error('Subscription controller error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Initialize a trial subscription with Paystack
 * 1. Collect payment details (R1 charge)
 * 2. On verification, create subscription with 7-day start date
 */
const initializeTrialSubscription = async (req, res) => {
    try {
        const { planId } = req.body;
        const userEmail = req.user.email;

        // Validate request
        if (!planId) {
            return res.status(400).json({
                status: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details from configuration
        const plan = getPlanById(planId);
        if (!plan) {
            return res.status(400).json({
                status: false,
                message: 'Invalid plan ID'
            });
        }

        const baseUrl = process.env.APP_URL;

        // Prepare Paystack request parameters for initial R1 verification
        const params = JSON.stringify({
            email: userEmail,
            amount: SUBSCRIPTION_CONSTANTS.VERIFICATION_AMOUNT, // R1.00 in cents
            callback_url: `${baseUrl}/subscription/trial/callback`,
            metadata: {
                planId: plan.id,
                isTrialSetup: true,
                cancel_action: `${baseUrl}/subscription/cancel`
            }
        });

        // Configure Paystack API request
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        // Make the request to Paystack
        const trialReq = https.request(options, trialRes => {
            let data = '';

            trialRes.on('data', (chunk) => {
                data += chunk;
            });

            trialRes.on('end', () => {
                const response = JSON.parse(data);
                res.status(200).json(response);
            });
        });

        trialReq.on('error', (error) => {
            console.error('Trial subscription error:', error);
            res.status(500).json({ 
                status: false,
                message: 'Trial initialization failed',
                error: error.message 
            });
        });

        trialReq.write(params);
        trialReq.end();

    } catch (error) {
        console.error('Trial subscription controller error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Verify a subscription transaction with Paystack
 */
const verifySubscription = async (reference) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Verify a transaction with Paystack
 */
const verifyTransaction = async (reference) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Issue a refund for the verification amount
 */
const issueVerificationRefund = async (reference) => {
    const params = JSON.stringify({
        transaction: reference,
        merchant_note: "Refund for trial period verification"
    });

    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/refund',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                resolve(response);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(params);
        req.end();
    });
};

/**
 * Create a subscription with Paystack
 * This uses the customer code and starts after the trial period
 */
const createDelayedSubscription = async (customerCode, planCode, email, planId) => {
    // Calculate start date (TRIAL_MINUTES minutes from now)
    const startDate = new Date();
    // Use minutes for testing instead of days
    startDate.setMinutes(startDate.getMinutes() + SUBSCRIPTION_CONSTANTS.TRIAL_MINUTES);
    const formattedStartDate = startDate.toISOString();
    
    const params = JSON.stringify({
        customer: customerCode,
        plan: planCode,
        start_date: formattedStartDate
    });

    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/subscription',
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const response = JSON.parse(data);
                resolve(response);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(params);
        req.end();
    });
};

/**
 * Handle subscription callback from Paystack
 */
const handleSubscriptionCallback = async (req, res) => {
    try {
        const reference = req.method === 'POST' ? req.body.data?.reference : req.query.reference;
        
        if (!reference) {
            console.error('No reference provided');
            return res.status(400).json({ message: 'No reference provided' });
        }

        console.log('Processing subscription reference:', reference);
        
        // Verify transaction with Paystack
        const paymentData = await verifySubscription(reference);
        console.log('Subscription verification response:', paymentData);
        
        if (paymentData.status && paymentData.data.status === 'success') {
            // Get user email from payment data
            const userEmail = paymentData.data.customer.email;
            console.log('Updating user subscription for email:', userEmail);
            
            // Find user by email
            const userSnapshot = await db.collection('users')
                .where('email', '==', userEmail)
                .limit(1)
                .get();

            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const metadata = paymentData.data.metadata || {};
                const planId = metadata.planId;
                const plan = getPlanById(planId);

                // Update user subscription status
                await userDoc.ref.update({
                    subscriptionStatus: 'active',
                    subscriptionPlan: planId || 'unknown',
                    subscriptionReference: reference,
                    subscriptionStart: new Date().toISOString(),
                    // Calculate end date based on plan interval
                    subscriptionEnd: plan && plan.interval === 'annually' 
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() 
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    plan: 'premium' // Set plan to premium for RBAC
                });
                console.log('User subscription updated successfully');

                // Also store the subscription details in a separate collection using userId as document ID
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId || 'unknown',
                    reference: reference,
                    amount: paymentData.data.amount / 100,
                    status: 'active',
                    startDate: new Date().toISOString(),
                    endDate: plan && plan.interval === 'annually' 
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() 
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString(),
                    transactionData: paymentData.data
                });

                // Add log entry for subscription creation
                await logActivity({
                    action: ACTIONS.CREATE,
                    resource: RESOURCES.SUBSCRIPTION,
                    userId: userId,
                    resourceId: reference,
                    details: {
                        plan: planId || 'unknown',
                    amount: paymentData.data.amount / 100,
                    interval: plan?.interval || 'unknown'
                    }
                });
            } else {
                console.error('User not found for email:', userEmail);
            }

            // Simple redirect to success page
            if (req.method === 'GET') {
                return res.redirect('/subscription-success.html');
            } else {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'Subscription processed successfully'
                });
            }
        } else {
            console.error('Subscription verification failed:', paymentData);
            // Redirect to failure page
            if (req.method === 'GET') {
                return res.redirect('/subscription-failed.html');
            } else {
                return res.status(400).json({ 
                    status: 'failed',
                    message: 'Subscription verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Subscription callback error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Handle trial subscription callback from Paystack
 */
const handleTrialCallback = async (req, res) => {
    try {
        const reference = req.method === 'POST' ? req.body.data?.reference : req.query.reference;
        
        if (!reference) {
            console.error('No reference provided');
            return res.status(400).json({ message: 'No reference provided' });
        }

        console.log('Processing trial subscription reference:', reference);
        
        // Verify transaction with Paystack
        const paymentData = await verifyTransaction(reference);
        console.log('Trial verification response:', paymentData);
        
        if (paymentData.status && paymentData.data.status === 'success') {
            // Get user email and customer code from payment data
            const userEmail = paymentData.data.customer.email;
            const customerCode = paymentData.data.customer.customer_code;
            console.log('Setting up trial for user:', userEmail, 'Customer code:', customerCode);
            
            // Get plan ID from metadata
            const metadata = paymentData.data.metadata || {};
            const planId = metadata.planId;
            const plan = getPlanById(planId);

            if (!plan) {
                console.error('Invalid plan ID in metadata:', planId);
                return res.status(400).json({ message: 'Invalid plan ID' });
            }
            
            // Find user by email
            const userSnapshot = await db.collection('users')
                .where('email', '==', userEmail)
                .limit(1)
                .get();

            if (userSnapshot.empty) {
                console.error('User not found for email:', userEmail);
                return res.status(404).json({ message: 'User not found' });
            }

            const userDoc = userSnapshot.docs[0];
            const userId = userDoc.id;
            
            // Calculate trial end date (TRIAL_MINUTES minutes from now)
            const trialEndDate = new Date();
            trialEndDate.setMinutes(trialEndDate.getMinutes() + SUBSCRIPTION_CONSTANTS.TRIAL_MINUTES);
            
            // Step 1: Issue a refund for the verification amount
            const refundResult = await issueVerificationRefund(reference);
            console.log('Refund result:', refundResult);
            
            // Even if refund fails, continue with subscription setup
            // Just log the issue for administrative follow-up
            if (!refundResult.status) {
                console.error('Failed to issue refund:', refundResult);
            }
            
            // Step 2: Create a subscription with Paystack that starts after trial
            const subscriptionResult = await createDelayedSubscription(
                customerCode, 
                plan.planCode, 
                userEmail,
                planId
            );
            
            console.log('Delayed subscription result:', subscriptionResult);

            if (subscriptionResult.status) {
                // Update user with trial and subscription info
                await userDoc.ref.update({
                    subscriptionStatus: 'trial',
                    subscriptionPlan: planId,
                    customerCode: customerCode,
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    paymentReference: reference,
                    subscriptionCode: subscriptionResult.data.subscription_code,
                    subscriptionId: subscriptionResult.data.id,
                    lastUpdated: new Date().toISOString(),
                    plan: 'premium' // Set plan to premium for RBAC
                });
                
                // Store subscription details using userId as document ID
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId,
                    customerCode: customerCode,
                    subscriptionCode: subscriptionResult.data.subscription_code,
                    subscriptionId: subscriptionResult.data.id,
                    reference: reference,
                    status: 'trial',
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    createdAt: new Date().toISOString(),
                    paymentData: paymentData.data,
                    subscriptionData: subscriptionResult.data
                });
                
                console.log('User trial subscription setup successfully');

                console.log('LOGGING TRIAL SUBSCRIPTION CREATION');
                await logActivity({
                    action: ACTIONS.CREATE,
                    resource: RESOURCES.SUBSCRIPTION,
                    userId: userId,
                    resourceId: reference,
                    details: {
                        type: 'trial',
                        plan: plan.name,
                        amount: SUBSCRIPTION_CONSTANTS.VERIFICATION_AMOUNT / 100,
                        interval: plan.interval,
                        trialDays: SUBSCRIPTION_CONSTANTS.TRIAL_DAYS
                    }
                });
            } else {
                console.error('Failed to create delayed subscription:', subscriptionResult);
                // Still update user with trial info but mark subscription as pending
                await userDoc.ref.update({
                    subscriptionStatus: 'trial_incomplete',
                    subscriptionPlan: planId,
                    customerCode: customerCode,
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    paymentReference: reference,
                    lastUpdated: new Date().toISOString(),
                    errorDetails: subscriptionResult
                });
            }

            // Redirect or respond based on request method
            if (req.method === 'GET') {
                return res.redirect('/subscription-trial-success.html');
            } else {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'Trial subscription setup successfully'
                });
            }
        } else {
            console.error('Trial verification failed:', paymentData);
            if (req.method === 'GET') {
                return res.redirect('/subscription-failed.html');
            } else {
                return res.status(400).json({ 
                    status: 'failed',
                    message: 'Trial verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Trial callback error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Handle Paystack webhook events
 * Used for subscription lifecycle events
 */
const handleSubscriptionWebhook = async (req, res) => {
    try {
        // Log all incoming webhook data for debugging
        console.log('Received webhook payload:', JSON.stringify(req.body));
        
        const event = req.body;
        
        // Quickly acknowledge the webhook
        res.status(200).send('Webhook received');
        
        console.log('Received webhook event:', event.event);
        
        // Handle subscription cancellation or disabling
        if (event.event === 'subscription.disable' || 
            event.event === 'subscription.not_renewing' ||
            event.event === 'subscription.deactivate') {
            
            const data = event.data;
            let customerEmail;
            let subscriptionCode;
            
            // Extract customer email and subscription code
            if (data.customer) {
                customerEmail = data.customer.email;
            } else if (data.subscription && data.subscription.customer) {
                customerEmail = data.subscription.customer.email;
            }
            
            if (data.subscription) {
                subscriptionCode = data.subscription.subscription_code;
            }
            
            console.log(`Processing subscription cancellation for: ${customerEmail}, code: ${subscriptionCode}`);
            
            // Find user by email or subscription code
            let userQuery = db.collection('users');
            if (customerEmail) {
                userQuery = userQuery.where('email', '==', customerEmail);
            } else if (subscriptionCode) {
                userQuery = userQuery.where('subscriptionCode', '==', subscriptionCode);
            } else {
                console.error('No identifiable information in webhook data');
                return;
            }
            
            const userSnapshot = await userQuery.limit(1).get();
            
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                console.log(`Updating subscription status to cancelled for user ${userId}`);
                
                // Update user with cancelled status and change plan to free
                await userDoc.ref.update({
                    subscriptionStatus: 'cancelled',
                    plan: 'free', // Change plan back to free when subscription is cancelled
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                // Also update subscription document
                await db.collection('subscriptions').doc(userId).update({
                    status: 'cancelled',
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                console.log(`Subscription cancelled for user ${userId} and plan changed to free`);
            } else {
                console.error(`No matching user found for cancellation event`);
            }
        }
        
        // Handle more event types
        if (event.event === 'charge.success' || 
            event.event === 'subscription.create' || 
            event.event === 'invoice.payment_succeeded' ||
            event.event === 'subscription.not_renewing') {
            
            console.log('LOGGING WEBHOOK SUBSCRIPTION EVENT');
            // Find the user and log the subscription event
            if (event.event === 'charge.success' || event.event === 'subscription.create') {
                const data = event.data;
                const customerEmail = data.customer?.email;
                
                if (customerEmail) {
                    const userSnapshot = await db.collection('users')
                        .where('email', '==', customerEmail)
                        .limit(1)
                        .get();
                        
                    if (!userSnapshot.empty) {
                        const userDoc = userSnapshot.docs[0];
                        const userId = userDoc.id;
                        
                        // Log the webhook-triggered subscription event
                        await logActivity({
                            action: ACTIONS.CREATE,
                            resource: RESOURCES.SUBSCRIPTION,
                            userId: userId,
                            resourceId: data.reference || 'webhook-event',
                            details: {
                                source: 'webhook',
                                event: event.event,
                                plan: data.plan?.name || 'unknown',
                                amount: data.amount ? data.amount / 100 : 0
                            }
                        });
                    }
                }
            }
        }
        
        // Handle failed charge events
        if (event.event === 'charge.failed') {
            const data = event.data;
            const customerEmail = data.customer?.email;
            
            if (!customerEmail) {
                console.error('No customer email in webhook data');
                return;
            }
            
            console.log(`Payment failed for customer ${customerEmail}`);
            
            // Find the user with this email
            const userSnapshot = await db.collection('users')
                .where('email', '==', customerEmail)
                .limit(1)
                .get();
                
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                
                // Update payment failure info but don't immediately change status
                // This allows for retry attempts before subscription is fully cancelled
                await userDoc.ref.update({
                    lastPaymentFailure: new Date().toISOString(),
                    paymentFailureCount: admin.firestore.FieldValue.increment(1)
                });
                
                console.log(`Updated payment failure info for user ${userId}`);
            }
        }
        
    } catch (error) {
        console.error('Error processing subscription webhook:', error);
    }
};

/**
 * Cancel a subscription using Paystack API
 * @param {string} code - Subscription code
 * @param {string} token - Email token
 * @returns {Promise<Object>} - Cancellation result
 */
const cancelSubscriptionWithPaystack = async (code, token) => {
    return new Promise((resolve, reject) => {
        // Use the confirmed working endpoint
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: `/subscription/disable`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    // Check if data is empty before parsing
                    if (!data || data.trim() === '') {
                        return resolve({
                            status: false,
                            message: 'Empty response from Paystack'
                        });
                    }
                    
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}. Raw data: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        // Send the request with the exact payload format that works in Postman
        req.write(JSON.stringify({
            code: code,
            token: token
        }));
        
        req.end();
    });
};

/**
 * Get available subscription plans
 */
const getSubscriptionPlans = (req, res) => {
    try {
        const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
            id: plan.id,
            name: plan.name,
            amount: plan.amount,
            interval: plan.interval,
            description: plan.description,
            trialDays: SUBSCRIPTION_CONSTANTS.TRIAL_DAYS
        }));

        res.status(200).json({
            status: true,
            message: 'Subscription plans retrieved successfully',
            data: plans
        });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription plans',
            error: error.message
        });
    }
};

/**
 * Get user's subscription status
 */
const getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        
        const userData = userDoc.data();
        
        // Return subscription status info
        res.status(200).json({
            status: true,
            data: {
                subscriptionStatus: userData.subscriptionStatus || 'none',
                subscriptionPlan: userData.subscriptionPlan || null,
                trialStartDate: userData.trialStartDate || null,
                trialEndDate: userData.trialEndDate || null,
                isActive: ['trial', 'active'].includes(userData.subscriptionStatus || 'none')
            }
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription status',
            error: error.message
        });
    }
};

/**
 * Get subscription logs for a user
 */
const getSubscriptionLogs = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 20;
        
        // Query from activityLogs instead of subscriptionLogs
        const logsSnapshot = await db.collection('activityLogs')
            .where('userId', '==', userId)
            .where('resource', '==', RESOURCES.SUBSCRIPTION)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
            
        const logs = [];
        logsSnapshot.forEach(doc => {
            logs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        res.status(200).json({
            status: true,
            message: 'Subscription logs retrieved successfully',
            data: logs
        });
    } catch (error) {
        console.error('Error getting subscription logs:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription logs',
            error: error.message
        });
    }
};

/**
 * Helper function to update cancellation status in the database
 */
const updateCancellationInDatabase = async (userId, reason = 'User cancelled') => {
    try {
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        // Update user document
        await userDoc.ref.update({
            subscriptionStatus: 'cancelled',
            plan: 'free', // Change plan back to free when subscription is cancelled
            cancellationDate: new Date().toISOString(),
            cancellationReason: reason,
            lastUpdated: new Date().toISOString()
        });
        
        // Update subscription document
        await db.collection('subscriptions').doc(userId).update({
            status: 'cancelled',
            cancellationDate: new Date().toISOString(),
            cancellationReason: reason,
            lastUpdated: new Date().toISOString()
        });

        // Log database update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.SUBSCRIPTION,
            userId: userId,
            resourceId: userId,
            details: {
                oldStatus: userDoc.data().subscriptionStatus || 'unknown',
                newStatus: 'cancelled',
                oldPlan: userDoc.data().plan || 'unknown',
                newPlan: 'free',
                reason: reason
            }
        });
        
        console.log(`Database updated for user ${userId} - subscription marked as cancelled`);
        return true;
    } catch (error) {
        console.error('Error updating cancellation in database:', error);
        throw error;
    }
};

/**
 * Cancel a subscription
 */
const cancelSubscription = async (req, res) => {
    try {
        // Get authenticated user ID directly from req.user
        const userId = req.user.uid;
        
        // Get cancellation details from body
        const { code, token, reason, feedback } = req.body;
        
        console.log(`Starting cancellation process for user ${userId}`);
        
        // Validate required parameters
        if (!code) {
            return res.status(400).json({
                status: false,
                message: 'Subscription code is required'
            });
        }
        
        // Set timeout for Paystack API calls
        const apiTimeout = setTimeout(() => {
            console.error('Subscription cancellation timed out');
            return res.status(504).json({
                status: false,
                message: 'Subscription cancellation timed out'
            });
        }, 10000); // 10 seconds timeout
        
        // Log the parameters we're using
        console.log('Using subscription values:');
        console.log(`- Code: ${code}`);
        console.log(`- Token: ${token || 'Not provided'}`);
        
        // Use the single working method
        const result = await cancelSubscriptionWithPaystack(code, token);
        
        clearTimeout(apiTimeout);
        
        if (result.status) {
            console.log('Successfully cancelled subscription');
            
            // Log cancellation
            await logActivity({
                action: ACTIONS.CANCEL,
                resource: RESOURCES.SUBSCRIPTION,
                userId: userId,
                resourceId: code,
                details: {
                    reason: reason || 'User requested',
                    feedback: feedback || ''
                }
            });
            
            // Update database
            await updateCancellationInDatabase(userId, reason || 'User requested');
            
            return res.status(200).json({
                status: true,
                message: 'Subscription cancelled successfully',
                data: result.data
            });
        } else {
            // Cancellation failed
            console.error('Paystack cancellation failed:', result.message);
            
            return res.status(400).json({
                status: false,
                message: 'Failed to cancel subscription with Paystack',
                error: result.message
            });
        }
    } catch (error) {
        console.error('Subscription cancellation error:', error);
        
        // Log error
        try {
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.SUBSCRIPTION,
                userId: req.user?.uid || 'system',
                status: 'error',
                details: {
                    error: error.message,
                    operation: 'cancel_subscription'
                }
            });
        } catch (logError) {
            console.error('Error logging cancellation failure:', logError);
        }
        
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    initializeSubscription,
    initializeTrialSubscription,
    handleSubscriptionCallback,
    handleTrialCallback,
    handleSubscriptionWebhook,
    getSubscriptionPlans,
    getSubscriptionStatus,
    cancelSubscription,
    getSubscriptionLogs
};
