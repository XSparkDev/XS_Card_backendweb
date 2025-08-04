const { db, admin } = require('../../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../../utils/logger');
const { sendSecurityAlert } = require('../../public/Utils/emailService');

/**
 * Force password reset for a user
 */
exports.forcePasswordReset = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { userId, reason } = req.body;
    const actionByUserId = req.user.uid;

    console.log(`🔐 [SecurityActions] Forcing password reset for user ${userId} in enterprise ${enterpriseId}`);

    // Verify user has access to this enterprise
    const actionByUserDoc = await db.collection('users').doc(actionByUserId).get();
    if (!actionByUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const actionByUserData = actionByUserDoc.data();
    const userEnterpriseId = actionByUserData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security actions'
      });
    }

    // Verify target user exists and belongs to same enterprise
    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Target user not found'
      });
    }

    const targetUserData = targetUserDoc.data();
    const targetUserEnterpriseId = targetUserData.enterpriseRef?.id;

    if (!targetUserEnterpriseId || targetUserEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Target user does not belong to this enterprise'
      });
    }

    // Generate password reset token
    const resetToken = admin.auth().createCustomToken(userId, { 
      forcePasswordReset: true,
      tokenType: 'passwordReset',
      issuedBy: actionByUserId,
      reason: reason || 'Security action'
    });

    // Update user document with forced password reset flag
    await db.collection('users').doc(userId).update({
      passwordResetRequired: true,
      passwordResetToken: await resetToken,
      passwordResetTokenExpires: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      ),
      passwordResetReason: reason || 'Security action',
      passwordResetRequestedBy: actionByUserId,
      passwordResetRequestedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Send security alert email to the user
    if (targetUserData.email) {
      try {
        await sendSecurityAlert(userId, {
          title: 'Password Reset Required',
          type: 'password_reset_required',
          description: `Your password has been reset for security reasons. You will be required to set a new password on your next login.`,
          timestamp: new Date().toISOString(),
          reason: reason || 'Security action'
        });
      } catch (emailError) {
        console.error('Error sending password reset notification:', emailError);
      }
    }

    // Log the security action
    await logActivity({
      action: 'FORCE_PASSWORD_RESET',
      resource: RESOURCES.USER,
      userId: actionByUserId,
      resourceId: userId,
      enterpriseId: enterpriseId,
      details: {
        targetUserId: userId,
        targetUserEmail: targetUserData.email,
        reason: reason || 'Security action',
        actionType: 'force_password_reset'
      }
    });

    // Create security alert for the action
    const { createSecurityAlert, SECURITY_ALERT_TYPES, SEVERITY_LEVELS } = require('./securityAlertsController');
    await createSecurityAlert({
      enterpriseId: enterpriseId,
      type: SECURITY_ALERT_TYPES.PASSWORD_CHANGED,
      severity: SEVERITY_LEVELS.HIGH,
      title: 'Forced Password Reset Action',
      description: `Administrator ${actionByUserData.name || actionByUserData.email} forced a password reset for user ${targetUserData.name || targetUserData.email}.`,
      userId: userId,
      metadata: {
        actionBy: actionByUserId,
        actionByName: actionByUserData.name || actionByUserData.email,
        reason: reason || 'Security action',
        tokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });

    res.status(200).json({
      status: true,
      message: 'Password reset forced successfully',
      data: {
        actionId: `force_reset_${Date.now()}`,
        result: 'Password reset required',
        affectedUsers: 1,
        emailSent: !!targetUserData.email,
        expiresIn: '24 hours'
      }
    });

  } catch (error) {
    console.error('Error forcing password reset:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to force password reset',
      error: error.message
    });
  }
};

/**
 * Temporarily lock user account
 */
