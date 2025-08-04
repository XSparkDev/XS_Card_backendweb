const { db, admin } = require('../../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../../utils/logger');
const { sendSecurityAlert } = require('../../public/Utils/emailService');

/**
 * Security Alert Types and Severity Levels
 */
const SECURITY_ALERT_TYPES = {
  // Authentication Security Alerts
  FAILED_LOGIN_ATTEMPTS: 'failed_login_attempts',
  UNUSUAL_LOGIN_TIME: 'unusual_login_time',
  NEW_LOCATION_LOGIN: 'new_location_login',
  ACCOUNT_LOCKOUT: 'account_lockout',
  SUSPICIOUS_LOGOUT: 'suspicious_logout',
  
  // Account Management Alerts
  ADMIN_ACCOUNT_CREATED: 'admin_account_created',
  ADMIN_PROFILE_CHANGED: 'admin_profile_changed',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  PASSWORD_CHANGED: 'password_changed',
  BULK_USER_OPERATION: 'bulk_user_operation',
  
  // System Security Alerts
  SYSTEM_ERROR: 'system_error',
  API_RATE_LIMIT: 'api_rate_limit',
  DATABASE_ERROR: 'database_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  
  // Compliance & Audit Alerts
  LARGE_DATA_EXPORT: 'large_data_export',
  EMAIL_SENT_TO_EXTERNAL: 'email_sent_to_external',
  ENTERPRISE_SETTINGS_CHANGED: 'enterprise_settings_changed'
};

const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
};

/**
 * Get security alerts for an enterprise
 */
