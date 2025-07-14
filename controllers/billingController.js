const https = require('https');
const { db, admin } = require('../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Get user's saved payment methods from Paystack
 */
const getPaymentMethods = async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Get user document to find customer code
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        
        const userData = userDoc.data();
        let customerCode = userData.customerCode;
        
        // === PHASE 2: CHECK SUBSCRIPTIONS COLLECTION FOR CUSTOMER CODE ===
        // If no customerCode in users collection, check subscriptions collection
        if (!customerCode) {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                customerCode = subscriptionData.customerCode;
            }
        }
        
        if (!customerCode) {
            // User hasn't made any payments yet, return empty array
            return res.status(200).json({
                status: true,
                data: []
            });
        }
        
        // Get customer details from Paystack
        const customerData = await getPaystackCustomer(customerCode);
        
        if (!customerData.status) {
            return res.status(400).json({
                status: false,
                message: 'Failed to retrieve customer data from Paystack',
                error: customerData.message
            });
        }
        
        // Get payment methods stored in our database
        const paymentMethodsSnapshot = await db.collection('paymentMethods')
            .where('userId', '==', userId)
            .get();
        
        const paymentMethods = [];
        paymentMethodsSnapshot.forEach(doc => {
            const methodData = doc.data();
            paymentMethods.push({
                id: doc.id,
                type: methodData.type || 'card',
                brand: methodData.brand || 'unknown',
                last4: methodData.last4 || '****',
                expiryMonth: methodData.expiryMonth || null,
                expiryYear: methodData.expiryYear || null,
                isDefault: methodData.isDefault || false,
                customerCode: customerCode,
                createdAt: methodData.createdAt
            });
        });
        
        res.status(200).json({
            status: true,
            data: paymentMethods
        });
        
    } catch (error) {
        console.error('Error getting payment methods:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to retrieve payment methods',
            error: error.message
        });
    }
};

/**
 * Update a payment method's details
 */
const updatePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.uid;
        const paymentMethodId = req.params.id;
        const { isDefault, expiryMonth, expiryYear } = req.body;
        
        // Get payment method document
        const paymentMethodRef = db.collection('paymentMethods').doc(paymentMethodId);
        const paymentMethodDoc = await paymentMethodRef.get();
        
        if (!paymentMethodDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'Payment method not found'
            });
        }
        
        const paymentMethodData = paymentMethodDoc.data();
        
        // Verify ownership
        if (paymentMethodData.userId !== userId) {
            return res.status(403).json({
                status: false,
                message: 'Unauthorized access to payment method'
            });
        }
        
        // Prepare update data
        const updateData = {
            lastUpdated: new Date().toISOString()
        };
        
        if (isDefault !== undefined) {
            updateData.isDefault = isDefault;
            
            // If setting as default, unset other default methods
            if (isDefault) {
                const batch = db.batch();
                
                // Find other payment methods for this user and unset default
                const otherMethodsSnapshot = await db.collection('paymentMethods')
                    .where('userId', '==', userId)
                    .where('isDefault', '==', true)
                    .get();
                
                otherMethodsSnapshot.forEach(doc => {
                    if (doc.id !== paymentMethodId) {
                        batch.update(doc.ref, { isDefault: false });
                    }
                });
                
                await batch.commit();
            }
        }
        
        if (expiryMonth !== undefined) updateData.expiryMonth = expiryMonth;
        if (expiryYear !== undefined) updateData.expiryYear = expiryYear;
        
        // Update the payment method
        await paymentMethodRef.update(updateData);
        
        // Get updated document
        const updatedDoc = await paymentMethodRef.get();
        const updatedData = updatedDoc.data();
        
        // Log the update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: 'PAYMENT_METHOD',
            userId: userId,
            resourceId: paymentMethodId,
            details: {
                updates: updateData,
                paymentMethodType: updatedData.type
            }
        });
        
        res.status(200).json({
            status: true,
            message: 'Payment method updated successfully',
            data: {
                id: paymentMethodId,
                isDefault: updatedData.isDefault,
                expiryMonth: updatedData.expiryMonth,
                expiryYear: updatedData.expiryYear,
                lastUpdated: updatedData.lastUpdated
            }
        });
        
    } catch (error) {
        console.error('Error updating payment method:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to update payment method',
            error: error.message
        });
    }
};

