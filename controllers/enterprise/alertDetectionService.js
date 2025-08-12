const { db, admin } = require('../../firebase');
const { createSecurityAlert, SECURITY_ALERT_TYPES, SEVERITY_LEVELS } = require('./securityAlertsController');
const { logActivity, ACTIONS, RESOURCES } = require('../../utils/logger');

/**
 * Alert Detection Service
 * Processes activity logs to generate security alerts
 */

/**
 * Process activity logs to detect security issues
 * This function should be called periodically (e.g., every 5 minutes)
 */
exports.processActivityLogsForAlerts = async () => {
  try {
    console.log('🔍 [AlertDetection] Starting activity log processing for security alerts...');
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get recent activity logs
    const recentLogsSnapshot = await db.collection('activityLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    const logs = [];
    recentLogsSnapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate?.() || data.timestamp
      });
    });

    console.log(`📊 [AlertDetection] Processing ${logs.length} recent activity logs`);

    // Group logs by enterprise for processing
    const enterpriseLogs = {};
    for (const log of logs) {
      // Get enterprise ID for the user
      if (log.userId && log.userId !== 'system') {
        try {
          const userDoc = await db.collection('users').doc(log.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const enterpriseId = userData.enterpriseRef?.id;
            
            if (enterpriseId) {
              if (!enterpriseLogs[enterpriseId]) {
                enterpriseLogs[enterpriseId] = [];
              }
              enterpriseLogs[enterpriseId].push({
                ...log,
                enterpriseId: enterpriseId,
                userEmail: userData.email,
                userName: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name,
                userRole: userData.role || 'user'
              });
            }
          }
        } catch (userError) {
          console.error('Error fetching user data for log:', userError);
        }
      }
    }

    // Process each enterprise's logs
    for (const [enterpriseId, logs] of Object.entries(enterpriseLogs)) {
      await processEnterpriseLogsForAlerts(enterpriseId, logs, oneDayAgo);
    }

    console.log('✅ [AlertDetection] Activity log processing completed');

  } catch (error) {
    console.error('❌ [AlertDetection] Error processing activity logs for alerts:', error);
  }
};

/**
 * Process logs for a specific enterprise
 */
async function processEnterpriseLogsForAlerts(enterpriseId, logs, oneDayAgo) {
  try {
    console.log(`🏢 [AlertDetection] Processing ${logs.length} logs for enterprise: ${enterpriseId}`);

    // 1. Check for failed login attempts
    await checkFailedLoginAttempts(enterpriseId, logs);
    
    // 2. Check for unusual login times
    await checkUnusualLoginTimes(enterpriseId, logs);
    
    // 3. Check for new location logins
    await checkNewLocationLogins(enterpriseId, logs);
    
    // 4. Check for admin account changes
    await checkAdminAccountChanges(enterpriseId, logs);
    
    // 5. Check for account deactivations
    await checkAccountDeactivations(enterpriseId, logs);
    
    // 6. Check for system errors
    await checkSystemErrors(enterpriseId, logs);
    
    // 7. Check for bulk operations
    await checkBulkOperations(enterpriseId, logs);

  } catch (error) {
    console.error(`❌ [AlertDetection] Error processing enterprise ${enterpriseId} logs:`, error);
  }
}

/**
 * Check for failed login attempts (>3 in 1 hour)
 */
