require('dotenv').config();
const nodemailer = require('nodemailer');

// Create email transport configuration with better timeout and connection settings
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false, // Accept self-signed certificates
      ciphers: 'SSLv3'
    },
    debug: true, // Enable debug logging
    // Add timeout configuration
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,  // 10 seconds
    socketTimeout: 15000,    // 15 seconds
    // Add retry configuration
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
  });
};

// Create initial transporter instance
let transporter = createTransporter();

// Enhanced connection test with detailed logging and graceful fallback
const verifyTransporter = () => {
  return new Promise((resolve) => {
    transporter.verify((error, success) => {
      if (error) {
        console.error('Email server verification error:', {
          message: error.message,
          code: error.code,
          command: error.command,
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_SMTP_PORT
        });
        resolve(false);
      } else {
        console.log('Email server connection verified successfully');
        resolve(true);
      }
    });
  });
};

// Call verify but don't wait for it - this allows the app to start even if email is down
verifyTransporter().then(isVerified => {
  if (!isVerified) {
    console.log('Email service may not be available but application will continue');
  }
});

// Enhance the transporter.sendMail with status tracking, retries and better error handling
const sendMailWithStatus = async (mailOptions) => {
  try {
    // Make sure from address is properly set
    if (!mailOptions.from || typeof mailOptions.from === 'string') {
      mailOptions.from = {
        name: mailOptions.from?.name || process.env.EMAIL_FROM_NAME || 'XS Card',
        address: mailOptions.from?.address || process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
      };
    }
    
    console.log('Sending email to:', mailOptions.to);
    console.log('Email subject:', mailOptions.subject);
    
    // Try to send email with current transporter
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent to:', mailOptions.to);
      console.log('Message ID:', info.messageId);

      return {
        success: true,
        accepted: info.accepted,
        rejected: info.rejected,
        messageId: info.messageId
      };
    } catch (transportError) {
      // If we get a connection error, try to recreate the transporter once
      if (transportError.code === 'ETIMEDOUT' || 
          transportError.code === 'ECONNREFUSED' || 
          transportError.code === 'ECONNRESET') {
        
        console.log('Reconnecting to email server after connection error...');
        // Create a fresh transporter instance
        transporter = createTransporter();
        
        // Try one more time with the fresh connection
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent after reconnection to:', mailOptions.to);
        console.log('Message ID:', info.messageId);

        return {
          success: true,
          accepted: info.accepted,
          rejected: info.rejected,
          messageId: info.messageId,
          reconnected: true
        };
      }
      
      // If it's not a connection error, or the retry failed, throw the original error
      throw transportError;
    }

  } catch (error) {
    console.error('Email send failed:', error.message);
    // More detailed error logging
    console.error('Email error details:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      errorName: error.name,
      errorCode: error.code,
      errorCommand: error.command
    });
    
    return {
      success: false,
      error: error.message,
      errorCode: error.code || 'UNKNOWN'
    };
  }
};

/**
 * Get user notification preferences
 */
const getUserNotificationPreferences = async (userId) => {
  try {
    const { db } = require('../../firebase');
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data();
    return userData.notificationPreferences || {
      weeklyDigest: true,
      teamUpdates: true,
      securityAlerts: true,
      usageReports: true,
      adminNotifications: true,
      integrationUpdates: true,
      emailNotifications: true
    };
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    return null;
  }
};

/**
 * Check if user wants to receive specific notification type
 */
const shouldSendNotification = async (userId, notificationType) => {
  try {
    const preferences = await getUserNotificationPreferences(userId);
    
    if (!preferences) {
      return true; // Default to sending if can't determine preferences
    }
    
    // Check master email toggle first
    if (!preferences.emailNotifications) {
      return false;
    }
    
    // Check specific notification type
    return preferences[notificationType] !== false;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    return true; // Default to sending on error
  }
};

/**
 * Enhanced sendMailWithStatus that respects user preferences
 */
const sendNotificationEmail = async (userId, notificationType, mailOptions) => {
  try {
    const shouldSend = await shouldSendNotification(userId, notificationType);
    
    if (!shouldSend) {
      console.log(`Notification blocked by user preference: ${userId}, type: ${notificationType}`);
      return {
        success: true,
        blocked: true,
        reason: 'User preference',
        notificationType: notificationType
      };
    }
    
    // Add notification type to mail options for tracking
    const enhancedMailOptions = {
      ...mailOptions,
      headers: {
        ...mailOptions.headers,
        'X-Notification-Type': notificationType,
        'X-User-ID': userId
      }
    };
    
    const result = await sendMailWithStatus(enhancedMailOptions);
    
    // Add notification type to result for tracking
    return {
      ...result,
      notificationType: notificationType,
      userId: userId
    };
  } catch (error) {
    console.error('Error sending notification email:', error);
    return {
      success: false,
      error: error.message,
      notificationType: notificationType,
      userId: userId
    };
  }
};