/**
 * Delete a payment method
 */
const deletePaymentMethod = async (req, res) => {
    try {
        const userId = req.user.uid;
        const paymentMethodId = req.params.id;
        
        // Get payment method document
        const paymentMethodRef = db.collection('paymentMethods').doc(paymentMethodId);
        const paymentMethodDoc = await paymentMethodRef.get();
        
        if (!paymentMethodDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'Payment method not found'
            });
        }
        
        const paymentMethodData = paymentMethodDoc.data();
        
        // Verify ownership
        if (paymentMethodData.userId !== userId) {
            return res.status(403).json({
                status: false,
                message: 'Unauthorized access to payment method'
            });
        }
        
        // Check if this is the only payment method
        const userPaymentMethodsSnapshot = await db.collection('paymentMethods')
            .where('userId', '==', userId)
            .get();
        
        if (userPaymentMethodsSnapshot.size === 1) {
            return res.status(400).json({
                status: false,
                message: 'Cannot delete the only payment method. Add another payment method first.'
            });
        }
        
        // If this was the default method, set another one as default
        if (paymentMethodData.isDefault && userPaymentMethodsSnapshot.size > 1) {
            // Find another payment method to set as default
            const otherMethod = userPaymentMethodsSnapshot.docs.find(doc => doc.id !== paymentMethodId);
            if (otherMethod) {
                await otherMethod.ref.update({ isDefault: true });
            }
        }
        
        // Delete the payment method
        await paymentMethodRef.delete();
        
        // Log the deletion
        await logActivity({
            action: ACTIONS.DELETE,
            resource: 'PAYMENT_METHOD',
            userId: userId,
            resourceId: paymentMethodId,
            details: {
                deletedMethod: {
                    type: paymentMethodData.type,
                    last4: paymentMethodData.last4,
                    wasDefault: paymentMethodData.isDefault
                }
            }
        });
        
        res.status(200).json({
            status: true,
            message: 'Payment method deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting payment method:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to delete payment method',
            error: error.message
        });
    }
};

/**
 * Add a new payment method for the user
 * This creates a Paystack authorization and stores it in our database
 */
const addPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { email, amount = 100 } = req.body; // Default R1.00 verification amount

        // Get user document to find customer code or create new customer
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        const userData = userDoc.data();
        let customerCode = userData.customerCode;
        
        // Check subscriptions collection if no customerCode in users
        if (!customerCode) {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                customerCode = subscriptionData.customerCode;
            }
        }

        const userEmail = email || userData.email;
        if (!userEmail) {
            return res.status(400).json({
                status: false,
                message: 'Email is required'
            });
        }

        const baseUrl = process.env.APP_URL;

        // Prepare Paystack request parameters for payment method verification
        const params = JSON.stringify({
            email: userEmail,
            amount: amount, // Verification amount in kobo (R1.00 = 100 kobo)
            callback_url: `${baseUrl}/billing/payment-method/callback`,
            metadata: {
                userId: userId,
                isPaymentMethodSetup: true,
                customerCode: customerCode || null
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
        const paymentReq = https.request(options, paymentRes => {
            let data = '';

            paymentRes.on('data', (chunk) => {
                data += chunk;
            });

            paymentRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.status) {
                        // Log the payment method setup initiation
                        logActivity({
                            action: ACTIONS.CREATE,
                            resource: 'PAYMENT_METHOD_SETUP',
                            userId: userId,
                            resourceId: response.data.reference,
                            details: {
                                email: userEmail,
                                amount: amount / 100,
                                verificationOnly: true
                            }
                        });
                    }
                    
                    res.status(200).json(response);
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    res.status(500).json({
                        status: false,
                        message: 'Failed to parse Paystack response',
                        error: error.message
                    });
                }
            });
        });

        paymentReq.on('error', (error) => {
            console.error('Payment method setup error:', error);
            res.status(500).json({ 
                status: false,
                message: 'Payment method setup failed',
                error: error.message 
            });
        });

        paymentReq.write(params);
        paymentReq.end();

    } catch (error) {
        console.error('Add payment method controller error:', error);
        res.status(500).json({ 
            status: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

/**
 * Handle payment method callback from Paystack
 * This processes the verification payment and stores the payment method
 */
const handlePaymentMethodCallback = async (req, res) => {
    try {
        const reference = req.method === 'POST' ? req.body.data?.reference : req.query.reference;
        
        if (!reference) {
            console.error('No reference provided');
            return res.status(400).json({ message: 'No reference provided' });
        }

        console.log('Processing payment method reference:', reference);
        
        // Verify transaction with Paystack
        const paymentData = await verifyTransaction(reference);
        console.log('Payment method verification response:', paymentData);
        
        if (paymentData.status && paymentData.data.status === 'success') {
            // Get user info from payment data
            const userEmail = paymentData.data.customer.email;
            const customerCode = paymentData.data.customer.customer_code;
            const metadata = paymentData.data.metadata || {};
            const userId = metadata.userId;
            
            if (!userId) {
                console.error('No userId in metadata');
                return res.status(400).json({ message: 'Invalid payment method setup' });
            }
            
            // Issue refund for verification amount
            const refundResult = await issueVerificationRefund(reference);
            if (!refundResult.status) {
                console.error('Failed to issue refund:', refundResult);
            }
            
            // Store the payment method
            if (paymentData.data.authorization) {
                const paymentMethodId = await storePaymentMethod(userId, customerCode, paymentData.data.authorization);
                
                // Log successful payment method addition
                await logActivity({
                    action: ACTIONS.CREATE,
                    resource: 'PAYMENT_METHOD',
                    userId: userId,
                    resourceId: paymentMethodId,
                    details: {
                        brand: paymentData.data.authorization.brand,
                        last4: paymentData.data.authorization.last4,
                        source: 'manual_addition'
                    }
                });
                
                console.log('Payment method added successfully');
            }
            
            // Redirect or respond based on request method
            if (req.method === 'GET') {
                return res.redirect('/payment-method-success.html');
            } else {
                return res.status(200).json({ 
                    status: 'success',
                    message: 'Payment method added successfully'
                });
            }
        } else {
            console.error('Payment method verification failed:', paymentData);
            if (req.method === 'GET') {
                return res.redirect('/payment-method-failed.html');
            } else {
                return res.status(400).json({ 
                    status: 'failed',
                    message: 'Payment method verification failed'
                });
            }
        }
    } catch (error) {
        console.error('Payment method callback error:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Verify transaction with Paystack
 */
const verifyTransaction = async (reference) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/transaction/verify/${reference}`,
        method: 'GET',
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
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Issue refund for verification amount
 */
const issueVerificationRefund = async (reference) => {
    const params = JSON.stringify({
        transaction: reference,
        amount: 100 // R1.00 in kobo
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
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}`));
                }
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
 * Helper function to get customer data from Paystack
 */
const getPaystackCustomer = async (customerCode) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: `/customer/${customerCode}`,
            method: 'GET',
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
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Helper function to store payment method in database
 * This is called from subscription callbacks when new payment methods are created
 */
const storePaymentMethod = async (userId, customerCode, authorizationData) => {
    try {
        const paymentMethodData = {
            userId: userId,
            customerCode: customerCode,
            type: 'card',
            brand: authorizationData.brand || 'unknown',
            last4: authorizationData.last4 || '****',
            expiryMonth: authorizationData.exp_month || null,
            expiryYear: authorizationData.exp_year || null,
            authorizationCode: authorizationData.authorization_code,
            isDefault: true, // First payment method is default
            createdAt: new Date().toISOString()
        };

        // Check if user has other payment methods
        const existingMethodsSnapshot = await db.collection('paymentMethods')
            .where('userId', '==', userId)
            .get();

        // If user has existing methods, this won't be default
        if (!existingMethodsSnapshot.empty) {
            paymentMethodData.isDefault = false;
        }

        // Store the payment method
        const docRef = await db.collection('paymentMethods').add(paymentMethodData);
        
        console.log('Payment method stored with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error storing payment method:', error);
        throw error;
    }
};

module.exports = {
    getPaymentMethods,
    updatePaymentMethod,
    deletePaymentMethod,
    storePaymentMethod,
    addPaymentMethod,
    handlePaymentMethodCallback
};