exports.getSecurityAlerts = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { 
      severity, 
      type, 
      status = ALERT_STATUS.ACTIVE, 
      limit = 50, 
      startAfter,
      userId,
      timeframe = '7d' // 24h, 7d, 30d
    } = req.query;
    
    console.log(`🔍 [SecurityAlerts] Getting alerts for enterprise: ${enterpriseId}`);

    // Verify user has access to this enterprise
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      console.log(`[SecurityAlerts] User not found: ${req.user.uid}`);
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    console.log(`[SecurityAlerts] Access check - User: ${req.user.uid}, User Enterprise: ${userEnterpriseId}, Requested Enterprise: ${enterpriseId}`);

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      console.log(`[SecurityAlerts] Access denied - User Enterprise: ${userEnterpriseId}, Requested: ${enterpriseId}`);
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security alerts'
      });
    }

    // Build query for security alerts with fallback for missing indexes
    let snapshot;
    let indexError = null;
    
    try {
      // Try the optimized query first (requires composite index)
      let query = db.collection('securityAlerts')
        .where('enterpriseId', '==', enterpriseId);

      // Add filters
      if (severity) {
        query = query.where('severity', '==', severity);
      }
      
      if (type) {
        query = query.where('type', '==', type);
      }
      
      if (status) {
        query = query.where('status', '==', status);
      }

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      // Add time range filter
      if (timeframe) {
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
        
        query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime));
      }

      // Order by timestamp (newest first)
      query = query.orderBy('timestamp', 'desc').limit(parseInt(limit));

      if (startAfter) {
        const startAfterDoc = await db.collection('securityAlerts').doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      snapshot = await query.get();
    } catch (error) {
      // If composite index is missing, use fallback query
      indexError = error;
      console.log('Composite index not available, using fallback query:', error.message);
      
      // Fallback: Get all alerts for enterprise and filter in memory
      snapshot = await db.collection('securityAlerts')
        .where('enterpriseId', '==', enterpriseId)
        .limit(parseInt(limit))
        .get();
    }
    const alerts = [];

    // If using fallback query, filter results in memory
    let filteredDocs = snapshot.docs;
    if (indexError) {
      console.log('Applying in-memory filters for fallback query...');
      
      filteredDocs = snapshot.docs.filter(doc => {
        const data = doc.data();
        
        // Filter by severity
        if (severity && data.severity !== severity) return false;
        
        // Filter by type
        if (type && data.type !== type) return false;
        
        // Filter by status
        if (status && data.status !== status) return false;
        
        // Filter by userId
        if (userId && data.userId !== userId) return false;
        
        // Filter by timeframe
        if (timeframe) {
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
          
          if (data.timestamp && data.timestamp.toDate() < startTime) return false;
        }
        
        return true;
      });
      
      // Sort by timestamp (newest first) and apply limit
      filteredDocs.sort((a, b) => {
        const aTime = a.data().timestamp?.toDate() || new Date(0);
        const bTime = b.data().timestamp?.toDate() || new Date(0);
        return bTime - aTime;
      });
      
      filteredDocs = filteredDocs.slice(0, parseInt(limit));
    }

    // Get alert counts with fallback handling
    const countQueries = {
      total: db.collection('securityAlerts').where('enterpriseId', '==', enterpriseId),
      unacknowledged: db.collection('securityAlerts')
        .where('enterpriseId', '==', enterpriseId)
        .where('status', '==', ALERT_STATUS.ACTIVE),
      critical: db.collection('securityAlerts')
        .where('enterpriseId', '==', enterpriseId)
        .where('severity', '==', SEVERITY_LEVELS.CRITICAL)
        .where('status', '==', ALERT_STATUS.ACTIVE)
    };

    const [totalSnapshot, unacknowledgedSnapshot, criticalSnapshot] = await Promise.all([
      countQueries.total.get(),
      countQueries.unacknowledged.get(),
      countQueries.critical.get()
    ]);

    // Process alerts
    for (const doc of filteredDocs) {
      const alertData = doc.data();
      
      // Get user information if userId exists
      let userInfo = null;
      if (alertData.userId) {
        try {
          const userDoc = await db.collection('users').doc(alertData.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userInfo = {
              id: alertData.userId,
              name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
              email: userData.email,
              role: userData.role || 'user',
              department: userData.department || 'Unknown'
            };
          }
        } catch (userError) {
          console.error('Error fetching user info for alert:', userError);
        }
      }

      // Get acknowledged by user info
      let acknowledgedByInfo = null;
      if (alertData.acknowledgedBy) {
        try {
          const ackUserDoc = await db.collection('users').doc(alertData.acknowledgedBy).get();
          if (ackUserDoc.exists) {
            const ackUserData = ackUserDoc.data();
            acknowledgedByInfo = {
              id: alertData.acknowledgedBy,
              name: ackUserData.name && ackUserData.surname ? `${ackUserData.name} ${ackUserData.surname}` : ackUserData.name || 'Unknown',
              email: ackUserData.email
            };
          }
        } catch (ackError) {
          console.error('Error fetching acknowledged by user info:', ackError);
        }
      }

      // Generate actions based on alert type
      const actions = generateSecurityActions(alertData.type, alertData.userId);

      alerts.push({
        id: doc.id,
        type: alertData.type,
        severity: alertData.severity,
        status: alertData.status,
        title: alertData.title,
        description: alertData.description,
        user: userInfo,
        timestamp: alertData.timestamp.toDate().toISOString(),
        acknowledgedAt: alertData.acknowledgedAt ? alertData.acknowledgedAt.toDate().toISOString() : null,
        resolvedAt: alertData.resolvedAt ? alertData.resolvedAt.toDate().toISOString() : null,
        acknowledgedBy: acknowledgedByInfo,
        metadata: alertData.metadata || {},
        actions: actions
      });
    }

    // Log the alert access
    await logActivity({
      action: ACTIONS.READ,
      resource: 'SECURITY_ALERTS',
      userId: req.user.uid,
      enterpriseId: enterpriseId,
      details: {
        alertCount: alerts.length,
        filters: { severity, type, status, timeframe }
      }
    });

    res.status(200).json({
      status: true,
      data: {
        alerts,
        totalCount: totalSnapshot.size,
        unacknowledgedCount: unacknowledgedSnapshot.size,
        criticalCount: criticalSnapshot.size,
        hasMore: snapshot.docs.length === parseInt(limit),
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null
      }
    });

  } catch (error) {
    console.error('Error getting security alerts:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve security alerts',
      error: error.message
    });
  }
};

