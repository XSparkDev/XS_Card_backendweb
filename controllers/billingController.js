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
        const customerCode = userData.customerCode;
        
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
    storePaymentMethod
}; 