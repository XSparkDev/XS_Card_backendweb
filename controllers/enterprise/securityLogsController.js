const { db, admin } = require('../../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../../utils/logger');

/**
 * Get security logs for an enterprise
 */
exports.getSecurityLogs = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { 
      userId,
      action,
      resource,
      timeframe = '24h', // 24h, 7d, 30d
      limit = 100,
      startAfter,
      search,
      success // true, false, or undefined for all
    } = req.query;

    console.log(`🔍 [SecurityLogs] Getting logs for enterprise: ${enterpriseId}`);

    // Verify user has access to this enterprise
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security logs'
      });
    }

    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get users in this enterprise for filtering
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`))
      .get();

    const enterpriseUserIds = new Set();
    const userInfoMap = new Map();
    
    enterpriseUsersSnapshot.forEach(doc => {
      const userData = doc.data();
      enterpriseUserIds.add(doc.id);
      userInfoMap.set(doc.id, {
        id: doc.id,
        name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
        email: userData.email,
        role: userData.role || 'user'
      });
    });

    // Build query for activity logs with fallback for missing indexes
    let snapshot;
    let indexError = null;
    
    try {
      // Try the optimized query first (requires composite index)
      let query = db.collection('activityLogs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime));

      // Add filters
      if (userId && enterpriseUserIds.has(userId)) {
        query = query.where('userId', '==', userId);
      }
      
      if (action) {
        query = query.where('action', '==', action);
      }
      
      if (resource) {
        query = query.where('resource', '==', resource);
      }

      if (success !== undefined) {
        const successValue = success === 'true';
        query = query.where('status', '==', successValue ? 'success' : 'error');
      }

      // Order by timestamp (newest first) and limit
      query = query.orderBy('timestamp', 'desc').limit(parseInt(limit));

      if (startAfter) {
        const startAfterDoc = await db.collection('activityLogs').doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      snapshot = await query.get();
    } catch (error) {
      indexError = error;
      console.log('Composite index not available, using fallback query:', error.message);
      
      // Fallback: Get all logs for time range and filter in memory
      snapshot = await db.collection('activityLogs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime))
        .limit(1000) // Increase limit for fallback to ensure we get enough data
        .get();
    }
    const allLogs = [];

    // Process all logs and filter by enterprise
    snapshot.forEach(doc => {
      const logData = doc.data();
      
      // Include log if user belongs to enterprise or is system
      if (enterpriseUserIds.has(logData.userId) || logData.userId === 'system') {
        // If using fallback query, apply filters in memory
        if (indexError) {
          // Filter by userId
          if (userId && enterpriseUserIds.has(userId) && logData.userId !== userId) {
            return;
          }
          
          // Filter by action
          if (action && logData.action !== action) {
            return;
          }
          
          // Filter by resource
          if (resource && logData.resource !== resource) {
            return;
          }
          
          // Filter by success status
          if (success !== undefined) {
            const successValue = success === 'true';
            const expectedStatus = successValue ? 'success' : 'error';
            if (logData.status !== expectedStatus) {
              return;
            }
          }
        }
        
        allLogs.push({
          id: doc.id,
          ...logData,
          timestamp: logData.timestamp?.toDate?.() || logData.timestamp
        });
      }
    });

    // Sort by timestamp if we used fallback query
    if (indexError && allLogs.length > 0) {
      allLogs.sort((a, b) => {
        const aTime = new Date(a.timestamp);
        const bTime = new Date(b.timestamp);
        return bTime - aTime; // Newest first
      });
      
      // Apply limit after sorting
      allLogs.splice(parseInt(limit));
    }

    // Apply search filter if provided
    let filteredLogs = allLogs;
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredLogs = allLogs.filter(log => {
        const userInfo = userInfoMap.get(log.userId);
        return (
          log.action?.toLowerCase().includes(searchTerm) ||
          log.resource?.toLowerCase().includes(searchTerm) ||
          userInfo?.name?.toLowerCase().includes(searchTerm) ||
          userInfo?.email?.toLowerCase().includes(searchTerm) ||
          log.details?.error?.toLowerCase().includes(searchTerm) ||
          JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm)
        );
      });
    }

    // Format logs for response
    const securityLogs = filteredLogs.map(log => {
      const userInfo = userInfoMap.get(log.userId);
      
      return {
        id: log.id,
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
        userId: log.userId,
        userName: userInfo?.name || (log.userId === 'system' ? 'System' : 'Unknown'),
        userEmail: userInfo?.email || (log.userId === 'system' ? 'system@internal' : 'unknown'),
        userRole: userInfo?.role || (log.userId === 'system' ? 'system' : 'unknown'),
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        success: log.status !== 'error',
        status: log.status || 'success',
        errorMessage: log.status === 'error' ? log.details?.error : null,
        ipAddress: log.details?.ipAddress || log.ip,
        userAgent: log.details?.userAgent,
        location: log.details?.location,
        metadata: {
          ...log.details,
          enterpriseId: enterpriseId // Add enterprise context
        }
      };
    });

    // Get total count for pagination
    const totalCount = securityLogs.length;
    const hasMore = snapshot.docs.length === parseInt(limit);

    // Log the access
    await logActivity({
      action: ACTIONS.READ,
      resource: 'SECURITY_LOGS',
      userId: req.user.uid,
      enterpriseId: enterpriseId,
      details: {
        logCount: securityLogs.length,
        timeframe: timeframe,
        filters: { userId, action, resource, search }
      }
    });

    res.status(200).json({
      status: true,
      data: {
        logs: securityLogs,
        totalCount: totalCount,
        hasMore: hasMore,
        lastTimestamp: securityLogs.length > 0 ? securityLogs[securityLogs.length - 1].timestamp : null,
        filters: {
          timeframe,
          userId,
          action,
          resource,
          search,
          success
        },
        meta: {
          enterpriseUserCount: enterpriseUserIds.size,
          timeRange: {
            start: startTime.toISOString(),
            end: now.toISOString()
          },
          fallbackQuery: indexError ? true : false,
          fallbackReason: indexError ? 'Composite index not available - results filtered in memory' : null
        }
      }
    });

  } catch (error) {
    console.error('Error getting security logs:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve security logs',
      error: error.message
    });
  }
};

/**
 * Export security logs for compliance/audit purposes
 */
exports.exportSecurityLogs = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { 
      format = 'json', // json, csv
      timeframe = '30d',
      userId,
      action,
      resource
    } = req.query;

    console.log(`📊 [SecurityLogs] Exporting logs for enterprise: ${enterpriseId}, format: ${format}`);

    // Verify user has access to this enterprise
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security logs'
      });
    }

    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get users in this enterprise
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`))
      .get();

    const enterpriseUserIds = new Set();
    const userInfoMap = new Map();
    
    enterpriseUsersSnapshot.forEach(doc => {
      const userData = doc.data();
      enterpriseUserIds.add(doc.id);
      userInfoMap.set(doc.id, {
        id: doc.id,
        name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
        email: userData.email,
        role: userData.role || 'user'
      });
    });

    // Build query for activity logs with fallback for missing indexes
    let snapshot;
    let indexError = null;
    
    try {
      // Try the optimized query first (requires composite index)
      let query = db.collection('activityLogs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime))
        .orderBy('timestamp', 'desc');

      // Add filters
      if (userId && enterpriseUserIds.has(userId)) {
        query = query.where('userId', '==', userId);
      }
      
      if (action) {
        query = query.where('action', '==', action);
      }
      
      if (resource) {
        query = query.where('resource', '==', resource);
      }

      // Get all matching logs (no limit for export)
      snapshot = await query.get();
    } catch (error) {
      indexError = error;
      console.log('Composite index not available for export, using fallback query:', error.message);
      
      // Fallback: Get all logs for time range and filter in memory
      snapshot = await db.collection('activityLogs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime))
        .get();
    }
    const allLogs = [];

    // Process all logs and filter by enterprise
    snapshot.forEach(doc => {
      const logData = doc.data();
      
      // Include log if user belongs to enterprise or is system
      if (enterpriseUserIds.has(logData.userId) || logData.userId === 'system') {
        const userInfo = userInfoMap.get(logData.userId);
        
        allLogs.push({
          id: doc.id,
          timestamp: logData.timestamp?.toDate?.() ? logData.timestamp.toDate().toISOString() : logData.timestamp,
          userId: logData.userId,
          userName: userInfo?.name || (logData.userId === 'system' ? 'System' : 'Unknown'),
          userEmail: userInfo?.email || (logData.userId === 'system' ? 'system@internal' : 'unknown'),
          userRole: userInfo?.role || (logData.userId === 'system' ? 'system' : 'unknown'),
          action: logData.action,
          resource: logData.resource,
          resourceId: logData.resourceId,
          success: logData.status !== 'error',
          status: logData.status || 'success',
          errorMessage: logData.status === 'error' ? logData.details?.error : null,
          ipAddress: logData.details?.ipAddress || logData.ip,
          userAgent: logData.details?.userAgent,
          location: logData.details?.location,
          details: JSON.stringify(logData.details || {})
        });
      }
    });

    // Generate filename
    const timestamp = now.toISOString().split('T')[0];
    const filename = `security-logs-${enterpriseId}-${timestamp}.${format}`;

    // Log the export
    await logActivity({
      action: ACTIONS.EXPORT,
      resource: 'SECURITY_LOGS',
      userId: req.user.uid,
      enterpriseId: enterpriseId,
      details: {
        format: format,
        logCount: allLogs.length,
        timeframe: timeframe,
        filters: { userId, action, resource },
        filename: filename
      }
    });

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Timestamp',
        'User ID',
        'User Name',
        'User Email',
        'User Role',
        'Action',
        'Resource',
        'Resource ID',
        'Success',
        'Status',
        'Error Message',
        'IP Address',
        'User Agent',
        'Location',
        'Details'
      ];

      const csvRows = allLogs.map(log => [
        log.timestamp,
        log.userId,
        log.userName,
        log.userEmail,
        log.userRole,
        log.action,
        log.resource,
        log.resourceId || '',
        log.success,
        log.status,
        log.errorMessage || '',
        log.ipAddress || '',
        log.userAgent || '',
        log.location || '',
        log.details
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);

    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({
        status: true,
        data: {
          logs: allLogs,
          exportInfo: {
            enterpriseId: enterpriseId,
            exportedAt: now.toISOString(),
            exportedBy: {
              id: req.user.uid,
              name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
              email: userData.email
            },
            timeRange: {
              start: startTime.toISOString(),
              end: now.toISOString()
            },
            filters: { userId, action, resource },
            totalRecords: allLogs.length
          }
        }
      });
    }

  } catch (error) {
    console.error('Error exporting security logs:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to export security logs',
      error: error.message
    });
  }
};