/**
 * Acknowledge a security alert
 */
exports.acknowledgeSecurityAlert = async (req, res) => {
  try {
    const { enterpriseId, alertId } = req.params;
    const { notes } = req.body;
    const userId = req.user.uid;

    console.log(`✅ [SecurityAlerts] Acknowledging alert ${alertId} for enterprise: ${enterpriseId}`);

    // Verify access to enterprise
    const userDoc = await db.collection('users').doc(userId).get();
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
        message: 'Access denied to enterprise security alerts'
      });
    }

    // Get and update alert
    const alertRef = db.collection('securityAlerts').doc(alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Security alert not found'
      });
    }

    const alertData = alertDoc.data();

    // Verify alert belongs to enterprise
    if (alertData.enterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Alert does not belong to specified enterprise'
      });
    }

    // Update alert status
    await alertRef.update({
      status: ALERT_STATUS.ACKNOWLEDGED,
      acknowledgedAt: admin.firestore.Timestamp.now(),
      acknowledgedBy: userId,
      acknowledgedNotes: notes || null,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Log the acknowledgment
    await logActivity({
      action: 'ACKNOWLEDGE',
      resource: 'SECURITY_ALERT',
      userId: userId,
      resourceId: alertId,
      enterpriseId: enterpriseId,
      details: {
        alertType: alertData.type,
        alertSeverity: alertData.severity,
        notes: notes
      }
    });

    res.status(200).json({
      status: true,
      message: 'Security alert acknowledged successfully',
      data: {
        alertId: alertId,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: {
          id: userId,
          name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
          email: userData.email
        }
      }
    });

  } catch (error) {
    console.error('Error acknowledging security alert:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to acknowledge security alert',
      error: error.message
    });
  }
};

/**
 * Resolve a security alert
 */
exports.resolveSecurityAlert = async (req, res) => {
  try {
    const { enterpriseId, alertId } = req.params;
    const { resolution, notes } = req.body;
    const userId = req.user.uid;

    console.log(`🔧 [SecurityAlerts] Resolving alert ${alertId} for enterprise: ${enterpriseId}`);

    // Verify access to enterprise
    const userDoc = await db.collection('users').doc(userId).get();
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
        message: 'Access denied to enterprise security alerts'
      });
    }

    // Get and update alert
    const alertRef = db.collection('securityAlerts').doc(alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Security alert not found'
      });
    }

    const alertData = alertDoc.data();

    // Verify alert belongs to enterprise
    if (alertData.enterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Alert does not belong to specified enterprise'
      });
    }

    // Update alert status
    await alertRef.update({
      status: ALERT_STATUS.RESOLVED,
      resolvedAt: admin.firestore.Timestamp.now(),
      resolvedBy: userId,
      resolution: resolution || 'Manually resolved',
      resolutionNotes: notes || null,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Log the resolution
    await logActivity({
      action: 'RESOLVE',
      resource: 'SECURITY_ALERT',
      userId: userId,
      resourceId: alertId,
      enterpriseId: enterpriseId,
      details: {
        alertType: alertData.type,
        alertSeverity: alertData.severity,
        resolution: resolution,
        notes: notes
      }
    });

    res.status(200).json({
      status: true,
      message: 'Security alert resolved successfully',
      data: {
        alertId: alertId,
        resolvedAt: new Date().toISOString(),
        resolvedBy: {
          id: userId,
          name: userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.name || 'Unknown',
          email: userData.email
        },
        resolution: resolution
      }
    });

  } catch (error) {
    console.error('Error resolving security alert:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to resolve security alert',
      error: error.message
    });
  }
};

