const { db, admin } = require('../firebase.js');
const axios = require('axios');
const config = require('../config/config');
const { sendMailWithStatus } = require('../public/Utils/emailService');
require('dotenv').config();
const { AUTH_ENDPOINTS, EMAIL_TEMPLATES, AUTH_CONSTANTS } = require('../constants/auth');
const { formatDate } = require('../utils/dateFormatter');
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

const sendVerificationEmail = async (userData, req) => {
    const now = Date.now();
    const lastSent = userData.lastVerificationEmailSent || 0;
    
    if (now - lastSent < AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN) {
        const minutesLeft = Math.ceil((AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN - (now - lastSent)) / 60000);
        throw new Error(`Please wait ${minutesLeft} minutes before requesting another verification email`);
    }

    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}&uid=${userData.uid}`;
    
    await userData.ref.update({ 
        verificationToken,
        lastVerificationEmailSent: now
    });

    await sendMailWithStatus({
        to: userData.email,
        subject: EMAIL_TEMPLATES.verification.subject,
        html: EMAIL_TEMPLATES.verification.getHtml(userData.name, verificationLink)
    });

    return verificationToken;
};

exports.getAllUsers = async (req, res) => {
    try {
        console.log('Fetching all users...');
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        
        if (snapshot.empty) {
            console.log('No users found in collection');
            return res.status(404).send({ message: 'No users found' });
        }

        const users = [];
        snapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Found ${users.length} users`);
        res.status(200).send(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};

exports.getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User is not found'});
        }

        const userData = {
            id: userDoc.id,
            ...userDoc.data()
        };
        
        res.status(200).send(userData);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send({ 
            message: 'Internal Server Error', 
            error: error.message 
        });
    }
};

