const { db, admin } = require('../firebase.js');
const { getActivitiesByAction, getActivitiesByResource, ACTIONS, RESOURCES } = require('../utils/logger');

// Helper function for standardized error responses
const sendError = (res, status, message, error = null) => {
  console.error(`${message}:`, error);
  res.status(status).json({ 
    success: false,
    message,
    ...(error && { error: error.message }),
    timestamp: new Date().toISOString()
  });
};

// Add debug request information
const logRequestInfo = (req) => {
  console.log('------ Activity Log Request ------');
  console.log(`Path: ${req.path}`);
  console.log(`Method: ${req.method}`);
  console.log('Query parameters:', req.query);
  console.log('Headers:', req.headers);
  console.log('User:', req.user?.uid || 'Not authenticated');
  console.log('----------------------------------');
};

/**
 * Get activities by action
 */
exports.getByAction = async (req, res) => {
  try {
    logRequestInfo(req);
    const { action } = req.params;
    
    // Validate action
    if (!action || !Object.values(ACTIONS).includes(action)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or missing action parameter',
        validActions: Object.values(ACTIONS)
      });
    }
    
    // Build options from query parameters
    const options = {
      userId: req.query.userId,
      resource: req.query.resource,
      status: req.query.status,
      limit: req.query.limit,
      orderDirection: req.query.order,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    
    console.log('Querying activities with options:', options);
    
    // Validate resource if provided
    if (options.resource && !Object.values(RESOURCES).includes(options.resource)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid resource parameter',
        validResources: Object.values(RESOURCES)
      });
    }
    
    try {
      // Try with normal query first
      const activities = await getActivitiesByAction(action, options);
      
      console.log(`Found ${activities.length} activities for action: ${action}`);
      
      res.status(200).json({
        success: true,
        count: activities.length,
        action,
        filters: options,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('action', '==', action);
        
        // Add limit
        const limit = options.limit ? parseInt(options.limit) : 50;
        query = query.limit(limit);
        
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
            status: data.status || 'success',
            details: data.details || {}
          });
        });
        
        // Sort manually (client-side) since we can't use server-side sorting
        activities.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          // Sort descending by default (newest first)
          return options.orderDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });
        
        return res.status(200).json({
          success: true,
          count: activities.length,
          action,
          filters: options,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          indexUrl: queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)[0]
        });
      }
      
      // If it's not an index issue or fallback fails, re-throw the error
      throw queryError;
    }
    
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve activity logs', error);
  }
};

/**
 * Get activities by resource
 */
exports.getByResource = async (req, res) => {
  try {
    logRequestInfo(req);
    const { resource } = req.params;
    
    // Validate resource
    if (!resource || !Object.values(RESOURCES).includes(resource)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or missing resource parameter',
        validResources: Object.values(RESOURCES)
      });
    }
    
    // Build options from query parameters
    const options = {
      userId: req.query.userId,
      action: req.query.action,
      status: req.query.status,
      limit: req.query.limit,
      orderDirection: req.query.order,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    
    console.log('Querying activities with options:', options);
    
    // Validate action if provided
    if (options.action && !Object.values(ACTIONS).includes(options.action)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid action parameter',
        validActions: Object.values(ACTIONS)
      });
    }
    
    try {
      const activities = await getActivitiesByResource(resource, options);
      
      console.log(`Found ${activities.length} activities for resource: ${resource}`);
      
      res.status(200).json({
        success: true,
        count: activities.length,
        resource,
        filters: options,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('resource', '==', resource);
        
        // Add additional filters if needed
        if (options.action) {
          query = query.where('action', '==', options.action);
        }
        
        if (options.userId) {
          query = query.where('userId', '==', options.userId);
        }
        
        // Add limit
        const limit = options.limit ? parseInt(options.limit) : 50;
        query = query.limit(limit);
        
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
            status: data.status || 'success',
            details: data.details || {}
          });
        });
        
        // Sort manually (client-side) since we can't use server-side sorting
        activities.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          // Sort descending by default (newest first)
          return options.orderDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });
        
        return res.status(200).json({
          success: true,
          count: activities.length,
          resource,
          filters: options,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          indexUrl: queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)[0]
        });
      }
      
      // If it's not an index issue or fallback fails, re-throw the error
      throw queryError;
    }
    
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve activity logs', error);
  }
};

/**
 * Get all activities with filtering
 */
