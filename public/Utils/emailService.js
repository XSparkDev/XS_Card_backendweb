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

module.exports = {
  transporter,
  sendMailWithStatus,
  verifyTransporter
};