exports.tempLockAccount = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { userId, reason, duration = 24 } = req.body; // duration in hours
    const actionByUserId = req.user.uid;

    console.log(`🔒 [SecurityActions] Temporarily locking account ${userId} in enterprise ${enterpriseId}`);

    // Verify user has access to this enterprise
    const actionByUserDoc = await db.collection('users').doc(actionByUserId).get();
    if (!actionByUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const actionByUserData = actionByUserDoc.data();
    const userEnterpriseId = actionByUserData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security actions'
      });
    }

    // Verify target user exists and belongs to same enterprise
    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'Target user not found'
      });
    }

    const targetUserData = targetUserDoc.data();
    const targetUserEnterpriseId = targetUserData.enterpriseRef?.id;

    if (!targetUserEnterpriseId || targetUserEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Target user does not belong to this enterprise'
      });
    }

    // Calculate lock expiration
    const lockUntil = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Update user document with temporary lock
    await db.collection('users').doc(userId).update({
      accountLocked: true,
      accountLockedUntil: admin.firestore.Timestamp.fromDate(lockUntil),
      accountLockReason: reason || 'Security action',
      accountLockedBy: actionByUserId,
      accountLockedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Disable user in Firebase Auth temporarily
    try {
      await admin.auth().updateUser(userId, { disabled: true });
    } catch (authError) {
      console.error('Error disabling user in Firebase Auth:', authError);
    }

    // Send security alert email to the user
    if (targetUserData.email) {
      try {
        await sendSecurityAlert(userId, {
          title: 'Account Temporarily Locked',
          type: 'account_locked',
          description: `Your account has been temporarily locked for security reasons. The lock will be automatically lifted on ${lockUntil.toISOString()}.`,
          timestamp: new Date().toISOString(),
          reason: reason || 'Security action',
          lockUntil: lockUntil.toISOString()
        });
      } catch (emailError) {
        console.error('Error sending account lock notification:', emailError);
      }
    }

    // Schedule account unlock
    scheduleAccountUnlock(userId, lockUntil);

    // Log the security action
    await logActivity({
      action: 'TEMP_LOCK_ACCOUNT',
      resource: RESOURCES.USER,
      userId: actionByUserId,
      resourceId: userId,
      enterpriseId: enterpriseId,
      details: {
        targetUserId: userId,
        targetUserEmail: targetUserData.email,
        reason: reason || 'Security action',
        duration: duration,
        lockUntil: lockUntil.toISOString(),
        actionType: 'temp_lock_account'
      }
    });

    // Create security alert for the action
    const { createSecurityAlert, SECURITY_ALERT_TYPES, SEVERITY_LEVELS } = require('./securityAlertsController');
    await createSecurityAlert({
      enterpriseId: enterpriseId,
      type: SECURITY_ALERT_TYPES.ACCOUNT_LOCKOUT,
      severity: SEVERITY_LEVELS.HIGH,
      title: 'Account Temporarily Locked',
      description: `Administrator ${actionByUserData.name || actionByUserData.email} temporarily locked account for user ${targetUserData.name || targetUserData.email}.`,
      userId: userId,
      metadata: {
        actionBy: actionByUserId,
        actionByName: actionByUserData.name || actionByUserData.email,
        reason: reason || 'Security action',
        duration: duration,
        lockUntil: lockUntil.toISOString()
      }
    });

    res.status(200).json({
      status: true,
      message: 'Account temporarily locked successfully',
      data: {
        actionId: `temp_lock_${Date.now()}`,
        result: 'Account locked',
        affectedUsers: 1,
        emailSent: !!targetUserData.email,
        lockUntil: lockUntil.toISOString(),
        duration: `${duration} hours`
      }
    });

  } catch (error) {
    console.error('Error temporarily locking account:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to temporarily lock account',
      error: error.message
    });
  }
};

/**
 * Send security alert to enterprise administrators
 */
exports.sendSecurityAlert = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { title, message, severity = 'medium', recipients = 'admins' } = req.body;
    const actionByUserId = req.user.uid;

    console.log(`📧 [SecurityActions] Sending security alert for enterprise ${enterpriseId}`);

    // Verify user has access to this enterprise
    const actionByUserDoc = await db.collection('users').doc(actionByUserId).get();
    if (!actionByUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const actionByUserData = actionByUserDoc.data();
    const userEnterpriseId = actionByUserData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security actions'
      });
    }

    // Get recipients based on type
    let targetUsers = [];
    if (recipients === 'admins') {
      const adminSnapshot = await db.collection('users')
        .where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`))
        .where('role', '==', 'admin')
        .get();
      
      adminSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          targetUsers.push({
            id: doc.id,
            email: userData.email,
            name: userData.name || 'Admin'
          });
        }
      });
    } else if (recipients === 'all') {
      const allUsersSnapshot = await db.collection('users')
        .where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`))
        .get();
      
      allUsersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          targetUsers.push({
            id: doc.id,
            email: userData.email,
            name: userData.name || 'User'
          });
        }
      });
    }

    // Send emails
    let emailsSent = 0;
    for (const user of targetUsers) {
      try {
        await sendSecurityAlert(user.id, {
          title: title || 'Security Alert',
          type: 'manual_alert',
          description: message || 'A security alert has been issued for your enterprise.',
          timestamp: new Date().toISOString(),
          severity: severity,
          sentBy: actionByUserData.name || actionByUserData.email
        });
        emailsSent++;
      } catch (emailError) {
        console.error(`Error sending alert to ${user.email}:`, emailError);
      }
    }

    // Log the security action
    await logActivity({
      action: 'SEND_SECURITY_ALERT',
      resource: 'SECURITY_ALERT',
      userId: actionByUserId,
      enterpriseId: enterpriseId,
      details: {
        title: title,
        message: message,
        severity: severity,
        recipients: recipients,
        targetUserCount: targetUsers.length,
        emailsSent: emailsSent,
        actionType: 'send_security_alert'
      }
    });

    // Create security alert for the action
    const { createSecurityAlert, SECURITY_ALERT_TYPES, SEVERITY_LEVELS } = require('./securityAlertsController');
    await createSecurityAlert({
      enterpriseId: enterpriseId,
      type: SECURITY_ALERT_TYPES.EMAIL_SENT_TO_EXTERNAL,
      severity: SEVERITY_LEVELS.LOW,
      title: 'Security Alert Sent',
      description: `Administrator ${actionByUserData.name || actionByUserData.email} sent a security alert to ${recipients}.`,
      userId: actionByUserId,
      metadata: {
        alertTitle: title,
        alertMessage: message,
        alertSeverity: severity,
        recipients: recipients,
        emailsSent: emailsSent
      }
    });

    res.status(200).json({
      status: true,
      message: 'Security alert sent successfully',
      data: {
        actionId: `send_alert_${Date.now()}`,
        result: 'Security alert sent',
        affectedUsers: targetUsers.length,
        emailSent: emailsSent > 0,
        emailsSent: emailsSent
      }
    });

  } catch (error) {
    console.error('Error sending security alert:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to send security alert',
      error: error.message
    });
  }
};