/**
 * Send security alert notification
 */
const sendSecurityAlert = async (userId, alertData) => {
  try {
    const userDoc = await require('../../firebase').db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.email) {
      return { success: false, error: 'User email not found' };
    }
    
    const mailOptions = {
      to: userData.email,
      subject: `Security Alert: ${alertData.title}`,
      html: `
        <h2 style="color: #d32f2f;">🔒 Security Alert</h2>
        <p><strong>Alert Type:</strong> ${alertData.type}</p>
        <p><strong>Description:</strong> ${alertData.description}</p>
        <p><strong>Time:</strong> ${alertData.timestamp}</p>
        <p><strong>IP Address:</strong> ${alertData.ipAddress || 'Unknown'}</p>
        <p><strong>User Agent:</strong> ${alertData.userAgent || 'Unknown'}</p>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #856404;">Recommended Actions:</h3>
          <ul>
            <li>Change your password immediately if you don't recognize this activity</li>
            <li>Review your account settings</li>
            <li>Contact support if you need assistance</li>
          </ul>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          This is an automated security notification from your XS Card account.
        </p>
      `
    };
    
    return await sendNotificationEmail(userId, 'securityAlerts', mailOptions);
  } catch (error) {
    console.error('Error sending security alert:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send admin notification
 */
const sendAdminNotification = async (userId, notificationData) => {
  try {
    const userDoc = await require('../../firebase').db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.email) {
      return { success: false, error: 'User email not found' };
    }
    
    const mailOptions = {
      to: userData.email,
      subject: `Admin Notification: ${notificationData.title}`,
      html: `
        <h2 style="color: #1976d2;">🔔 Administrative Notification</h2>
        <p><strong>Category:</strong> ${notificationData.category}</p>
        <p><strong>Message:</strong> ${notificationData.message}</p>
        <p><strong>Priority:</strong> ${notificationData.priority || 'Normal'}</p>
        <p><strong>Time:</strong> ${notificationData.timestamp}</p>
        
        ${notificationData.actions && notificationData.actions.length > 0 ? `
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #1976d2;">Required Actions:</h3>
            <ul>
              ${notificationData.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <p style="color: #666; font-size: 12px;">
          This is an administrative notification from your XS Card account management.
        </p>
      `
    };
    
    return await sendNotificationEmail(userId, 'adminNotifications', mailOptions);
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send integration update notification
 */
const sendIntegrationUpdate = async (userId, updateData) => {
  try {
    const userDoc = await require('../../firebase').db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.email) {
      return { success: false, error: 'User email not found' };
    }
    
    const statusColor = updateData.status === 'success' ? '#4caf50' : 
                       updateData.status === 'error' ? '#f44336' : '#ff9800';
    
    const mailOptions = {
      to: userData.email,
      subject: `Integration Update: ${updateData.integrationName}`,
      html: `
        <h2 style="color: ${statusColor};">🔗 Integration Update</h2>
        <p><strong>Integration:</strong> ${updateData.integrationName}</p>
        <p><strong>Status:</strong> <span style="color: ${statusColor};">${updateData.status}</span></p>
        <p><strong>Message:</strong> ${updateData.message}</p>
        <p><strong>Time:</strong> ${updateData.timestamp}</p>
        
        ${updateData.details ? `
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Details:</h3>
            <p>${updateData.details}</p>
          </div>
        ` : ''}
        
        ${updateData.status === 'error' ? `
          <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #f44336;">Action Required:</h3>
            <p>Please check your integration settings or contact support if the issue persists.</p>
          </div>
        ` : ''}
        
        <p style="color: #666; font-size: 12px;">
          This is an automated integration notification from your XS Card account.
        </p>
      `
    };
    
    return await sendNotificationEmail(userId, 'integrationUpdates', mailOptions);
  } catch (error) {
    console.error('Error sending integration update:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  sendMailWithStatus,
  verifyTransporter,
  // New exports for Phase 1
  getUserNotificationPreferences,
  shouldSendNotification,
  sendNotificationEmail,
  sendSecurityAlert,
  sendAdminNotification,
  sendIntegrationUpdate
};
