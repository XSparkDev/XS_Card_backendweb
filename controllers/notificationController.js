const { db } = require('../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

// Default notification preferences for enterprise users
const DEFAULT_PREFERENCES = {
  weeklyDigest: true,
  teamUpdates: true,
  securityAlerts: true,
  usageReports: true,
  adminNotifications: true,
  integrationUpdates: true,
  emailNotifications: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Get user notification preferences
 * GET /api/users/notifications/preferences
 */
exports.getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    const preferences = userData.notificationPreferences || DEFAULT_PREFERENCES;
    
    // Log activity
    await logActivity({
      action: ACTIONS.READ,
      resource: RESOURCES.USER,
      userId: userId,
      resourceId: userId,
      details: { action: 'get_notification_preferences' }
    });
    
    res.status(200).json({
      status: true,
      data: preferences
    });
    
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve notification preferences',
      error: error.message
    });
  }
};

/**
 * Update user notification preferences
 * PUT /api/users/notifications/preferences
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.uid;
    const updates = req.body;
    
    // Validate input
    const allowedFields = [
      'weeklyDigest', 
      'teamUpdates', 
      'securityAlerts', 
      'usageReports', 
      'adminNotifications', 
      'integrationUpdates', 
      'emailNotifications'
    ];
    const validUpdates = {};
    
    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        if (typeof updates[field] !== 'boolean') {
          return res.status(400).json({
            status: false,
            message: `Field '${field}' must be a boolean value`
          });
        }
        validUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({
        status: false,
        message: 'No valid preference updates provided'
      });
    }
    
    // Add timestamp
    validUpdates.updatedAt = new Date().toISOString();
    
    // Update user document
    const userRef = db.collection('users').doc(userId);
    
    // Build update object for nested fields
    const updateData = {};
    for (const [key, value] of Object.entries(validUpdates)) {
      updateData[`notificationPreferences.${key}`] = value;
    }
    
    await userRef.update(updateData);
    
    // Log activity
    await logActivity({
      action: ACTIONS.UPDATE,
      resource: RESOURCES.USER,
      userId: userId,
      resourceId: userId,
      details: { 
        action: 'update_notification_preferences',
        changes: validUpdates
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Notification preferences updated successfully',
      data: validUpdates
    });
    
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
};

/**
 * Reset notification preferences to defaults
 * POST /api/users/notifications/preferences/reset
 */
exports.resetNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      notificationPreferences: DEFAULT_PREFERENCES
    });
    
    // Log activity
    await logActivity({
      action: ACTIONS.UPDATE,
      resource: RESOURCES.USER,
      userId: userId,
      resourceId: userId,
      details: { action: 'reset_notification_preferences' }
    });
    
    res.status(200).json({
      status: true,
      message: 'Notification preferences reset to defaults',
      data: DEFAULT_PREFERENCES
    });
    
  } catch (error) {
    console.error('Error resetting notification preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to reset notification preferences',
      error: error.message
    });
  }
};

/**
 * Get notification preferences for a specific user (admin only)
 * GET /api/users/:userId/notifications/preferences
 */
exports.getUserNotificationPreferences = async (req, res) => {
  try {
    const requesterId = req.user.uid;
    const targetUserId = req.params.userId;
    
    // Check if requester is admin or requesting their own preferences
    if (requesterId !== targetUserId) {
      // TODO: Add admin role check when implemented
      return res.status(403).json({
        status: false,
        message: 'Unauthorized to view other users preferences'
      });
    }
    
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    const preferences = userData.notificationPreferences || DEFAULT_PREFERENCES;
    
    res.status(200).json({
      status: true,
      data: preferences
    });
    
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve user notification preferences',
      error: error.message
    });
  }
};

/**
 * Get notification statistics (for admin/analytics)
 * GET /api/notifications/statistics
 */
exports.getNotificationStatistics = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get user's enterprise reference (if any)
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    let query = db.collection('users');
    
    // If user is part of an enterprise, get stats for that enterprise
    if (userData.enterpriseRef) {
      const enterpriseId = userData.enterpriseRef.id;
      query = query.where('enterpriseRef', '==', db.doc(`enterprise/${enterpriseId}`));
    } else {
      // For individual users, just return their own stats
      query = query.where(db.FieldPath.documentId(), '==', userId);
    }
    
    const usersSnapshot = await query.get();
    
    const stats = {
      totalUsers: usersSnapshot.size,
      preferenceCounts: {
        weeklyDigest: 0,
        teamUpdates: 0,
        securityAlerts: 0,
        usageReports: 0,
        adminNotifications: 0,
        integrationUpdates: 0,
        emailNotifications: 0
      },
      lastUpdated: new Date().toISOString()
    };
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const prefs = userData.notificationPreferences || DEFAULT_PREFERENCES;
      
      Object.keys(stats.preferenceCounts).forEach(key => {
        if (prefs[key] === true) {
          stats.preferenceCounts[key]++;
        }
      });
    });
    
    res.status(200).json({
      status: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting notification statistics:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve notification statistics',
      error: error.message
    });
  }
};

// Export DEFAULT_PREFERENCES for use in other modules
exports.DEFAULT_PREFERENCES = DEFAULT_PREFERENCES; 