/**
 * Create incident report
 */
exports.createIncidentReport = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { title, description, severity = 'medium', affectedSystems = [], alertId } = req.body;
    const actionByUserId = req.user.uid;

    console.log(`📋 [SecurityActions] Creating incident report for enterprise ${enterpriseId}`);

    // Verify user has access to this enterprise
    const actionByUserDoc = await db.collection('users').doc(actionByUserId).get();
    if (!actionByUserDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    const actionByUserData = actionByUserDoc.data();
    const userEnterpriseId = actionByUserData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({
        status: false,
        message: 'Access denied to enterprise security actions'
      });
    }

    // Create incident report
    const incidentData = {
      enterpriseId: enterpriseId,
      title: title || 'Security Incident',
      description: description || 'A security incident has been reported.',
      severity: severity,
      status: 'open',
      affectedSystems: affectedSystems,
      relatedAlertId: alertId || null,
      createdBy: actionByUserId,
      createdByName: actionByUserData.name || actionByUserData.email,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const incidentRef = await db.collection('securityIncidents').add(incidentData);

    // Log the security action
    await logActivity({
      action: 'CREATE_INCIDENT',
      resource: 'SECURITY_INCIDENT',
      userId: actionByUserId,
      resourceId: incidentRef.id,
      enterpriseId: enterpriseId,
      details: {
        incidentId: incidentRef.id,
        title: title,
        severity: severity,
        affectedSystems: affectedSystems,
        relatedAlertId: alertId,
        actionType: 'create_incident'
      }
    });

    res.status(200).json({
      status: true,
      message: 'Incident report created successfully',
      data: {
        actionId: `incident_${incidentRef.id}`,
        result: 'Incident report created',
        incidentId: incidentRef.id,
        status: 'open'
      }
    });

  } catch (error) {
    console.error('Error creating incident report:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to create incident report',
      error: error.message
    });
  }
};

/**
 * Schedule account unlock (helper function)
 */
function scheduleAccountUnlock(userId, unlockTime) {
  const timeUntilUnlock = unlockTime.getTime() - Date.now();
  
  if (timeUntilUnlock > 0) {
    setTimeout(async () => {
      try {
        console.log(`🔓 [SecurityActions] Auto-unlocking account ${userId}`);
        
        // Update user document
        await db.collection('users').doc(userId).update({
          accountLocked: false,
          accountLockedUntil: admin.firestore.FieldValue.delete(),
          accountLockReason: admin.firestore.FieldValue.delete(),
          accountLockedBy: admin.firestore.FieldValue.delete(),
          accountLockedAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.Timestamp.now()
        });

        // Re-enable user in Firebase Auth
        await admin.auth().updateUser(userId, { disabled: false });

        // Log the unlock
        await logActivity({
          action: 'AUTO_UNLOCK_ACCOUNT',
          resource: RESOURCES.USER,
          userId: 'system',
          resourceId: userId,
          details: {
            targetUserId: userId,
            actionType: 'auto_unlock_account',
            unlockedAt: new Date().toISOString()
          }
        });

        console.log(`✅ [SecurityActions] Account ${userId} unlocked successfully`);
      } catch (error) {
        console.error(`❌ [SecurityActions] Error auto-unlocking account ${userId}:`, error);
      }
    }, timeUntilUnlock);
  }
}