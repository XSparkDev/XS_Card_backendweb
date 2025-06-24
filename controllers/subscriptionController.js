const https = require('https');
const { db, admin } = require('../firebase.js');
const { SUBSCRIPTION_PLANS, SUBSCRIPTION_CONSTANTS, getPlanById, getPlanByCode } = require('../config/subscriptionPlans');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');
const { storePaymentMethod } = require('./billingController');

// ============================================================================
// SUBSCRIPTION HISTORY HELPER FUNCTIONS (Phase 1)
// ============================================================================

/**
 * Clean up subscription fields from a user record (Phase 2)
 * This function removes subscription-specific fields that should only be in subscriptions collection
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of fields cleaned up
 */
const cleanupUserSubscriptionFields = async (userId) => {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return 0;
        }
        
        const userData = userDoc.data();
        const fieldsToRemove = {};
        
        // List of subscription fields that should be removed from user records
        const subscriptionFields = [
            'subscriptionPlan', 'subscriptionReference', 'subscriptionStart', 'subscriptionEnd',
            'trialStartDate', 'trialEndDate', 'customerCode', 'subscriptionCode', 
            'subscriptionId', 'paymentReference', 'lastPaymentFailure', 'paymentFailureCount'
        ];
        
        // Check which fields exist and mark them for removal
        subscriptionFields.forEach(field => {
            if (userData[field] !== undefined) {
                fieldsToRemove[field] = admin.firestore.FieldValue.delete();
            }
        });
        
        // Apply cleanup if there are fields to remove
        if (Object.keys(fieldsToRemove).length > 0) {
            await userDoc.ref.update(fieldsToRemove);
            console.log(`Cleaned up ${Object.keys(fieldsToRemove).length} subscription fields from user ${userId} record`);
            
            // Log the cleanup activity
            await logActivity({
                action: 'CLEANUP',
                resource: RESOURCES.USER,
                userId: userId,
                resourceId: userId,
                details: {
                    operation: 'user_subscription_field_cleanup',
                    fieldsRemoved: Object.keys(fieldsToRemove),
                    fieldCount: Object.keys(fieldsToRemove).length,
                    phase: 'phase_2_migration'
                }
            });
        }
        
        return Object.keys(fieldsToRemove).length;
    } catch (error) {
        console.error(`Error cleaning up user ${userId} subscription fields:`, error);
        return 0;
    }
};

/**
 * Create a subscription history record for archival purposes
 * @param {string} userId - User ID
 * @param {Object} subscriptionData - Current subscription data
 * @param {Object} cancellationDetails - Cancellation information
 * @returns {Promise<string>} - History record ID
 */
