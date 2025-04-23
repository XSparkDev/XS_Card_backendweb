process.removeAllListeners('warning');

require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const { db, admin } = require('./firebase.js');
const { sendMailWithStatus } = require('./public/Utils/emailService');
const app = express();
const port = 8383;

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'userid'],
  credentials: true
};
app.use(cors(corsOptions));

// Import routes
const userRoutes = require('./routes/userRoutes');
const cardRoutes = require('./routes/cardRoutes');
const contactRoutes = require('./routes/contactRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const departmentsRoutes = require('./routes/departmentsRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const profilesDir = path.join(__dirname, 'public', 'profiles');
    
    // Create profiles directory if it doesn't exist
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    cb(null, profilesDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public routes - must be before authentication middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', paymentRoutes);
app.use('/', subscriptionRoutes);

// Serve the password setup page
app.get('/set-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'set-password.html'));
});

// Password setup endpoint - keep this in public routes
app.post('/api/set-password', async (req, res) => {
  try {
    const { token, uid, password } = req.body;

    // Validate input
    if (!token || !uid || !password) {
      return res.status(400).send({
        success: false,
        message: 'Token, user ID, and password are required'
      });
    }

    // Check if token exists and is valid
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    const now = admin.firestore.Timestamp.now();

    // Validate token
    if (userData.passwordSetupToken !== token || 
        !userData.passwordSetupExpires || 
        userData.passwordSetupExpires.toDate() < now.toDate()) {
      return res.status(400).send({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Update password in Firebase Auth
    await admin.auth().updateUser(uid, { password });

    // Remove token from user document
    await userRef.update({
      passwordSetupToken: admin.firestore.FieldValue.delete(),
      passwordSetupExpires: admin.firestore.FieldValue.delete()
    });

    res.status(200).send({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).send({
      success: false,
      message: 'Error setting password',
      error: error.message
    });
  }
});

app.get('/saveContact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'saveContact.html'));
});

// Add the AddContact endpoint directly to server.js
app.post('/AddContact', async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    console.log('Add Contact called - Public endpoint in server.js');
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ 
            success: false,
            message: 'User ID and contact info are required'
        });
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (!userData) {
            return res.status(404).send({ message: 'User not found' });
        }

        const contactRef = db.collection('contacts').doc(userId);
        const doc = await contactRef.get();

        let currentContacts = [];
        if (doc.exists) {
            currentContacts = doc.data().contactList || [];
        }

        const FREE_PLAN_CONTACT_LIMIT = 3;

        if (userData.plan === 'free' && currentContacts.length >= FREE_PLAN_CONTACT_LIMIT) {
            console.log(`Contact limit reached for free user ${userId}. Current contacts: ${currentContacts.length}`);
            return res.status(403).send({
                message: 'Contact limit reached',
                error: 'FREE_PLAN_LIMIT_REACHED',
                currentContacts: currentContacts.length,
                limit: FREE_PLAN_CONTACT_LIMIT
            });
        }

        const newContact = {
            ...contactInfo,
            email: contactInfo.email || '',
            createdAt: admin.firestore.Timestamp.now()
        };

        currentContacts.push(newContact);

        await contactRef.set({
            userId: db.doc(`users/${userId}`),
            contactList: currentContacts
        }, { merge: true });
        
        if (userData.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userData.email,
                subject: 'Someone Saved Your Contact Information',
                html: `
                    <h2>New Contact Added</h2>
                    <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Contact Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Name:</strong> ${contactInfo.name}</li>
                            <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                            <li><strong>Phone Number:</strong> ${contactInfo.phone || 'Not provided'}</li>
                            <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
                            <li><strong>How You Met:</strong> ${contactInfo.howWeMet || 'Not provided'}</li>
                        </ul>
                    </div>
                    <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
                    ${userData.plan === 'free' ? 
                        `<p style="color: #ff4b6e;">You have ${FREE_PLAN_CONTACT_LIMIT - currentContacts.length} contacts remaining in your free plan.</p>` 
                        : ''}
                `
            };

            try {
                const mailResult = await sendMailWithStatus(mailOptions);
                if (!mailResult.success) {
                    console.error('Failed to send email notification:', mailResult.error);
                }
            } catch (emailError) {
                console.error('Email sending error:', emailError);
            }
        }
        
        res.status(201).send({ 
            success: true,
            message: 'Contact added successfully',
            contactList: currentContacts.map(contact => ({
                ...contact,
                createdAt: contact.createdAt ? contact.createdAt.toDate().toISOString() : new Date().toISOString()
            })),
            remainingContacts: userData.plan === 'free' ? 
                FREE_PLAN_CONTACT_LIMIT - currentContacts.length : 
                'unlimited'
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).send({ 
            success: false,
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
});

// Add new contact saving endpoint
app.post('/saveContact', async (req, res) => {
    const { userId, contactInfo } = req.body;
    
    if (!userId || !contactInfo) {
        return res.status(400).send({ message: 'User ID and contact info are required' });
    }

    try {
        const contactsRef = db.collection('contacts').doc(userId);
        const contactsDoc = await contactsRef.get();

        let contactList = contactsDoc.exists ? (contactsDoc.data().contactList || []) : [];
        if (!Array.isArray(contactList)) contactList = [];

        contactList.push({
            name: contactInfo.name,
            surname: contactInfo.surname,
            phone: contactInfo.phone,
            howWeMet: contactInfo.howWeMet,
            createdAt: admin.firestore.Timestamp.now()
        });

        await contactsRef.set({
            contactList: contactList
        }, { merge: true });

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (userData && userData.email) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userData.email,
                subject: 'Someone Saved Your Contact Information',
                html: `
                    <h2>New Contact Added</h2>
                    <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Contact Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Name:</strong> ${contactInfo.name}</li>
                            <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                            <li><strong>Phone Number:</strong> ${contactInfo.phone}</li>
                            <li><strong>How You Met:</strong> ${contactInfo.howWeMet}</li>
                        </ul>
                    </div>
                    <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
                `
            };

            const mailResult = await sendMailWithStatus(mailOptions);
            console.log('Email sending result:', mailResult);

            if (!mailResult.success) {
                console.error('Failed to send email:', mailResult.error);
            }
        }

        res.status(200).send({ 
            success: true,
            message: 'Contact saved successfully',
            contact: contactList[contactList.length - 1],
            emailSent: userData?.email ? true : false
        });

    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).send({ 
            success: false,
            message: 'Failed to save contact',
            error: error.message 
        });
    }
});

