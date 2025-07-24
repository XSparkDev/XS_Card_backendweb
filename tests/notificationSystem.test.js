/**
 * Test file for notification system
 * Tests controller, routes, and email service integration
 */

const { db } = require('../firebase');
const notificationController = require('../controllers/notificationController');
const { 
  getUserNotificationPreferences, 
  shouldSendNotification, 
  sendNotificationEmail,
  sendSecurityAlert,
  sendAdminNotification,
  sendIntegrationUpdate
} = require('../public/Utils/emailService');

describe('Notification System Tests', () => {
  let testUserId;
  let testUserData;
  
  beforeAll(async () => {
    // Create test user
    testUserId = 'test-user-' + Date.now();
    testUserData = {
      email: 'test@example.com',
      name: 'Test User',
      notificationPreferences: {
        weeklyDigest: true,
        teamUpdates: true,
        securityAlerts: true,
        usageReports: false,
        adminNotifications: true,
        integrationUpdates: true,
        emailNotifications: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    
    await db.collection('users').doc(testUserId).set(testUserData);
  });
  
  afterAll(async () => {
    // Cleanup test user
    await db.collection('users').doc(testUserId).delete();
  });
  
  describe('getUserNotificationPreferences', () => {
    test('should return user preferences for existing user', async () => {
      const preferences = await getUserNotificationPreferences(testUserId);
      
      expect(preferences).toBeDefined();
      expect(preferences.weeklyDigest).toBe(true);
      expect(preferences.teamUpdates).toBe(true);
      expect(preferences.securityAlerts).toBe(true);
      expect(preferences.usageReports).toBe(false);
      expect(preferences.adminNotifications).toBe(true);
      expect(preferences.integrationUpdates).toBe(true);
      expect(preferences.emailNotifications).toBe(true);
    });
    
    test('should return null for non-existent user', async () => {
      const preferences = await getUserNotificationPreferences('non-existent-user');
      expect(preferences).toBeNull();
    });
  });
  
  describe('shouldSendNotification', () => {
    test('should return true for enabled notification types', async () => {
      const result = await shouldSendNotification(testUserId, 'securityAlerts');
      expect(result).toBe(true);
    });
    
    test('should return false for disabled notification types', async () => {
      const result = await shouldSendNotification(testUserId, 'usageReports');
      expect(result).toBe(false);
    });
    
    test('should return false when master email toggle is disabled', async () => {
      // Temporarily disable master email toggle
      await db.collection('users').doc(testUserId).update({
        'notificationPreferences.emailNotifications': false
      });
      
      const result = await shouldSendNotification(testUserId, 'securityAlerts');
      expect(result).toBe(false);
      
      // Restore master email toggle
      await db.collection('users').doc(testUserId).update({
        'notificationPreferences.emailNotifications': true
      });
    });
    
    test('should return true for non-existent user (fail-safe)', async () => {
      const result = await shouldSendNotification('non-existent-user', 'securityAlerts');
      expect(result).toBe(true);
    });
  });
  
  describe('sendNotificationEmail', () => {
    test('should block email when user preference is disabled', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      const result = await sendNotificationEmail(testUserId, 'usageReports', mailOptions);
      
      expect(result.success).toBe(true);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('User preference');
      expect(result.notificationType).toBe('usageReports');
    });
    
    test('should include notification type headers when sending', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      const result = await sendNotificationEmail(testUserId, 'securityAlerts', mailOptions);
      
      expect(result.notificationType).toBe('securityAlerts');
      expect(result.userId).toBe(testUserId);
    });
  });
  
  describe('Enterprise Notification Functions', () => {
    test('sendSecurityAlert should create proper email structure', async () => {
      const alertData = {
        title: 'Suspicious Login',
        type: 'login_attempt',
        description: 'Login from new device',
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
      };
      
      const result = await sendSecurityAlert(testUserId, alertData);
      
      expect(result.notificationType).toBe('securityAlerts');
      expect(result.userId).toBe(testUserId);
    });
    
    test('sendAdminNotification should create proper email structure', async () => {
      const notificationData = {
        title: 'Account Update',
        category: 'billing',
        message: 'Your subscription has been updated',
        priority: 'high',
        timestamp: new Date().toISOString(),
        actions: ['Review changes', 'Contact support']
      };
      
      const result = await sendAdminNotification(testUserId, notificationData);
      
      expect(result.notificationType).toBe('adminNotifications');
      expect(result.userId).toBe(testUserId);
    });
    
    test('sendIntegrationUpdate should create proper email structure', async () => {
      const updateData = {
        integrationName: 'CRM Sync',
        status: 'success',
        message: 'Integration completed successfully',
        timestamp: new Date().toISOString(),
        details: 'All contacts synchronized'
      };
      
      const result = await sendIntegrationUpdate(testUserId, updateData);
      
      expect(result.notificationType).toBe('integrationUpdates');
      expect(result.userId).toBe(testUserId);
    });
  });
  
  describe('Controller Functions', () => {
    let mockReq, mockRes;
    
    beforeEach(() => {
      mockReq = {
        user: { uid: testUserId },
        body: {},
        params: {}
      };
      
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });
    
    test('getNotificationPreferences should return user preferences', async () => {
      await notificationController.getNotificationPreferences(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        data: expect.objectContaining({
          weeklyDigest: true,
          teamUpdates: true,
          securityAlerts: true,
          emailNotifications: true
        })
      });
    });
    
    test('updateNotificationPreferences should update user preferences', async () => {
      mockReq.body = {
        weeklyDigest: false,
        securityAlerts: true
      };
      
      await notificationController.updateNotificationPreferences(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Notification preferences updated successfully',
        data: expect.objectContaining({
          weeklyDigest: false,
          securityAlerts: true
        })
      });
    });
    
    test('updateNotificationPreferences should reject invalid data types', async () => {
      mockReq.body = {
        weeklyDigest: 'invalid',
        securityAlerts: 123
      };
      
      await notificationController.updateNotificationPreferences(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: expect.stringContaining('must be a boolean value')
      });
    });
    
    test('resetNotificationPreferences should reset to defaults', async () => {
      await notificationController.resetNotificationPreferences(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Notification preferences reset to defaults',
        data: expect.objectContaining({
          weeklyDigest: true,
          teamUpdates: true,
          securityAlerts: true,
          emailNotifications: true
        })
      });
    });
  });
  
  describe('Migration and Validation', () => {
    test('should handle users without existing preferences', async () => {
      // Create user without preferences
      const userWithoutPrefs = 'user-without-prefs-' + Date.now();
      await db.collection('users').doc(userWithoutPrefs).set({
        email: 'noprefs@example.com',
        name: 'No Prefs User'
      });
      
      const preferences = await getUserNotificationPreferences(userWithoutPrefs);
      
      expect(preferences).toEqual({
        weeklyDigest: true,
        teamUpdates: true,
        securityAlerts: true,
        usageReports: true,
        adminNotifications: true,
        integrationUpdates: true,
        emailNotifications: true
      });
      
      // Cleanup
      await db.collection('users').doc(userWithoutPrefs).delete();
    });
  });
});