const createSubscriptionHistory = async (userId, subscriptionData, cancellationDetails = {}) => {
    try {
        // Get user's existing subscription history count for numbering
        const existingHistorySnapshot = await db.collection('subscriptionHistory')
            .where('userId', '==', userId)
            .get();
        
        const subscriptionNumber = existingHistorySnapshot.size + 1;
        
        // Calculate total paid amount
        let totalPaid = 0;
        if (subscriptionData.amount) {
            totalPaid = subscriptionData.amount;
        } else if (subscriptionData.planId) {
            const plan = getPlanById(subscriptionData.planId);
            totalPaid = plan ? plan.amount : 0;
        }

        // Calculate subscription duration if we have dates
        let durationDays = null;
        if (subscriptionData.startDate && cancellationDetails.cancellationDate) {
            const start = new Date(subscriptionData.startDate);
            const end = new Date(cancellationDetails.cancellationDate);
            durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        }

        // === FIX: Filter out undefined values to prevent Firestore errors ===
        const cleanObject = (obj) => {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined && value !== null) {
                    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                        const cleanedNested = cleanObject(value);
                        if (Object.keys(cleanedNested).length > 0) {
                            cleaned[key] = cleanedNested;
                        }
                    } else {
                        cleaned[key] = value;
                    }
                }
            }
            return cleaned;
        };

        // Create comprehensive history record with clean data
        const historyRecord = {
            userId: userId,
            subscriptionId: subscriptionData.subscriptionId || subscriptionData.id || `sub_${Date.now()}`,
            planId: subscriptionData.planId || 'unknown',
            planCode: subscriptionData.planCode || subscriptionData.subscriptionCode || null,
            subscriptionCode: subscriptionData.subscriptionCode || null,
            customerCode: subscriptionData.customerCode || null,
            status: 'cancelled',
            
            // Dates (only include if they exist)
            startDate: subscriptionData.startDate || subscriptionData.trialStartDate || null,
            endDate: subscriptionData.endDate || subscriptionData.trialEndDate || null,
            trialStartDate: subscriptionData.trialStartDate || null,
            trialEndDate: subscriptionData.trialEndDate || null,
            cancellationDate: cancellationDetails.cancellationDate || new Date().toISOString(),
            
            // Cancellation details
            cancellationReason: cancellationDetails.reason || 'User requested',
            cancellationSource: cancellationDetails.source || 'user_action', // user_action, webhook, admin
            
            // Financial data
            totalPaid: totalPaid,
            currency: 'ZAR',
            
            // Metadata
            subscriptionNumber: subscriptionNumber,
            durationDays: durationDays,
            wasTrialSubscription: !!(subscriptionData.trialStartDate),
            
            // Archive metadata
            archivedDate: new Date().toISOString(),
            archivedBy: 'system',
            
            // Paystack references
            paymentReference: subscriptionData.reference || subscriptionData.paymentReference || null,
            
            createdAt: new Date().toISOString()
        };

        // === FIX: Clean the history record and store limited original data ===
        const cleanHistoryRecord = cleanObject(historyRecord);
        
        // Add cleaned original subscription data (only essential fields)
        if (subscriptionData && Object.keys(subscriptionData).length > 0) {
            const essentialOriginalData = {
                planId: subscriptionData.planId,
                planName: subscriptionData.planName,
                planAmount: subscriptionData.planAmount,
                status: subscriptionData.status,
                customerCode: subscriptionData.customerCode,
                subscriptionCode: subscriptionData.subscriptionCode,
                reference: subscriptionData.reference
            };
            cleanHistoryRecord.originalSubscriptionData = cleanObject(essentialOriginalData);
        }

        // Add to subscriptionHistory collection
        const historyDocRef = await db.collection('subscriptionHistory').add(cleanHistoryRecord);
        
        console.log(`Created subscription history record ${historyDocRef.id} for user ${userId} (subscription #${subscriptionNumber})`);
        
        // Log the history creation
        await logActivity({
            action: ACTIONS.CREATE,
            resource: 'SUBSCRIPTION_HISTORY',
            userId: userId,
            resourceId: historyDocRef.id,
            details: {
                subscriptionNumber: subscriptionNumber,
                planId: subscriptionData.planId,
                cancellationReason: cancellationDetails.reason,
                totalPaid: totalPaid,
                durationDays: durationDays
            }
        });
        
        return historyDocRef.id;
    } catch (error) {
        console.error('Error creating subscription history:', error);
        // Don't throw error - history creation shouldn't break cancellation flow
        return null;
    }
};

/**
 * Get user's subscription history count
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of historical subscriptions
 */
const getUserSubscriptionHistoryCount = async (userId) => {
    try {
        // === FIX: Use simple query to avoid index requirement ===
        const historySnapshot = await db.collection('subscriptionHistory')
            .where('userId', '==', userId)
            .get();
        return historySnapshot.size;
    } catch (error) {
        console.error('Error getting subscription history count:', error);
        return 0;
    }
};

/**
 * Get user's complete subscription history
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} - Array of history records
 */