/**
 * Generate security actions based on alert type
 */
function generateSecurityActions(alertType, userId) {
  const actions = [];

  switch (alertType) {
    case SECURITY_ALERT_TYPES.FAILED_LOGIN_ATTEMPTS:
    case SECURITY_ALERT_TYPES.SUSPICIOUS_LOGOUT:
      if (userId) {
        actions.push({
          id: 'force_password_reset',
          name: 'Force Password Reset',
          description: 'Force user to reset their password on next login',
          type: 'button',
          action: 'force-password-reset',
          requiresConfirmation: true,
          confirmationMessage: 'Are you sure you want to force a password reset for this user?'
        });
        
        actions.push({
          id: 'temp_lock_account',
          name: 'Temporarily Lock Account',
          description: 'Temporarily lock user account for 24 hours',
          type: 'button',
          action: 'temp-lock-account',
          requiresConfirmation: true,
          confirmationMessage: 'Are you sure you want to temporarily lock this account?'
        });
      }
      break;

    case SECURITY_ALERT_TYPES.ADMIN_ACCOUNT_CREATED:
    case SECURITY_ALERT_TYPES.ADMIN_PROFILE_CHANGED:
      actions.push({
        id: 'send_security_notification',
        name: 'Send Security Notification',
        description: 'Send security alert to all administrators',
        type: 'button',
        action: 'send-security-alert',
        requiresConfirmation: false
      });
      break;

    case SECURITY_ALERT_TYPES.SYSTEM_ERROR:
    case SECURITY_ALERT_TYPES.DATABASE_ERROR:
      actions.push({
        id: 'create_incident',
        name: 'Create Incident Report',
        description: 'Create a system incident report',
        type: 'button',
        action: 'create-incident',
        requiresConfirmation: false
      });
      break;

    default:
      // Default actions available for all alerts
      actions.push({
        id: 'view_logs',
        name: 'View Related Logs',
        description: 'View detailed logs related to this alert',
        type: 'link',
        action: 'view-logs',
        requiresConfirmation: false
      });
  }

  return actions;
}

/**
 * Create a new security alert
 */
exports.createSecurityAlert = async (alertData) => {
  try {
    const alertDoc = {
      enterpriseId: alertData.enterpriseId,
      type: alertData.type,
      severity: alertData.severity,
      status: ALERT_STATUS.ACTIVE,
      title: alertData.title,
      description: alertData.description,
      userId: alertData.userId || null,
      timestamp: admin.firestore.Timestamp.now(),
      metadata: alertData.metadata || {},
      createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection('securityAlerts').add(alertDoc);
    
    console.log(`🚨 [SecurityAlerts] Created alert: ${docRef.id} for enterprise: ${alertData.enterpriseId}`);
    
    // Send email notification for critical and high severity alerts
    if (alertData.severity === SEVERITY_LEVELS.CRITICAL || alertData.severity === SEVERITY_LEVELS.HIGH) {
      // Find enterprise administrators to notify
      try {
        const enterpriseUsersSnapshot = await db.collection('users')
          .where('enterpriseRef', '==', db.doc(`enterprise/${alertData.enterpriseId}`))
          .where('role', '==', 'admin')
          .get();

        for (const userDoc of enterpriseUsersSnapshot.docs) {
          const userData = userDoc.data();
          if (userData.email) {
            await sendSecurityAlert(userDoc.id, {
              title: alertData.title,
              type: alertData.type,
              description: alertData.description,
              timestamp: new Date().toISOString(),
              ipAddress: alertData.metadata?.ipAddress,
              userAgent: alertData.metadata?.userAgent
            });
          }
        }
      } catch (emailError) {
        console.error('Error sending security alert emails:', emailError);
      }
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating security alert:', error);
    throw error;
  }
};

module.exports = {
  ...exports,
  SECURITY_ALERT_TYPES,
  SEVERITY_LEVELS,
  ALERT_STATUS
};