exports.getAll = async (req, res) => {
  try {
    logRequestInfo(req);
    // Start with basic query
    let query = db.collection('activityLogs');
    
    // Add filters based on query parameters
    if (req.query.action && Object.values(ACTIONS).includes(req.query.action)) {
      query = query.where('action', '==', req.query.action);
    }
    
    if (req.query.resource && Object.values(RESOURCES).includes(req.query.resource)) {
      query = query.where('resource', '==', req.query.resource);
    }
    
    if (req.query.userId) {
      query = query.where('userId', '==', req.query.userId);
    }
    
    if (req.query.status) {
      query = query.where('status', '==', req.query.status);
    }
    
    // Add time range filters
    if (req.query.startTime) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(req.query.startTime));
      query = query.where('timestamp', '>=', startTimestamp);
    }
    
    // Note: Firebase doesn't allow multiple range comparisons in the same query
    // So we can't use both timestamp >= and timestamp <= filters directly
    
    // Order by timestamp (always needed for pagination)
    const orderDirection = req.query.order === 'asc' ? 'asc' : 'desc';
    query = query.orderBy('timestamp', orderDirection);
    
    // Then we can filter the end time client-side
    const endTime = req.query.endTime ? new Date(req.query.endTime).getTime() : null;
    
    // Apply pagination
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    query = query.limit(limit);
    
    // Handle pagination with startAfter if provided
    if (req.query.startAfter) {
      const startAfterDoc = await db.collection('activityLogs').doc(req.query.startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }
    
    // Execute query
    const snapshot = await query.get();
    
    // Process results
    const activities = [];
    let lastDocId = null;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Apply end time filter client-side if needed
      if (endTime && data.timestamp) {
        const timestamp = data.timestamp.toDate ? data.timestamp.toDate().getTime() : 
                        (data.timestamp._seconds ? data.timestamp._seconds * 1000 : null);
        
        if (timestamp && timestamp > endTime) {
          return; // Skip this document
        }
      }
      
      // Format the activity
      activities.push({
        id: doc.id,
        action: data.action,
        resource: data.resource,
        userId: data.userId,
        resourceId: data.resourceId,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        status: data.status || 'success',
        details: data.details || {}
      });
      
      // Track the last document ID for pagination
      lastDocId = doc.id;
    });
    
    console.log(`Found ${activities.length} activities`);
    
    res.status(200).json({
      success: true,
      count: activities.length,
      activities,
      pagination: {
        limit,
        nextStartAfter: lastDocId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve activity logs', error);
  }
};

/**
 * Get user activity history
 */
exports.getUserHistory = async (req, res) => {
  try {
    logRequestInfo(req);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Verify the user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }
    
    try {
      // Create query for user's activities
      let query = db.collection('activityLogs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(req.query.limit ? parseInt(req.query.limit) : 50);
      
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
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          status: data.status,
          details: data.details
        });
      });
      
      console.log(`Found ${activities.length} activities for user: ${userId}`);
      
      res.status(200).json({
        success: true,
        userId,
        count: activities.length,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('userId', '==', userId);
        
        // Add limit
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process results
        const activities = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            action: data.action,
            resource: data.resource,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            status: data.status,
            details: data.details
          });
        });
        
        // Sort manually by timestamp (newest first)
        activities.sort((a, b) => {
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          return timeB - timeA;
        });
        
        console.log(`Found ${activities.length} activities for user: ${userId} (client-side sorting)`);
        
        return res.status(200).json({
          success: true,
          userId,
          count: activities.length,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          indexUrl: queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)[0]
        });
      }
      
      throw queryError;
    }
    
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve user activity history', error);
  }
};

/**
 * Get recent errors
 */
exports.getErrors = async (req, res) => {
  try {
    logRequestInfo(req);
    
    // Simplified query that doesn't require a composite index
    let query = db.collection('activityLogs');
    
    // For now, just filter by action without sorting
    query = query.where('action', '==', ACTIONS.ERROR);
    
    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit));
    } else {
      query = query.limit(50);
    }
    
    try {
      // Execute query
      const snapshot = await query.get();
      
      // Process results
      const errors = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        errors.push({
          id: doc.id,
          resource: data.resource,
          userId: data.userId,
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          details: data.details
        });
      });
      
      // Sort client-side (since we can't use server sorting without index)
      errors.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
        return timeB - timeA; // descending order
      });
      
      console.log(`Found ${errors.length} error logs`);
      
      res.status(200).json({
        success: true,
        count: errors.length,
        errors,
        timestamp: new Date().toISOString(),
        note: 'Results sorted client-side. For server-side sorting, create the required indexes.'
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        // Extract the index creation URL from the error message
        const urlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        const indexUrl = urlMatch ? urlMatch[0] : null;
        
        return res.status(400).json({
          success: false,
          message: 'This query requires a Firestore index',
          error: 'Missing required index',
          solution: 'Create the required index in Firebase console',
          indexUrl: indexUrl,
          details: `You need to create the index by visiting: ${indexUrl}`
        });
      }
      throw queryError;
    }
    
  } catch (error) {
    sendError(res, 500, 'Failed to retrieve error logs', error);
  }
};