const getUserSubscriptionHistory = async (userId, limit = 50) => {
    try {
        // === FIX: Use simpler query to avoid index requirement ===
        // Try with orderBy first, fall back to simpler query if index doesn't exist
        let historySnapshot;
        try {
            historySnapshot = await db.collection('subscriptionHistory')
                .where('userId', '==', userId)
                .orderBy('subscriptionNumber', 'desc')
                .limit(limit)
                .get();
        } catch (indexError) {
            console.log('Index not available, using simple query without orderBy');
            // Fallback: Simple query without orderBy (no index required)
            historySnapshot = await db.collection('subscriptionHistory')
                .where('userId', '==', userId)
                .limit(limit)
                .get();
        }
            
        const history = [];
        historySnapshot.forEach(doc => {
            history.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort in memory if we couldn't sort in the query
        if (history.length > 0 && !history[0].subscriptionNumber) {
            // Sort by creation date if subscriptionNumber not available
            history.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (history.length > 1 && history[0].subscriptionNumber < history[1].subscriptionNumber) {
            // Sort by subscriptionNumber descending if query didn't sort
            history.sort((a, b) => (b.subscriptionNumber || 0) - (a.subscriptionNumber || 0));
        }
        
        return history;
    } catch (error) {
        console.error('Error getting user subscription history:', error);
        return [];
    }
};

// ============================================================================
// EXISTING SUBSCRIPTION FUNCTIONS (Modified for Phase 1)
// ============================================================================

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

                // === PHASE 2: CLEAN USER RECORD - ONLY ESSENTIAL RBAC FIELDS ===
                // Update user subscription status (minimal data for RBAC)
                await userDoc.ref.update({
                    subscriptionStatus: 'active',
                    plan: 'premium', // Set plan to premium for RBAC
                    lastUpdated: new Date().toISOString()
                    // Removed: subscriptionPlan, subscriptionReference, subscriptionStart, subscriptionEnd
                });
                console.log('User subscription updated successfully');

                // === PHASE 2: ALL SUBSCRIPTION DETAILS GO TO SUBSCRIPTIONS COLLECTION ===
                // Store comprehensive subscription details in subscriptions collection using userId as document ID
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
                    lastUpdated: new Date().toISOString(),
                    transactionData: paymentData.data,
                    // For direct payments, subscriptionCode might not be available from Paystack
                    subscriptionCode: paymentData.data.subscription?.subscription_code || null,
                    // Add plan details for easy access
                    planCode: plan?.planCode || null,
                    planName: plan?.name || 'Unknown Plan',
                    planAmount: plan?.amount || 0,
                    planInterval: plan?.interval || 'unknown',
                    // Payment details
                    customerCode: paymentData.data.customer?.customer_code || null
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

                // Store payment method
                try {
                    if (paymentData.data.authorization) {
                        await storePaymentMethod(userId, paymentData.data.customer.customer_code, paymentData.data.authorization);
                        console.log('Payment method stored successfully');
                    }
                } catch (paymentMethodError) {
                    console.error('Error storing payment method:', paymentMethodError);
                    // Don't fail the subscription if payment method storage fails
                }
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
                // === PHASE 2: CLEAN USER RECORD - ONLY ESSENTIAL RBAC FIELDS ===
                // Update user subscription status (minimal data for RBAC)
                await userDoc.ref.update({
                    subscriptionStatus: 'trial',
                    plan: 'premium', // Set plan to premium for RBAC
                    lastUpdated: new Date().toISOString()
                    // Removed: subscriptionPlan, subscriptionReference, subscriptionStart, subscriptionEnd
                });
                
                // === PHASE 2: ALL SUBSCRIPTION DETAILS GO TO SUBSCRIPTIONS COLLECTION ===
                // Store comprehensive subscription details in subscriptions collection using userId as document ID
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId,
                    customerCode: customerCode,
                    reference: reference,
                    status: 'trial',
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    paymentData: paymentData.data,
                    subscriptionData: subscriptionResult.data,
                    // Extract subscriptionCode from Paystack response
                    subscriptionCode: subscriptionResult.data?.subscription_code || null,
                    // Plan details for easy access
                    planCode: plan.planCode,
                    planName: plan.name,
                    planAmount: plan.amount,
                    planInterval: plan.interval
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

                // Store payment method
                try {
                    if (paymentData.data.authorization) {
                        await storePaymentMethod(userId, customerCode, paymentData.data.authorization);
                        console.log('Payment method stored successfully');
                    }
                } catch (paymentMethodError) {
                    console.error('Error storing payment method:', paymentMethodError);
                    // Don't fail the subscription if payment method storage fails
                }
            } else {
                console.error('Failed to create delayed subscription:', subscriptionResult);
                
                // === PHASE 2: MINIMAL USER UPDATE FOR INCOMPLETE TRIAL ===
                // Still update user with trial info but mark subscription as pending
                await userDoc.ref.update({
                    subscriptionStatus: 'trial_incomplete',
                    plan: 'free', // Keep as free until subscription is complete
                    lastUpdated: new Date().toISOString()
                    // Removed: subscriptionPlan, subscriptionReference
                });
                
                // === PHASE 2: INCOMPLETE TRIAL DETAILS TO SUBSCRIPTIONS COLLECTION ===
                await db.collection('subscriptions').doc(userId).set({
                    userId: userId,
                    email: userEmail,
                    planId: planId,
                    customerCode: customerCode,
                    reference: reference,
                    status: 'trial_incomplete',
                    trialStartDate: new Date().toISOString(),
                    trialEndDate: trialEndDate.toISOString(),
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    paymentData: paymentData.data,
                    errorDetails: subscriptionResult,
                    // subscriptionCode would be null since subscription creation failed
                    subscriptionCode: null,
                    // Plan details
                    planCode: plan.planCode,
                    planName: plan.name,
                    planAmount: plan.amount,
                    planInterval: plan.interval
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
                
                // === PHASE 1: CREATE SUBSCRIPTION HISTORY RECORD FOR WEBHOOK CANCELLATION ===
                // Get current subscription data before cancellation
                const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
                let subscriptionData = {};
                if (subscriptionDoc.exists) {
                    subscriptionData = subscriptionDoc.data();
                }
                
                // Combine user and subscription data for comprehensive history
                const combinedSubscriptionData = {
                    ...subscriptionData,
                    // Add user subscription fields for complete record
                    subscriptionPlan: userData.subscriptionPlan || subscriptionData.planId,
                    subscriptionStatus: userData.subscriptionStatus,
                    trialStartDate: userData.trialStartDate || subscriptionData.trialStartDate,
                    trialEndDate: userData.trialEndDate || subscriptionData.trialEndDate,
                    subscriptionStart: userData.subscriptionStart || subscriptionData.startDate,
                    subscriptionEnd: userData.subscriptionEnd || subscriptionData.endDate,
                    customerCode: userData.customerCode || subscriptionData.customerCode,
                    subscriptionCode: userData.subscriptionCode || subscriptionData.subscriptionCode,
                    paymentReference: userData.paymentReference || subscriptionData.reference
                };
                
                const cancellationDetails = {
                    cancellationDate: new Date().toISOString(),
                    reason: `Webhook cancellation: ${event.event}`,
                    source: 'webhook' // webhook source
                };
                
                // Create history record (non-blocking - don't fail webhook processing if this fails)
                try {
                    await createSubscriptionHistory(userId, combinedSubscriptionData, cancellationDetails);
                    console.log(`Subscription history created for user ${userId} via webhook before cancellation`);
                } catch (historyError) {
                    console.error('Failed to create subscription history via webhook (continuing with cancellation):', historyError);
                }
                
                // === EXISTING WEBHOOK CANCELLATION LOGIC (UNCHANGED) ===
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
 * Get user's comprehensive subscription status
 */
const getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Get user document (only for RBAC fields)
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        
        const userData = userDoc.data();
        
        // === PHASE 2: GRADUAL CLEANUP - AUTO-CLEAN USER RECORDS ON ACCESS ===
        // Automatically clean up subscription fields from user record when accessed
        try {
            const fieldsRemoved = await cleanupUserSubscriptionFields(userId);
            if (fieldsRemoved > 0) {
                console.log(`Auto-cleaned ${fieldsRemoved} subscription fields from user ${userId} during status check`);
            }
        } catch (cleanupError) {
            console.error('Error during auto-cleanup:', cleanupError);
            // Don't fail the request if cleanup fails
        }
        
        // === PHASE 2: PRIMARY DATA SOURCE - SUBSCRIPTIONS COLLECTION ===
        // Get subscription data (this is now the primary source of truth)
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const subscriptionDoc = await subscriptionRef.get();
        const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : {};
        
        // Determine subscription plan details (prioritize subscriptions collection)
        let planDetails = null;
        let subscriptionPlan = 'free';
        
        if (userData.plan === 'premium' || 
            userData.subscriptionStatus === 'active' || 
            userData.subscriptionStatus === 'trial' ||
            userData.subscriptionStatus === 'trial_incomplete') {
            
            // Phase 2: Prioritize subscription collection data
            const planId = subscriptionData.planId || userData.subscriptionPlan; // Fallback for backward compatibility
            if (planId) {
                const plan = getPlanById(planId);
                if (plan) {
                    planDetails = plan;
                    subscriptionPlan = plan.interval === 'annually' ? 'premium_annual' : 'premium_monthly';
                }
            } else if (subscriptionData.planCode) {
                // Fallback to plan code lookup
                const plan = getPlanByCode(subscriptionData.planCode);
                if (plan) {
                    planDetails = plan;
                    subscriptionPlan = plan.interval === 'annually' ? 'premium_annual' : 'premium_monthly';
                }
            }
        }
        
        // Calculate subscription dates and status
        const now = new Date();
        // Include trial_incomplete as active since user paid and is in trial period
        const isActive = userData.subscriptionStatus === 'active' || 
                         userData.subscriptionStatus === 'trial' ||
                         userData.subscriptionStatus === 'trial_incomplete';
        
        // Get current contact count
        const currentContactCount = await getCurrentContactCount(userId);
        
        // === PHASE 2: BUILD RESPONSE PRIORITIZING SUBSCRIPTIONS COLLECTION ===
        const response = {
            status: true,
            data: {
                // RBAC fields from users collection (authoritative)
                subscriptionStatus: userData.subscriptionStatus || 'free',
                plan: userData.plan || 'free',
                isActive: isActive,
                
                // Subscription details from subscriptions collection (prioritized)
                subscriptionPlan: subscriptionPlan,
                subscriptionReference: subscriptionData.reference || userData.subscriptionReference || null,
                subscriptionStart: subscriptionData.startDate || userData.subscriptionStart || userData.trialStartDate || null,
                subscriptionEnd: subscriptionData.endDate || userData.subscriptionEnd || null,
                trialStartDate: subscriptionData.trialStartDate || userData.trialStartDate || null,
                trialEndDate: subscriptionData.trialEndDate || userData.trialEndDate || null,
                customerCode: subscriptionData.customerCode || userData.customerCode || null,
                subscriptionCode: subscriptionData.subscriptionCode || userData.subscriptionCode || null,
                
                // Financial and plan details (from subscriptions collection)
                amount: subscriptionData.planAmount || planDetails?.amount || 0,
                currency: 'ZAR',
                
                // Additional subscription fields (prioritize subscriptions collection)
                paymentMethod: subscriptionData.paymentMethod || null,
                lastPaymentDate: subscriptionData.lastPaymentDate || null,
                nextPaymentDate: subscriptionData.nextPaymentDate || null,
                cancellationDate: subscriptionData.cancellationDate || userData.cancellationDate || null,
                autoRenew: subscriptionData.autoRenew !== false, // Default to true unless explicitly false
                
                // Contact limits and usage
                contactLimit: (userData.plan === 'free' && 
                             userData.subscriptionStatus !== 'trial' && 
                             userData.subscriptionStatus !== 'trial_incomplete' && 
                             userData.subscriptionStatus !== 'active') ? 3 : 'unlimited',
                currentContactCount: currentContactCount,
                
                // Plan details (use subscription data first, then config)
                planDetails: planDetails ? {
                    id: planDetails.id,
                    name: subscriptionData.planName || planDetails.name,
                    interval: subscriptionData.planInterval || planDetails.interval,
                    description: planDetails.description,
                    amount: subscriptionData.planAmount || planDetails.amount
                } : null
            }
        };
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({
            status: false,
            message: 'Error fetching subscription status',
            error: error.message
        });
    }
};

// Helper function to get current contact count
const getCurrentContactCount = async (userId) => {
    try {
        const contactRef = db.collection('contacts').doc(userId);
        const contactDoc = await contactRef.get();
        
        if (contactDoc.exists) {
            const contactData = contactDoc.data();
            return contactData.contactList ? contactData.contactList.length : 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting contact count:', error);
        return 0;
    }
};

/**
 * Get subscription logs for a user
 */
const getSubscriptionLogs = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 20;
        
        // === FIX: Use fallback query to avoid index requirement ===
        let logsSnapshot;
        try {
            // Try complex query first (requires index)
            logsSnapshot = await db.collection('activityLogs')
                .where('userId', '==', userId)
                .where('resource', '==', RESOURCES.SUBSCRIPTION)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
        } catch (indexError) {
            console.log('ActivityLogs index not available, using simple query without orderBy');
            try {
                // Fallback 1: Simple query with both filters, no orderBy
                logsSnapshot = await db.collection('activityLogs')
                    .where('userId', '==', userId)
                    .where('resource', '==', RESOURCES.SUBSCRIPTION)
                    .limit(limit)
                    .get();
            } catch (simpleError) {
                console.log('Using most basic query with userId only');
                // Fallback 2: Most basic query - userId only, filter in memory
                const allUserLogs = await db.collection('activityLogs')
                    .where('userId', '==', userId)
                    .limit(limit * 2) // Get more to filter
                    .get();
                
                // Filter for subscription logs in memory
                const filteredDocs = [];
                allUserLogs.forEach(doc => {
                    const data = doc.data();
                    if (data.resource === RESOURCES.SUBSCRIPTION) {
                        filteredDocs.push(doc);
                    }
                });
                
                // Create a mock snapshot object
                logsSnapshot = {
                    docs: filteredDocs.slice(0, limit),
                    forEach: function(callback) {
                        this.docs.forEach(callback);
                    }
                };
            }
        }
            
        const logs = [];
        logsSnapshot.forEach(doc => {
            logs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort in memory if needed (by timestamp descending)
        if (logs.length > 1) {
            logs.sort((a, b) => {
                const timestampA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                const timestampB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                return timestampB - timestampA;
            });
        }
        
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
        
        const userData = userDoc.data();
        
        // Get current subscription data before cancellation
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        let subscriptionData = {};
        if (subscriptionDoc.exists) {
            subscriptionData = subscriptionDoc.data();
        }
        
        // === PHASE 1: CREATE SUBSCRIPTION HISTORY RECORD ===
        // Combine user and subscription data for comprehensive history
        const combinedSubscriptionData = {
            ...subscriptionData,
            // Add user subscription fields for complete record
            subscriptionPlan: userData.subscriptionPlan || subscriptionData.planId,
            subscriptionStatus: userData.subscriptionStatus,
            trialStartDate: userData.trialStartDate || subscriptionData.trialStartDate,
            trialEndDate: userData.trialEndDate || subscriptionData.trialEndDate,
            subscriptionStart: userData.subscriptionStart || subscriptionData.startDate,
            subscriptionEnd: userData.subscriptionEnd || subscriptionData.endDate,
            customerCode: userData.customerCode || subscriptionData.customerCode,
            subscriptionCode: userData.subscriptionCode || subscriptionData.subscriptionCode,
            paymentReference: userData.paymentReference || subscriptionData.reference
        };
        
        const cancellationDetails = {
            cancellationDate: new Date().toISOString(),
            reason: reason,
            source: 'user_action' // Can be user_action, webhook, admin
        };
        
        // Create history record (non-blocking - don't fail cancellation if this fails)
        try {
            await createSubscriptionHistory(userId, combinedSubscriptionData, cancellationDetails);
            console.log(`Subscription history created for user ${userId} before cancellation`);
        } catch (historyError) {
            console.error('Failed to create subscription history (continuing with cancellation):', historyError);
        }
        
        // === EXISTING CANCELLATION LOGIC (UNCHANGED) ===
        // Update user document
        await userDoc.ref.update({
            subscriptionStatus: 'cancelled',
            plan: 'free', // Change plan back to free when subscription is cancelled
            cancellationDate: new Date().toISOString(),
            cancellationReason: reason,
            lastUpdated: new Date().toISOString()
        });

        // === PHASE 2: CLEAN UP ANY RESIDUAL SUBSCRIPTION FIELDS IN USER RECORD ===
        // Remove any subscription fields that might exist from previous versions
        const fieldsToRemove = {};
        if (userData.subscriptionPlan) fieldsToRemove.subscriptionPlan = admin.firestore.FieldValue.delete();
        if (userData.subscriptionReference) fieldsToRemove.subscriptionReference = admin.firestore.FieldValue.delete();
        if (userData.subscriptionStart) fieldsToRemove.subscriptionStart = admin.firestore.FieldValue.delete();
        if (userData.subscriptionEnd) fieldsToRemove.subscriptionEnd = admin.firestore.FieldValue.delete();
        if (userData.trialStartDate) fieldsToRemove.trialStartDate = admin.firestore.FieldValue.delete();
        if (userData.trialEndDate) fieldsToRemove.trialEndDate = admin.firestore.FieldValue.delete();
        if (userData.customerCode) fieldsToRemove.customerCode = admin.firestore.FieldValue.delete();
        if (userData.subscriptionCode) fieldsToRemove.subscriptionCode = admin.firestore.FieldValue.delete();
        if (userData.subscriptionId) fieldsToRemove.subscriptionId = admin.firestore.FieldValue.delete();
        if (userData.paymentReference) fieldsToRemove.paymentReference = admin.firestore.FieldValue.delete();

        // Apply cleanup if there are fields to remove
        if (Object.keys(fieldsToRemove).length > 0) {
            await userDoc.ref.update(fieldsToRemove);
            console.log(`Cleaned up ${Object.keys(fieldsToRemove).length} subscription fields from user ${userId} record`);
        }

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
                oldStatus: userData.subscriptionStatus || 'unknown',
                newStatus: 'cancelled',
                oldPlan: userData.plan || 'unknown',
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
        
        // Get cancellation details from body (token no longer required from frontend)
        const { code, reason, feedback } = req.body;
        
        console.log(`Starting cancellation process for user ${userId}`);
        
        // Validate required parameters
        if (!code) {
            return res.status(400).json({
                status: false,
                message: 'Subscription code is required'
            });
        }
        
        // Auto-retrieve email_token from subscriptions collection
        let emailToken = null;
        try {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                // Email token is nested in subscriptionData.subscriptionData.email_token
                emailToken = subscriptionData.subscriptionData?.email_token;
                console.log(`Retrieved email_token from database: ${emailToken ? 'Found' : 'Not found'}`);
                console.log('Full subscription data structure:', JSON.stringify(subscriptionData, null, 2));
            } else {
                console.log('No subscription document found for user');
                return res.status(404).json({
                    status: false,
                    message: 'No active subscription found for user'
                });
            }
        } catch (dbError) {
            console.error('Error retrieving email_token from database:', dbError);
            return res.status(500).json({
                status: false,
                message: 'Failed to retrieve subscription details'
            });
        }
        
        // Check if email_token was found
        if (!emailToken) {
            return res.status(400).json({
                status: false,
                message: 'Email token not found. Please contact support.'
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
        console.log(`- Email Token: ${emailToken ? 'Retrieved from DB' : 'Not available'}`);
        
        // Use the single working method with auto-retrieved token
        const result = await cancelSubscriptionWithPaystack(code, emailToken);
        
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

/**
 * Update subscription plan (direct plan change without payment flow)
 */
const updateSubscriptionPlan = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { planId, reason } = req.body;

        // Validate request
        if (!planId) {
            return res.status(400).json({
                status: false,
                message: 'Plan ID is required'
            });
        }

        // Get plan details
        const newPlan = getPlanById(planId);
        if (!newPlan) {
            return res.status(400).json({
                status: false,
                message: 'Invalid plan ID'
            });
        }

        // Get current user data
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        const userData = userDoc.data();
        const oldPlan = userData.subscriptionPlan || 'free';

        // === PHASE 2: CLEAN USER RECORD - ONLY ESSENTIAL RBAC FIELDS ===
        // Update user with minimal subscription info (only what's needed for RBAC)
        const userUpdateData = {
            subscriptionStatus: 'active',
            plan: 'premium',
            lastUpdated: new Date().toISOString()
            // Removed: subscriptionPlan, subscriptionEnd (moved to subscriptions collection)
        };

        await userDoc.ref.update(userUpdateData);

        // === PHASE 2: ALL SUBSCRIPTION DETAILS GO TO SUBSCRIPTIONS COLLECTION ===
        // Calculate new end date based on plan interval
        const endDate = newPlan.interval === 'annually' 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Update subscription document with comprehensive details
        await db.collection('subscriptions').doc(userId).set({
            userId: userId,
            planId: planId,
            status: 'active',
            planCode: newPlan.planCode,
            planName: newPlan.name,
            planAmount: newPlan.amount,
            planInterval: newPlan.interval,
            startDate: new Date().toISOString(),
            endDate: endDate,
            lastUpdated: new Date().toISOString(),
            reason: reason || 'Direct plan update'
        }, { merge: true });

        // Log the plan change
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.SUBSCRIPTION,
            userId: userId,
            resourceId: userId,
            details: {
                oldPlan: oldPlan,
                newPlan: planId,
                reason: reason || 'Direct plan update',
                amount: newPlan.amount,
                interval: newPlan.interval
            }
        });

        res.status(200).json({
            status: true,
            message: 'Subscription plan updated successfully',
            data: {
                subscriptionCode: userData.subscriptionCode || `SUB_${userId}`,
                newPlan: planId,
                effectiveDate: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error updating subscription plan:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to update subscription plan',
            error: error.message
        });
    }
};

/**
 * Get user's subscription history (Phase 1)
 */
const getSubscriptionHistory = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 50;
        
        // Get subscription history using helper function
        const history = await getUserSubscriptionHistory(userId, limit);
        
        // Get history count
        const totalCount = await getUserSubscriptionHistoryCount(userId);
        
        res.status(200).json({
            status: true,
            message: 'Subscription history retrieved successfully',
            data: {
                history: history,
                totalSubscriptions: totalCount,
                hasHistory: totalCount > 0
            }
        });
    } catch (error) {
        console.error('Error getting subscription history:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve subscription history',
            error: error.message
        });
    }
};

/**
 * Clean up user subscription fields (Phase 2)
 * Admin endpoint for gradual cleanup of user records
 */
const cleanupUserRecord = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Perform cleanup
        const fieldsRemoved = await cleanupUserSubscriptionFields(userId);
        
        res.status(200).json({
            status: true,
            message: fieldsRemoved > 0 
                ? `Successfully cleaned up ${fieldsRemoved} subscription fields from user record`
                : 'User record is already clean - no subscription fields to remove',
            data: {
                userId: userId,
                fieldsRemoved: fieldsRemoved,
                wasCleanupNeeded: fieldsRemoved > 0
            }
        });
    } catch (error) {
        console.error('Error cleaning up user record:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to clean up user record',
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
    getSubscriptionLogs,
    updateSubscriptionPlan,
    getSubscriptionHistory,
    cleanupUserRecord
};