// Modified public endpoint to get specific card by userId and cardIndex
app.get('/public/cards/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const cardIndex = parseInt(req.query.cardIndex) || 0;

        const cardRef = db.collection('cards').doc(userId);
        const doc = await cardRef.get();
        
        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = doc.data();
        if (!userData.cards || !userData.cards[cardIndex]) {
            return res.status(404).send({ message: 'Card not found' });
        }

        const card = {
            id: userId,
            ...userData.cards[cardIndex]
        };

        res.status(200).send(card);
    } catch (error) {
        console.error('Error fetching public card:', error);
        res.status(500).send({ 
            message: 'Error fetching card', 
            error: error.message 
        });
    }
});

// Add a diagnostic endpoint to check if the server is working
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Protected routes - after public routes
app.use('/', userRoutes);
app.use('/', cardRoutes);
app.use('/', contactRoutes);
app.use('/', meetingRoutes);
app.use('/', departmentsRoutes);
app.use('/', paymentRoutes);
app.use('/', activityLogRoutes); // Mount at root instead of /api/logs

// Modify the user creation route to handle file upload
app.post('/api/users', upload.single('profileImage'), (req, res, next) => {
  if (req.file) {
    req.body.profileImage = `/profiles/${req.file.filename}`;
  }
  next();
});