/**
 * Get security log statistics
 */
exports.getSecurityLogStats = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { timeframe = '7d' } = req.query;

    console.log(`📊 [SecurityLogs] Getting stats for enterprise: ${enterpriseId}`);

    // Verify user has access to this enterprise
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security logs'
      });
    }

    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get users in this enterprise
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`))
      .get();

    const enterpriseUserIds = new Set();
    enterpriseUsersSnapshot.forEach(doc => {
      enterpriseUserIds.add(doc.id);
    });

    // Get activity logs for the timeframe
    const logsSnapshot = await db.collection('activityLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime))
      .get();

    // Filter and analyze logs
    const stats = {
      totalLogs: 0,
      successfulOperations: 0,
      failedOperations: 0,
      uniqueUsers: new Set(),
      actionBreakdown: {},
      resourceBreakdown: {},
      hourlyActivity: Array(24).fill(0),
      topUsers: {},
      errorTypes: {}
    };

    logsSnapshot.forEach(doc => {
      const logData = doc.data();
      
      // Only include logs from enterprise users
      if (enterpriseUserIds.has(logData.userId) || logData.userId === 'system') {
        stats.totalLogs++;
        
        if (logData.status === 'error') {
          stats.failedOperations++;
          
          // Track error types
          const errorType = logData.details?.error || 'Unknown Error';
          stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
        } else {
          stats.successfulOperations++;
        }
        
        stats.uniqueUsers.add(logData.userId);
        
        // Action breakdown
        stats.actionBreakdown[logData.action] = (stats.actionBreakdown[logData.action] || 0) + 1;
        
        // Resource breakdown
        stats.resourceBreakdown[logData.resource] = (stats.resourceBreakdown[logData.resource] || 0) + 1;
        
        // Hourly activity
        const logTime = logData.timestamp?.toDate?.() || new Date(logData.timestamp);
        const hour = logTime.getHours();
        stats.hourlyActivity[hour]++;
        
        // Top users
        stats.topUsers[logData.userId] = (stats.topUsers[logData.userId] || 0) + 1;
      }
    });

    // Convert sets and sort top items
    const uniqueUsersCount = stats.uniqueUsers.size;
    const topUsers = Object.entries(stats.topUsers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, activityCount: count }));

    const topActions = Object.entries(stats.actionBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    const topResources = Object.entries(stats.resourceBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));

    const topErrors = Object.entries(stats.errorTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    res.status(200).json({
      status: true,
      data: {
        summary: {
          totalLogs: stats.totalLogs,
          successfulOperations: stats.successfulOperations,
          failedOperations: stats.failedOperations,
          successRate: stats.totalLogs > 0 ? (stats.successfulOperations / stats.totalLogs * 100).toFixed(2) : 0,
          uniqueUsers: uniqueUsersCount,
          timeframe: timeframe,
          period: {
            start: startTime.toISOString(),
            end: now.toISOString()
          }
        },
        breakdown: {
          actions: topActions,
          resources: topResources,
          errors: topErrors
        },
        activity: {
          hourlyDistribution: stats.hourlyActivity,
          topUsers: topUsers
        }
      }
    });

  } catch (error) {
    console.error('Error getting security log stats:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve security log statistics',
      error: error.message
    });
  }
};