exports.addUser = async (req, res) => {
    const { 
        name, surname, email, password, occupation, company, 
        status, phone, plan = 'free', socials = {} 
    } = req.body;
    
    try {
        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: false
        });

        const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // Data for users collection - using Firestore Timestamp
        const userData = {
            uid: userRecord.uid,
            email,
            status,
            plan,
            createdAt: admin.firestore.Timestamp.now(), // Changed to Firestore Timestamp
            isEmailVerified: false,
            verificationToken
        };

        const responseData = {
            ...userData,
            createdAt: formatDate(userData.createdAt) // Format for display
        };

        // Data for cards collection - using Firestore Timestamp
        const cardData = {
            cards: [{
                name,
                surname,
                email,
                phone,
                occupation,
                company,
                profileImage: req.files?.profileImage ? `/profiles/${req.files.profileImage[0].filename}` : null,
                companyLogo: req.files?.companyLogo ? `/profiles/${req.files.companyLogo[0].filename}` : null,
                socials,
                colorScheme: '#1B2B5B', // Default color
                createdAt: admin.firestore.Timestamp.now() // Changed to Firestore Timestamp
            }]
        };

        // Store user data in Firestore
        await db.collection('users').doc(userRecord.uid).set(userData);
        
        // Store card data in Firestore
        await db.collection('cards').doc(userRecord.uid).set(cardData);

        // Send verification email
        const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=${verificationToken}&uid=${userRecord.uid}`;
        
        await sendMailWithStatus({
            to: email,
            subject: 'Verify your XS Card email address',
            html: `
                <h1>Welcome to XS Card!</h1>
                <p>Hello ${name},</p>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationLink}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create this account, please ignore this email.</p>
            `
        });
        
        // Log user creation
        await logActivity({
            action: ACTIONS.CREATE,
            resource: RESOURCES.USER,
            userId: userRecord.uid,
            resourceId: userRecord.uid,
            details: {
                email,
                name,
                surname,
                plan,
                company,
                status: 'pending_verification',
                verificationSent: true
            }
        });
        
        res.status(201).send({ 
            message: 'User added successfully. Please check your email to verify your account.',
            userId: userRecord.uid,
            userData: {
                ...responseData,
                verificationToken: undefined // Don't send token in response
            }
        });
    } catch (error) {
        console.error('Error adding user:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: 'system', // No user ID available yet
            status: 'error',
            details: {
                error: error.message,
                email: email, // Include email for tracking failed registrations
                operation: 'create_user'
            }
        });
        
        res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token, uid } = req.query;

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Log verification failure - user not found
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: uid || 'unknown',
                resourceId: uid,
                status: 'error',
                details: {
                    error: 'User not found',
                    operation: 'verify_email',
                    tokenProvided: !!token
                }
            });
            
            // Redirect to the HTML page with user-not-found status
            return res.redirect('/templates/emailVerified.html?status=user-not-found');
        }

        const userData = userDoc.data();

        if (userData.verificationToken !== token) {
            // Log verification failure - invalid token
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: uid,
                resourceId: uid,
                status: 'error',
                details: {
                    error: 'Invalid verification token',
                    operation: 'verify_email',
                    email: userData.email
                }
            });
            
            // Redirect to the HTML page with error status
            return res.redirect('/templates/emailVerified.html?status=error');
        }

        if (userData.isEmailVerified) {
            // Log already verified
            await logActivity({
                action: ACTIONS.VERIFY,
                resource: RESOURCES.USER,
                userId: uid,
                resourceId: uid,
                details: {
                    email: userData.email,
                    status: 'already_verified',
                    outcome: 'redundant'
                }
            });
            
            // Redirect to the HTML page with already-verified status
            return res.redirect('/templates/emailVerified.html?status=already-verified');
        }

        // Update Firestore
        await userRef.update({
            isEmailVerified: true,
            verificationToken: admin.firestore.FieldValue.delete()
        });

        // Update Firebase Auth
        await admin.auth().updateUser(uid, {
            emailVerified: true
        });

        // Log successful verification
        await logActivity({
            action: ACTIONS.VERIFY,
            resource: RESOURCES.USER,
            userId: uid,
            resourceId: uid,
            details: {
                email: userData.email,
                status: 'verified',
                outcome: 'success'
            }
        });

        // Redirect to the HTML page with success status
        res.redirect('/templates/emailVerified.html?status=success');
    } catch (error) {
        console.error('Verification error:', error);
        
        // Log verification error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: uid || 'unknown',
            resourceId: uid,
            status: 'error',
            details: {
                error: error.message,
                operation: 'verify_email'
            }
        });
        
        // Redirect to the HTML page with error status and message
        res.redirect(`/templates/emailVerified.html?status=error&message=${encodeURIComponent(error.message)}`);
    }
};

exports.resendVerification = async (req, res) => {
    const { uid } = req.params;

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Log error - user not found
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: uid || 'unknown',
                status: 'error',
                details: {
                    error: 'User not found',
                    operation: 'resend_verification'
                }
            });
            
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = { ...userDoc.data(), ref: userRef, uid };

        if (userData.isEmailVerified) {
            // Log already verified
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: uid,
                status: 'error',
                details: {
                    error: 'Email already verified',
                    operation: 'resend_verification',
                    email: userData.email
                }
            });
            
            return res.status(400).send({ message: 'Email already verified' });
        }

        try {
            await sendVerificationEmail(userData, req);
            
            // Log successful resend
            await logActivity({
                action: ACTIONS.SEND,
                resource: RESOURCES.EMAIL,
                userId: uid,
                resourceId: uid,
                details: {
                    emailType: 'verification',
                    recipient: userData.email,
                    operation: 'resend_verification'
                }
            });
            
            res.status(200).send({ message: 'Verification email sent successfully' });
        } catch (error) {
            // Log rate limiting or other errors
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.EMAIL,
                userId: uid,
                status: 'error',
                details: {
                    error: error.message,
                    operation: 'resend_verification',
                    email: userData.email
                }
            });
            
            res.status(429).send({ message: error.message });
        }
    } catch (error) {
        console.error('Error resending verification:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'resend_verification'
            }
        });
        
        res.status(500).send({ 
            message: 'Failed to resend verification email',
            error: error.message 
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    const { name } = req.params;
    const { newStatus } = req.body;
    if (!newStatus) {
        return res.status(400).send({ message: 'New status is required' });
    }
    try {
        const usersRef = db.collection('clients').doc('app-users');
        await usersRef.set({ [name]: newStatus }, { merge: true });
        res.status(200).send({ message: 'User status updated successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Internal Server Error', error });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const userRef = db.collection('users').doc(id);
        const doc = await userRef.get();
        
        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = doc.data();
        
        // Log user deletion
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                email: userData.email,
                plan: userData.plan,
                status: userData.status
            }
        });

        await userRef.delete();
        res.status(200).send({ 
            message: 'User deleted successfully',
            deletedUserId: id
        });
    } catch (error) {
        console.error('Delete error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'delete_user'
            }
        });
        
        res.status(500).send({ 
            message: 'Failed to delete user',
            error: error.message 
        });
    }
};

exports.signIn = async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await axios.post(AUTH_ENDPOINTS.signIn, {
            email,
            password,
            returnSecureToken: true
        });

        const { idToken, localId } = response.data;
        const userDoc = await db.collection('users').doc(localId).get();
        
        if (!userDoc.exists) {
            // Log failed login - user not found
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: 'unknown',
                status: 'error',
                details: {
                    error: 'Auth success but user document not found',
                    operation: 'login',
                    email
                }
            });
            
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = userDoc.data();

        if (!userData.isEmailVerified) {
            // Log failed login - email not verified
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: localId,
                resourceId: localId,
                status: 'error',
                details: {
                    error: 'Email not verified',
                    operation: 'login',
                    email
                }
            });
            
            return res.status(403).send({
                message: 'Email not verified. Please verify your email or request a new verification email.',
                needsVerification: true,
                uid: localId
            });
        }

        // Log successful login
        await logActivity({
            action: ACTIONS.LOGIN,
            resource: RESOURCES.USER,
            userId: localId,
            resourceId: localId,
            details: {
                email,
                plan: userData.plan,
                loginMethod: 'email-password'
            }
        });
        res.status(200).send({
            message: 'Sign in successful',
            token: idToken,
            user: {
                uid: localId,
                ...userData
            }
        });
    } catch (error) {
        console.error('Sign in error:', error.response?.data || error);
        
        // Log failed login
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: 'unknown',
            status: 'error',
            details: {
                error: error.response?.data?.error?.message || error.message,
                operation: 'login',
                email,
                attemptedAuth: true
            }
        });
        
        res.status(401).send({ 
            message: 'Invalid credentials',
            error: error.response?.data || error.message
        });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    try {
        let updateData = {};

        // Handle file upload if present
        if (req.file) {
            updateData.profileImage = `/profiles/${req.file.filename}`;
        } 
        // Handle JSON data if present
        else if (Object.keys(req.body).length > 0) {
            updateData = req.body;
        }

        // Check if there's any data to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).send({ 
                message: 'No update data provided'
            });
        }

        const userRef = db.collection('users').doc(id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        await userRef.update(updateData);
        
        // Log user profile update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                updatedFields: Object.keys(updateData),
                profileImageUpdated: !!req.file
            }
        });
        
        // Fetch updated user data
        const updatedDoc = await userRef.get();
        const userData = {
            id: updatedDoc.id,
            ...updatedDoc.data()
        };

        res.status(200).send({
            message: 'User updated successfully',
            user: userData
        });
    } catch (error) {
        console.error('Update error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_user',
                updatedFields: req.body ? Object.keys(req.body) : []
            }
        });
        
        res.status(500).send({
            message: 'Failed to update user',
            error: error.message
        });
    }
};

exports.updateProfileImage = async (req, res) => {
    const { id } = req.params;
    
    try {
      if (!req.file) {
        return res.status(400).send({ message: 'No image file provided' });
      }
  
      const userRef = db.collection('users').doc(id);
      const doc = await userRef.get();
  
      if (!doc.exists) {
        return res.status(404).send({ message: 'User not found' });
      }
  
      const profileImage = `/profiles/${req.file.filename}`;
      await userRef.update({ profileImage });
  
      // Log profile image update
      await logActivity({
        action: ACTIONS.UPDATE,
        resource: RESOURCES.USER,
        userId: id,
        resourceId: id,
        details: {
          updateType: 'profile_image',
          fileName: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });
      
      // Get updated user data
      const updatedDoc = await userRef.get();
      const userData = {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
  
      res.status(200).send(userData);
    } catch (error) {
      console.error('Error updating profile image:', error);
      
      // Log error
      await logActivity({
        action: ACTIONS.ERROR,
        resource: RESOURCES.USER,
        userId: id,
        resourceId: id,
        status: 'error',
        details: {
          error: error.message,
          operation: 'update_profile_image'
        }
      });
      
      res.status(500).send({
        message: 'Failed to update profile image',
        error: error.message
      });
    }
};

exports.updateCompanyLogo = async (req, res) => {
    const { id } = req.params;
    
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No image file provided' });
        }

        const userRef = db.collection('users').doc(id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const companyLogo = `/profiles/${req.file.filename}`;
        await userRef.update({ companyLogo });

        // Log company logo update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                updateType: 'company_logo',
                fileName: req.file.filename,
                fileSize: req.file.size,
                mimeType: req.file.mimetype
            }
        });

        const updatedDoc = await userRef.get();
        const userData = {
            id: updatedDoc.id,
            ...updatedDoc.data()
        };

        res.status(200).send(userData);
    } catch (error) {
        console.error('Error updating company logo:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_company_logo'
            }
        });
        
        res.status(500).send({
            message: 'Failed to update company logo',
            error: error.message
        });
    }
};

exports.updateUserColor = async (req, res) => {
    const { id } = req.params;
    const { color } = req.body;
    
    if (!color) {
        return res.status(400).send({ message: 'Color is required' });
    }

    try {
        const userRef = db.collection('users').doc(id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const oldColor = doc.data().colorScheme || '#1B2B5B';
        await userRef.update({
            colorScheme: color
        });

        // Log color scheme update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                updateType: 'color_scheme',
                oldColor: oldColor,
                newColor: color
            }
        });

        const updatedDoc = await userRef.get();
        const userData = {
            id: updatedDoc.id,
            ...updatedDoc.data()
        };

        res.status(200).send({ 
            message: 'User color updated successfully',
            user: userData
        });
    } catch (error) {
        console.error('Error updating user color:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'update_color_scheme',
                requestedColor: color
            }
        });
        
        res.status(500).send({ 
            message: 'Failed to update user color',
            error: error.message 
        });
    }
};

exports.logout = async (req, res) => {
    try {
        const uid = req.user.uid;
        const token = req.token;
        
        // Add token to blacklist with expiry
        await db.collection('tokenBlacklist').doc(token).set({
            uid: uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        });

        // Revoke refresh tokens
        await admin.auth().revokeRefreshTokens(uid);
        
        // Log user logout
        await logActivity({
            action: ACTIONS.LOGOUT,
            resource: RESOURCES.USER,
            userId: uid,
            resourceId: uid,
            details: {
                tokenRevoked: true,
                timestamp: new Date().toISOString()
            }
        });
        
        res.status(200).send({ 
            success: true,
            message: 'Logged out successfully',
            data: {
                uid: uid,
                timestamp: Date.now(),
                sessionEnded: true,
                tokenRevoked: true
            },
            meta: {
                serverTime: new Date().toISOString(),
                tokenStatus: 'revoked'
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
        
        // Log logout error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: req.user?.uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'logout'
            }
        });
        
        res.status(500).send({
            success: false,
            message: 'Failed to logout',
            error: {
                code: error.code || 'UNKNOWN_ERROR',
                message: error.message,
                timestamp: Date.now()
            }
        });
    }
};

exports.upgradeToPremium = async (req, res) => {
    const { id } = req.params;
    try {
        const userRef = db.collection('users').doc(id);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = doc.data();
        const oldPlan = userData.plan || 'free';

        // Update user to premium
        await userRef.update({
            plan: 'premium',
            status: 'active',
            trialStartDate: admin.firestore.Timestamp.now()
        });

        // Log plan upgrade
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                updateType: 'plan_upgrade',
                oldPlan: oldPlan,
                newPlan: 'premium',
                trialStarted: true
            }
        });

        const updatedDoc = await userRef.get();
        const updatedData = updatedDoc.data();

        res.status(200).send({
            message: 'User upgraded to premium successfully',
            user: {
                id: updatedDoc.id,
                ...updatedData
            }
        });
    } catch (error) {
        console.error('Error upgrading user:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            status: 'error',
            details: {
                error: error.message,
                operation: 'upgrade_to_premium'
            }
        });
        
        res.status(500).send({
            message: 'Failed to upgrade user',
            error: error.message
        });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send({ message: 'Email is required' });
    }

    try {
        // Check if user exists in Firestore
        const usersRef = db.collection('users');
        const userQuery = await usersRef.where('email', '==', email).get();
        
        if (userQuery.empty) {
            // Don't reveal if email exists or not for security
            return res.status(200).send({ 
                message: 'If an account with that email exists, we have sent a password reset link.'
            });
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Debug: Log user data to see what fields are available
        console.log('User data for password reset:', {
            name: userData.name,
            surname: userData.surname,
            email: userData.email,
            allFields: Object.keys(userData)
        });

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const resetExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

        // Store reset token in user document
        await userDoc.ref.update({
            passwordResetToken: resetToken,
            passwordResetExpiry: resetExpiry
        });

        // Send reset email - handle cases where name might be undefined
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}&uid=${userId}`;
        const userName = userData.name || userData.surname || 'User';
        
        await sendMailWithStatus({
            to: email,
            subject: 'XS Card - Password Reset Request',
            html: `
                <h1>Password Reset Request</h1>
                <p>Hello ${userName},</p>
                <p>You requested to reset your password for your XS Card account.</p>
                <p>Click the link below to reset your password:</p>
                <a href="${resetLink}" style="background-color: #1E1B4B; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
                <p>For security reasons, please do not share this link with anyone.</p>
            `
        });

        // Log password reset request
        await logActivity({
            action: ACTIONS.CREATE,
            resource: RESOURCES.USER,
            userId: userId,
            resourceId: userId,
            details: {
                operation: 'password_reset_requested',
                email: email,
                resetTokenGenerated: true,
                expiryTime: new Date(resetExpiry).toISOString()
            }
        });

        res.status(200).send({ 
            message: 'If an account with that email exists, we have sent a password reset link.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'forgot_password',
                email: req.body.email
            }
        });
        
        res.status(500).send({ 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.resetPassword = async (req, res) => {
    const { token, uid, newPassword } = req.body;

    if (!token || !uid || !newPassword) {
        return res.status(400).send({ message: 'Token, user ID, and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
        return res.status(400).send({ message: 'Password must be at least 8 characters long' });
    }

    // Additional password validation
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return res.status(400).send({ 
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)' 
        });
    }

    try {
        // Get user document
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'Invalid reset link' });
        }

        const userData = userDoc.data();

        // Check if token is valid and not expired
        if (!userData.passwordResetToken || userData.passwordResetToken !== token) {
            return res.status(400).send({ message: 'Invalid or expired reset token' });
        }

        if (!userData.passwordResetExpiry || Date.now() > userData.passwordResetExpiry) {
            return res.status(400).send({ message: 'Reset token has expired' });
        }

        // Update password in Firebase Auth
        await admin.auth().updateUser(uid, {
            password: newPassword
        });

        // Clear reset token from user document
        await userRef.update({
            passwordResetToken: admin.firestore.FieldValue.delete(),
            passwordResetExpiry: admin.firestore.FieldValue.delete()
        });

        // Send confirmation email
        await sendMailWithStatus({
            to: userData.email,
            subject: 'XS Card - Password Successfully Reset',
            html: `
                <h1>Password Reset Successful</h1>
                <p>Hello ${userData.name || userData.surname || 'User'},</p>
                <p>Your password has been successfully reset.</p>
                <p>If you didn't make this change, please contact us immediately.</p>
                <p>For security, please sign in with your new password.</p>
            `
        });

        // Log successful password reset
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: uid,
            resourceId: uid,
            details: {
                operation: 'password_reset_completed',
                email: userData.email,
                resetTokenCleared: true
            }
        });

        res.status(200).send({ 
            message: 'Password reset successful. You can now sign in with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'reset_password'
            }
        });
        
        res.status(500).send({ 
            message: 'Failed to reset password',
            error: error.message 
        });
    }
};

exports.getResetUserInfo = async (req, res) => {
    const { token, uid } = req.query;

    if (!token || !uid) {
        return res.status(400).send({ message: 'Token and user ID are required' });
    }

    try {
        // Get user document
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'Invalid reset link' });
        }

        const userData = userDoc.data();

        // Check if token is valid and not expired
        if (!userData.passwordResetToken || userData.passwordResetToken !== token) {
            return res.status(400).send({ message: 'Invalid or expired reset token' });
        }

        if (!userData.passwordResetExpiry || Date.now() > userData.passwordResetExpiry) {
            return res.status(400).send({ message: 'Reset token has expired' });
        }

        // Return only safe user info for display
        res.status(200).send({ 
            email: userData.email,
            name: userData.name || userData.surname || 'User'
        });

    } catch (error) {
        console.error('Get reset user info error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'get_reset_user_info'
            }
        });
        
        res.status(500).send({ 
            message: 'Failed to get user information',
            error: error.message 
        });
    }
};
