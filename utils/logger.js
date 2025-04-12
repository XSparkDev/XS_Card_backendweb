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

/**
 * Get activity logs by action type
 * @param {string} action - Action type from ACTIONS
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - List of matching activity logs
 */
const getActivitiesByAction = async (action, options = {}) => {
  try {
    if (!action) {
      throw new Error('Action parameter is required');
    }
    
    // Start with basic query
    let query = db.collection('activityLogs').where('action', '==', action);
    
    // Add optional filters
    if (options.userId) {
      query = query.where('userId', '==', options.userId);
    }
    
    if (options.resource) {
      query = query.where('resource', '==', options.resource);
    }
    
    if (options.status) {
      query = query.where('status', '==', options.status);
    }
    
    // Add time range filter if provided
    if (options.startTime) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(options.startTime));
      query = query.where('timestamp', '>=', startTimestamp);
    }
    
    if (options.endTime) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(options.endTime));
      query = query.where('timestamp', '<=', endTimestamp);
    }
    
    // Order by timestamp (default to descending - newest first)
    const orderDirection = options.orderDirection === 'asc' ? 'asc' : 'desc';
    query = query.orderBy('timestamp', orderDirection);
    
    // Apply pagination
    const limit = options.limit && !isNaN(options.limit) ? parseInt(options.limit) : 50;
    query = query.limit(limit);
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    const activities = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        action: data.action,
        resource: data.resource,
        userId: data.userId,
        resourceId: data.resourceId,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        status: data.status,
        details: data.details
      });
    });
    
    return activities;
  } catch (error) {
    console.error('Error fetching activities by action:', error);
    throw error;
  }
};

/**
 * Get activity logs by resource type
 * @param {string} resource - Resource type from RESOURCES
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - List of matching activity logs
 */
const getActivitiesByResource = async (resource, options = {}) => {
  try {
    if (!resource) {
      throw new Error('Resource parameter is required');
    }
    
    // Start with basic query
    let query = db.collection('activityLogs').where('resource', '==', resource);
    
    // Add optional filters
    if (options.userId) {
      query = query.where('userId', '==', options.userId);
    }
    
    if (options.action) {
      query = query.where('action', '==', options.action);
    }
    
    if (options.status) {
      query = query.where('status', '==', options.status);
    }
    
    // Add time range filter if provided
    if (options.startTime) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(options.startTime));
      query = query.where('timestamp', '>=', startTimestamp);
    }
    
    if (options.endTime) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(options.endTime));
      query = query.where('timestamp', '<=', endTimestamp);
    }
    
    // Order by timestamp (default to descending - newest first)
    const orderDirection = options.orderDirection === 'asc' ? 'asc' : 'desc';
    query = query.orderBy('timestamp', orderDirection);
    
    // Apply limit
    const limit = options.limit && !isNaN(options.limit) ? parseInt(options.limit) : 50;
    query = query.limit(limit);
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    const activities = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        action: data.action,
        resource: data.resource,
        userId: data.userId,
        resourceId: data.resourceId,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        status: data.status,
        details: data.details
      });
    });
    
    return activities;
  } catch (error) {
    console.error('Error fetching activities by resource:', error);
    throw error;
  }
};

module.exports = { 
  logActivity,
  ACTIONS,
  RESOURCES,
  testLogging,
  getActivitiesByAction,
  getActivitiesByResource
};