async function checkFailedLoginAttempts(enterpriseId, logs) {
  try {
    // Group error logs by userId that relate to authentication
    const authErrors = logs.filter(log => 
      log.action === ACTIONS.ERROR && 
      log.resource === RESOURCES.USER &&
      log.details?.operation === 'login'
    );

    const userErrorCounts = {};
    
    authErrors.forEach(log => {
      if (!userErrorCounts[log.userId]) {
        userErrorCounts[log.userId] = [];
      }
      userErrorCounts[log.userId].push(log);
    });

    // Check for users with >3 failed attempts
    for (const [userId, errorLogs] of Object.entries(userErrorCounts)) {
      if (errorLogs.length >= 3) {
        // Check if we already created an alert for this user in the last hour
        const existingAlert = await checkExistingAlert(
          enterpriseId, 
          SECURITY_ALERT_TYPES.FAILED_LOGIN_ATTEMPTS, 
          userId, 
          60 * 60 * 1000 // 1 hour
        );

        if (!existingAlert) {
          const userInfo = errorLogs[0];
          await createSecurityAlert({
            enterpriseId: enterpriseId,
            type: SECURITY_ALERT_TYPES.FAILED_LOGIN_ATTEMPTS,
            severity: SEVERITY_LEVELS.HIGH,
            title: `Multiple Failed Login Attempts Detected`,
            description: `User ${userInfo.userName || userInfo.userEmail} has ${errorLogs.length} failed login attempts in the last hour.`,
            userId: userId,
            metadata: {
              failedAttempts: errorLogs.length,
              ipAddresses: [...new Set(errorLogs.map(log => log.details?.ipAddress).filter(Boolean))],
              timeWindow: '1 hour',
              lastAttempt: errorLogs[errorLogs.length - 1].timestamp,
              logEntryIds: errorLogs.map(log => log.id)
            }
          });
          
          console.log(`🚨 [AlertDetection] Created failed login alert for user ${userId} in enterprise ${enterpriseId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking failed login attempts:', error);
  }
}

/**
 * Check for unusual login times (outside business hours)
 */
async function checkUnusualLoginTimes(enterpriseId, logs) {
  try {
    const loginLogs = logs.filter(log => 
      log.action === ACTIONS.LOGIN && 
      log.resource === RESOURCES.USER
    );

    for (const log of loginLogs) {
      const loginTime = new Date(log.timestamp);
      const hour = loginTime.getHours();
      const dayOfWeek = loginTime.getDay();

      // Define business hours: Monday-Friday, 8 AM - 6 PM
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isOutsideBusinessHours = hour < 8 || hour >= 18;

      if (isWeekend || isOutsideBusinessHours) {
        // Check if we already created an alert for this user today
        const existingAlert = await checkExistingAlert(
          enterpriseId, 
          SECURITY_ALERT_TYPES.UNUSUAL_LOGIN_TIME, 
          log.userId, 
          24 * 60 * 60 * 1000 // 24 hours
        );

        if (!existingAlert) {
          await createSecurityAlert({
            enterpriseId: enterpriseId,
            type: SECURITY_ALERT_TYPES.UNUSUAL_LOGIN_TIME,
            severity: SEVERITY_LEVELS.MEDIUM,
            title: `Login Outside Business Hours`,
            description: `User ${log.userName || log.userEmail} logged in outside normal business hours.`,
            userId: log.userId,
            metadata: {
              loginTime: loginTime.toISOString(),
              hour: hour,
              dayOfWeek: dayOfWeek,
              isWeekend: isWeekend,
              ipAddress: log.details?.ipAddress,
              userAgent: log.details?.userAgent,
              logEntryId: log.id
            }
          });
          
          console.log(`🚨 [AlertDetection] Created unusual login time alert for user ${log.userId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking unusual login times:', error);
  }
}

/**
 * Check for new location logins
 */
async function checkNewLocationLogins(enterpriseId, logs) {
  try {
    const loginLogs = logs.filter(log => 
      log.action === ACTIONS.LOGIN && 
      log.resource === RESOURCES.USER &&
      log.details?.ipAddress
    );

    for (const log of loginLogs) {
      const userId = log.userId;
      const currentIP = log.details.ipAddress;

      // Get user's historical login IPs from the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const historicalLogins = await db.collection('activityLogs')
        .where('userId', '==', userId)
        .where('action', '==', ACTIONS.LOGIN)
        .where('resource', '==', RESOURCES.USER)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      const knownIPs = new Set();
      historicalLogins.forEach(doc => {
        const data = doc.data();
        if (data.details?.ipAddress) {
          knownIPs.add(data.details.ipAddress);
        }
      });

      // Check if current IP is new
      if (!knownIPs.has(currentIP)) {
        // Check if we already created an alert for this IP today
        const existingAlert = await checkExistingAlert(
          enterpriseId, 
          SECURITY_ALERT_TYPES.NEW_LOCATION_LOGIN, 
          userId, 
          24 * 60 * 60 * 1000, // 24 hours
          { ipAddress: currentIP }
        );

        if (!existingAlert) {
          await createSecurityAlert({
            enterpriseId: enterpriseId,
            type: SECURITY_ALERT_TYPES.NEW_LOCATION_LOGIN,
            severity: SEVERITY_LEVELS.MEDIUM,
            title: `Login from New Location`,
            description: `User ${log.userName || log.userEmail} logged in from a new IP address.`,
            userId: userId,
            metadata: {
              newIpAddress: currentIP,
              knownIpCount: knownIPs.size,
              userAgent: log.details?.userAgent,
              loginTime: log.timestamp,
              logEntryId: log.id
            }
          });
          
          console.log(`🚨 [AlertDetection] Created new location login alert for user ${userId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking new location logins:', error);
  }
}

/**
 * Check for admin account changes
 */
async function checkAdminAccountChanges(enterpriseId, logs) {
  try {
    const adminLogs = logs.filter(log => 
      (log.action === ACTIONS.CREATE || log.action === ACTIONS.UPDATE) && 
      log.resource === RESOURCES.USER &&
      (log.userRole === 'admin' || log.details?.role === 'admin')
    );

    for (const log of adminLogs) {
      let alertType, title, description;
      
      if (log.action === ACTIONS.CREATE) {
        alertType = SECURITY_ALERT_TYPES.ADMIN_ACCOUNT_CREATED;
        title = 'New Administrator Account Created';
        description = `A new administrator account has been created for ${log.userName || log.userEmail}.`;
      } else {
        alertType = SECURITY_ALERT_TYPES.ADMIN_PROFILE_CHANGED;
        title = 'Administrator Profile Modified';
        description = `Administrator profile for ${log.userName || log.userEmail} has been modified.`;
      }

      // Always create alerts for admin changes (no duplicate check)
      await createSecurityAlert({
        enterpriseId: enterpriseId,
        type: alertType,
        severity: log.action === ACTIONS.CREATE ? SEVERITY_LEVELS.CRITICAL : SEVERITY_LEVELS.HIGH,
        title: title,
        description: description,
        userId: log.userId,
        metadata: {
          action: log.action,
          changes: log.details || {},
          modifiedBy: log.userId,
          ipAddress: log.details?.ipAddress,
          logEntryId: log.id
        }
      });
      
      console.log(`🚨 [AlertDetection] Created admin account change alert for user ${log.userId}`);
    }
  } catch (error) {
    console.error('Error checking admin account changes:', error);
  }
}

/**
 * Check for account deactivations
 */
async function checkAccountDeactivations(enterpriseId, logs) {
  try {
    const deactivationLogs = logs.filter(log => 
      log.action === ACTIONS.UPDATE && 
      log.resource === RESOURCES.USER &&
      log.details?.operation === 'deactivate_user'
    );

    for (const log of deactivationLogs) {
      await createSecurityAlert({
        enterpriseId: enterpriseId,
        type: SECURITY_ALERT_TYPES.ACCOUNT_DEACTIVATED,
        severity: SEVERITY_LEVELS.MEDIUM,
        title: 'User Account Deactivated',
        description: `User account for ${log.userName || log.userEmail} has been deactivated.`,
        userId: log.userId,
        metadata: {
          deactivatedBy: log.userId,
          reason: log.details?.reason || 'Not specified',
          ipAddress: log.details?.ipAddress,
          logEntryId: log.id
        }
      });
      
      console.log(`🚨 [AlertDetection] Created account deactivation alert for user ${log.userId}`);
    }
  } catch (error) {
    console.error('Error checking account deactivations:', error);
  }
}

/**
 * Check for system errors
 */
async function checkSystemErrors(enterpriseId, logs) {
  try {
    const systemErrors = logs.filter(log => 
      log.action === ACTIONS.ERROR && 
      log.status === 'error'
    );

    // Group errors by type
    const errorGroups = {};
    systemErrors.forEach(log => {
      const errorType = log.details?.error || 'Unknown Error';
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = [];
      }
      errorGroups[errorType].push(log);
    });

    // Create alerts for error groups with >5 occurrences
    for (const [errorType, errorLogs] of Object.entries(errorGroups)) {
      if (errorLogs.length >= 5) {
        // Check for existing alert
        const existingAlert = await checkExistingAlert(
          enterpriseId, 
          SECURITY_ALERT_TYPES.SYSTEM_ERROR, 
          null, 
          60 * 60 * 1000, // 1 hour
          { errorType: errorType }
        );

        if (!existingAlert) {
          await createSecurityAlert({
            enterpriseId: enterpriseId,
            type: SECURITY_ALERT_TYPES.SYSTEM_ERROR,
            severity: SEVERITY_LEVELS.HIGH,
            title: 'Multiple System Errors Detected',
            description: `${errorLogs.length} occurrences of "${errorType}" detected in the last hour.`,
            userId: null,
            metadata: {
              errorType: errorType,
              errorCount: errorLogs.length,
              affectedUsers: [...new Set(errorLogs.map(log => log.userId).filter(Boolean))].length,
              timeWindow: '1 hour',
              logEntryIds: errorLogs.map(log => log.id)
            }
          });
          
          console.log(`🚨 [AlertDetection] Created system error alert for enterprise ${enterpriseId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking system errors:', error);
  }
}

/**
 * Check for bulk operations
 */
async function checkBulkOperations(enterpriseId, logs) {
  try {
    // Group operations by user
    const userOperations = {};
    logs.forEach(log => {
      if (log.userId && log.userId !== 'system') {
        if (!userOperations[log.userId]) {
          userOperations[log.userId] = [];
        }
        userOperations[log.userId].push(log);
      }
    });

    // Check for users with >10 operations in 1 hour
    for (const [userId, operations] of Object.entries(userOperations)) {
      if (operations.length > 10) {
        // Check for existing alert
        const existingAlert = await checkExistingAlert(
          enterpriseId, 
          SECURITY_ALERT_TYPES.BULK_USER_OPERATION, 
          userId, 
          60 * 60 * 1000 // 1 hour
        );

        if (!existingAlert) {
          const userInfo = operations[0];
          await createSecurityAlert({
            enterpriseId: enterpriseId,
            type: SECURITY_ALERT_TYPES.BULK_USER_OPERATION,
            severity: SEVERITY_LEVELS.MEDIUM,
            title: 'Bulk User Operations Detected',
            description: `User ${userInfo.userName || userInfo.userEmail} performed ${operations.length} operations in the last hour.`,
            userId: userId,
            metadata: {
              operationCount: operations.length,
              timeWindow: '1 hour',
              operations: operations.map(op => ({ action: op.action, resource: op.resource })),
              logEntryIds: operations.map(op => op.id)
            }
          });
          
          console.log(`🚨 [AlertDetection] Created bulk operations alert for user ${userId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking bulk operations:', error);
  }
}

/**
 * Check if an alert already exists
 */
async function checkExistingAlert(enterpriseId, alertType, userId, timeWindowMs, additionalMetadata = {}) {
  try {
    const timeThreshold = new Date(Date.now() - timeWindowMs);
    
    let query = db.collection('securityAlerts')
      .where('enterpriseId', '==', enterpriseId)
      .where('type', '==', alertType)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(timeThreshold));

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    
    // Additional filtering based on metadata if provided
    if (!snapshot.empty && Object.keys(additionalMetadata).length > 0) {
      for (const doc of snapshot.docs) {
        const alertData = doc.data();
        const metadata = alertData.metadata || {};
        
        let matches = true;
        for (const [key, value] of Object.entries(additionalMetadata)) {
          if (metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          return doc.id;
        }
      }
      return null;
    }
    
    return snapshot.empty ? null : snapshot.docs[0].id;
  } catch (error) {
    console.error('Error checking existing alert:', error);
    return null;
  }
}

/**
 * Initialize alert detection - start periodic processing
 */
exports.initializeAlertDetection = () => {
  console.log('🚀 [AlertDetection] Initializing security alert detection service...');
  
  // Process logs every 12 hours
  const PROCESS_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  
  setInterval(() => {
    exports.processActivityLogsForAlerts();
  }, PROCESS_INTERVAL);
  
  // Initial processing
  setTimeout(() => {
    exports.processActivityLogsForAlerts();
  }, 10000); // Start after 10 seconds
  
  console.log('✅ [AlertDetection] Alert detection service initialized');
};