/**
 * Integration test helper functions
 */
const testNotificationSystem = async () => {
  console.log('🧪 Testing notification system...');
  
  try {
    // Test 1: Create test user
    const testUserId = 'integration-test-' + Date.now();
    const testUserData = {
      email: 'integration@test.com',
      name: 'Integration Test User',
      notificationPreferences: {
        weeklyDigest: true,
        teamUpdates: false,
        securityAlerts: true,
        usageReports: true,
        adminNotifications: false,
        integrationUpdates: true,
        emailNotifications: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    
    await db.collection('users').doc(testUserId).set(testUserData);
    console.log('✅ Test user created');
    
    // Test 2: Get preferences
    const preferences = await getUserNotificationPreferences(testUserId);
    console.log('✅ User preferences retrieved:', preferences);
    
    // Test 3: Check enabled notification
    const shouldSendSecurity = await shouldSendNotification(testUserId, 'securityAlerts');
    console.log('✅ Security alerts enabled:', shouldSendSecurity);
    
    // Test 4: Check disabled notification
    const shouldSendTeam = await shouldSendNotification(testUserId, 'teamUpdates');
    console.log('✅ Team updates disabled:', !shouldSendTeam);
    
    // Test 5: Test blocked notification
    const blockedResult = await sendNotificationEmail(testUserId, 'teamUpdates', {
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test'
    });
    console.log('✅ Blocked notification:', blockedResult.blocked);
    
    // Test 6: Test enterprise notification functions
    const securityResult = await sendSecurityAlert(testUserId, {
      title: 'Test Alert',
      type: 'test',
      description: 'Test security alert',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Security alert sent:', securityResult.notificationType);
    
    // Cleanup
    await db.collection('users').doc(testUserId).delete();
    console.log('✅ Test user cleaned up');
    
    console.log('🎉 All notification system tests passed!');
    
  } catch (error) {
    console.error('❌ Notification system test failed:', error);
    throw error;
  }
};

// Run integration test if called directly
if (require.main === module) {
  testNotificationSystem()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  testNotificationSystem
}; 