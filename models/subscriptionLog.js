const { db } = require('../firebase');

/**
 * Logs subscription-related events
 * @param {string} userId - User ID
 * @param {string} eventType - Type of event (create, update, cancel, etc.)
 * @param {object} eventData - Event details
 */
const logSubscriptionEvent = async (userId, eventType, eventData) => {
    try {
        // Create log entry
        const logEntry = {
            userId,
            eventType,
            eventData,
            timestamp: new Date().toISOString(),
        };
        
        // Add to user's subscription log collection
        await db.collection('subscriptionLogs').add(logEntry);
        
        // Also update the main subscription document with last event
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (subscriptionDoc.exists) {
            await subscriptionDoc.ref.update({
                lastEvent: {
                    type: eventType,
                    timestamp: new Date().toISOString(),
                    details: eventData
                }
            });
        }
        
        console.log(`Logged subscription event: ${eventType} for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Error logging subscription event:', error);
        // Don't throw error to avoid disrupting main flow
        return false;
    }
};

/**
 * Get subscription logs for a user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs to retrieve
 */
const getSubscriptionLogs = async (userId, limit = 20) => {
    try {
        const logsSnapshot = await db.collection('subscriptionLogs')
            .where('userId', '==', userId)
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
        
        return logs;
    } catch (error) {
        console.error('Error getting subscription logs:', error);
        throw error;
    }
};

module.exports = {
    logSubscriptionEvent,
    getSubscriptionLogs
};
