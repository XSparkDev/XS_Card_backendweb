const { db, admin } = require('../firebase');

// Standard action types
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
  SEND: 'send',
  VERIFY: 'verify',
  APPLY: 'apply',
  INITIALIZE: 'initialize',
  CANCEL: 'cancel',
  ERROR: 'error',
  GENERATE: 'generate'
};

// Resource types
const RESOURCES = {
  USER: 'user',
  CARD: 'card',
  TEMPLATE: 'template',
  DEPARTMENT: 'department',
  TEAM: 'team',
  EMPLOYEE: 'employee',
  CONTACT: 'contact',
  MEETING: 'meeting',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
  EMAIL: 'email',
  SYSTEM: 'system',
  WALLET_PASS: 'wallet_pass',
  QR_CODE: 'qr_code'
};

/**
 * Log an activity to the activityLogs collection
 * @param {Object} data - Log data
 * @param {string} data.action - Action performed (use ACTIONS constant)
 * @param {string} data.resource - Resource type (use RESOURCES constant)
 * @param {string} data.userId - User who performed the action
 * @param {string} data.resourceId - ID of the affected resource
 * @param {Object} data.details - Additional context
 * @returns {Promise<boolean>} - Success status
 */
const logActivity = async (data) => {
  try {
    // Basic validation
    if (!data.action || !data.resource) {
      console.warn('Missing required log fields: action and resource are required');
      return false;
    }
    
    console.log('💾 LOGGING ACTIVITY:', { 
      action: data.action, 
      resource: data.resource, 
      userId: data.userId
    });
    
    // Format timestamp
    const timestamp = data.timestamp || admin.firestore.Timestamp.now();
    // Create base log entry with required fields
    const logEntry = {
      timestamp,
      action: data.action,
      resource: data.resource,
      status: data.status || 'success',
      userId: data.userId || 'system',
      resourceId: data.resourceId || null,
      details: data.details || {}
    };
    
    // Add optional fields only if they are defined
    if (data.ip) logEntry.ip = data.ip;
    if (data.enterpriseId) logEntry.enterpriseId = data.enterpriseId;
    if (data.departmentId) logEntry.departmentId = data.departmentId;
    
    console.log('Log entry object before saving:', JSON.stringify(logEntry));
    // Write to Firestore with explicit error logging
    try {
      const docRef = await db.collection('activityLogs').add(logEntry);
      console.log(`✅ Activity logged successfully with ID: ${docRef.id}`);
      return true;
    } catch (dbError) {
      console.error('❌ FIRESTORE ERROR WHEN LOGGING:', dbError);
      console.error('Failed data:', JSON.stringify(logEntry));
      return false;
    }
  } catch (error) {
    console.error('❌ LOGGER FUNCTION ERROR:', error);
    return false;
  }
};

// Test function to verify logging works
const testLogging = async () => {
  console.log('🧪 Running test log...');
  try {
    console.log('Testing Firestore connection...');
    const testDoc = await db.collection('_test_').doc('connection_test').set({
      timestamp: admin.firestore.Timestamp.now(),
      message: 'Connection test'
    });
    console.log('✅ Basic Firestore write successful');
    
    const result = await logActivity({
      action: ACTIONS.CREATE,
      resource: RESOURCES.SYSTEM,
      userId: 'system',
      details: {
        message: 'Test log entry',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('Activity log test result:', result);
    return result;
  } catch (error) {
    console.error('❌ FIREBASE CONNECTION TEST FAILED:', error);
    console.error('Firebase app state:', db.app.name);
    return false;
  }
};

module.exports = { 
  logActivity,
  ACTIONS,
  RESOURCES,
  testLogging
};