// Example usage in a route:
app.post('/send-email', async (req, res) => {
  try {
    console.log('Received email request:', req.body);
    
    if (!req.body.to || !req.body.subject) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (to, subject)',
      });
    }

    const mailOptions = {
      to: req.body.to,
      subject: req.body.subject,
      text: req.body.text || '',
      html: req.body.html || ''
    };

    const result = await sendMailWithStatus(mailOptions);
    console.log('Email send attempt completed:', result);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        details: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        details: result
      });
    }
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({
      success: false,
      message: 'Email sending failed',
      error: {
        message: error.message,
        code: error.code,
        command: error.command
      }
    });
  }
});

// Cleanup expired blacklisted tokens every 24 hours
setInterval(async () => {
    try {
        const blacklistRef = db.collection('tokenBlacklist');
        const now = new Date();
        const snapshot = await blacklistRef
            .where('expiresAt', '<=', now)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error('Error cleaning up token blacklist:', error);
    }
}, 10 * 60 * 1000);

// Check for expired trials every minute
const checkExpiredTrials = async () => {
    try {
        const now = new Date();
        console.log(`Checking for expired trials: ${now.toISOString()}`);
        
        const trialUsersSnapshot = await db.collection('users')
            .where('subscriptionStatus', '==', 'trial')
            .get();
        
        if (trialUsersSnapshot.empty) {
            console.log('No trial users found');
            return;
        }
        
        const expiredTrials = trialUsersSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.trialEndDate && data.trialEndDate <= now.toISOString();
        });
        
        if (expiredTrials.length === 0) {
            console.log('No expired trials found');
            return;
        }
        
        console.log(`Found ${expiredTrials.length} expired trials to process`);
        
        for (const doc of expiredTrials) {
            const userId = doc.id;
            const userData = doc.data();
            
            let isSubscriptionValid = true;
            if (userData.subscriptionCode) {
                try {
                    const subscriptionStatus = await verifySubscriptionStatus(userData.subscriptionCode);
                    isSubscriptionValid = subscriptionStatus === 'active';
                    
                    if (!isSubscriptionValid) {
                        console.log(`Subscription ${userData.subscriptionCode} is no longer valid for user ${userId}`);
                    }
                } catch (error) {
                    console.error(`Error verifying subscription for ${userId}:`, error);
                }
            }
            
            if (isSubscriptionValid) {
                console.log(`Converting trial to active subscription for user: ${userId}`);
                
                await doc.ref.update({
                    subscriptionStatus: 'active',
                    lastUpdated: new Date().toISOString(),
                    trialEndDate: new Date().toISOString(),
                    firstBillingDate: new Date().toISOString()
                });
                
                await db.collection('subscriptions').doc(userId).update({
                    status: 'active',
                    trialEndDate: new Date().toISOString(),
                    firstBillingDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                console.log(`User ${userId} subscription updated from trial to active`);
            } else {
                console.log(`Marking cancelled trial for user: ${userId}`);
                
                await doc.ref.update({
                    subscriptionStatus: 'cancelled',
                    plan: 'free',
                    lastUpdated: new Date().toISOString(),
                    trialEndDate: new Date().toISOString(),
                    cancellationDate: new Date().toISOString()
                });
                
                await db.collection('subscriptions').doc(userId).update({
                    status: 'cancelled',
                    trialEndDate: new Date().toISOString(),
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                });
                
                console.log(`User ${userId} trial marked as cancelled and plan changed to free`);
            }
        }
    } catch (error) {
        console.error('Error checking expired trials:', error);
    }
};

const verifySubscriptionStatus = async (subscriptionCode) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/subscription/${subscriptionCode}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.status && response.data) {
                        resolve(response.data.status);
                    } else {
                        reject(new Error('Invalid response from Paystack'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

setInterval(checkExpiredTrials, 60 * 1000);

app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).send({
        message: 'Internal Server Error',
        error: {
            code: error.code || 500,
            message: error.message,
            details: error.details || error.toString()
        }
    });
});

const { testLogging } = require('./utils/logger');
testLogging().then(success => {
  console.log('Test logging result:', success);
});

app.listen(port, () => console.log(`Server has started on port: ${port}`));
