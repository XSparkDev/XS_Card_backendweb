const { db, admin } = require('../firebase.js');
const axios = require('axios');
const config = require('../config/config');
const { sendMailWithStatus } = require('../public/Utils/emailService');
require('dotenv').config();
const { AUTH_ENDPOINTS, EMAIL_TEMPLATES, AUTH_CONSTANTS } = require('../constants/auth');
const { formatDate } = require('../utils/dateFormatter');

// Helper function to get base URL for email links
const getBaseUrl = (req) => {
    // Use configured base URL if available, otherwise fall back to request info
    return config.BASE_URL || `${req.protocol}://${req.get('host')}`;
};
const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Helper function to update employee isActive status in enterprise departments
 * Handles both direct employee references and constructs the path if needed
 */
const updateEmployeeActiveStatus = async (userId, isActive, operation = 'deactivation') => {
    try {
        console.log(`[UpdateEmployeeActive] 🔍 Updating employee active status for user: ${userId}`);
        console.log(`[UpdateEmployeeActive] 📝 New isActive status: ${isActive}`);
        console.log(`[UpdateEmployeeActive] 🔄 Operation: ${operation}`);
        
        // Get user document to find enterprise references
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.log(`[UpdateEmployeeActive] ❌ User not found: ${userId}`);
            return { success: false, error: 'User not found' };
        }
        
        const userData = userDoc.data();
        
        // Check if user has enterprise reference - required for enterprise employee
        if (!userData.enterpriseRef) {
            console.log(`[UpdateEmployeeActive] ⏭️  User is not an enterprise employee (no enterpriseRef), skipping employee update`);
            return { success: true, skipped: true, reason: 'not_enterprise_employee' };
        }
        
        const enterpriseId = userData.enterpriseRef.id;
        console.log(`[UpdateEmployeeActive] 🏢 Enterprise ID: ${enterpriseId}`);
        
        let employeeRef = null;
        let employeeDocPath = null;
        
        // Try to get employee reference from user data first
        if (userData.employeeRef) {
            console.log(`[UpdateEmployeeActive] 📎 Found employeeRef in user data: ${userData.employeeRef.path}`);
            employeeRef = userData.employeeRef;
            employeeDocPath = userData.employeeRef.path;
        } else {
            // If no employeeRef, try to find the employee document by searching departments
            console.log(`[UpdateEmployeeActive] 🔍 No employeeRef found, searching for employee in departments...`);
            
            // Search all departments in the enterprise for this employee
            const departmentsSnapshot = await db.collection('enterprise')
                .doc(enterpriseId)
                .collection('departments')
                .get();
                
            let foundEmployee = false;
            
            for (const deptDoc of departmentsSnapshot.docs) {
                // Try direct access using userId as document ID (new structure)
                const directEmployeeRef = deptDoc.ref.collection('employees').doc(userId);
                const directEmployeeDoc = await directEmployeeRef.get();
                
                if (directEmployeeDoc.exists) {
                    employeeRef = directEmployeeRef;
                    employeeDocPath = directEmployeeRef.path;
                    foundEmployee = true;
                    console.log(`[UpdateEmployeeActive] ✅ Found employee document (direct): ${employeeDocPath}`);
                    break;
                }
                
                // Fallback: Search by userId field (old structure)
                const employeesSnapshot = await deptDoc.ref.collection('employees')
                    .where('userId', '==', db.doc(`users/${userId}`))
                    .get();
                    
                if (!employeesSnapshot.empty) {
                    const employeeDoc = employeesSnapshot.docs[0];
                    employeeRef = employeeDoc.ref;
                    employeeDocPath = employeeDoc.ref.path;
                    foundEmployee = true;
                    console.log(`[UpdateEmployeeActive] ✅ Found employee document (by query): ${employeeDocPath}`);
                    break;
                }
            }
            
            if (!foundEmployee) {
                console.log(`[UpdateEmployeeActive] ⏭️  No employee document found for user, skipping employee update`);
                return { success: true, skipped: true, reason: 'employee_document_not_found' };
            }
        }
        
        // Verify the employee document exists before updating
        const employeeDoc = await employeeRef.get();
        if (!employeeDoc.exists) {
            console.log(`[UpdateEmployeeActive] ❌ Employee document does not exist: ${employeeDocPath}`);
            return { success: false, error: 'Employee document not found' };
        }
        
        const currentEmployeeData = employeeDoc.data();
        console.log(`[UpdateEmployeeActive] 📋 Current employee isActive status: ${currentEmployeeData.isActive || 'undefined'}`);
        
        // Prepare update data
        const updateData = {
            isActive: isActive,
            updatedAt: admin.firestore.Timestamp.now(),
            [`${operation}At`]: admin.firestore.Timestamp.now()
        };
        
        console.log(`[UpdateEmployeeActive] 📝 Updating employee document with:`, updateData);
        
        // Update the employee document
        await employeeRef.update(updateData);
        
        // Verify the update
        const updatedEmployeeDoc = await employeeRef.get();
        const updatedEmployeeData = updatedEmployeeDoc.data();
        console.log(`[UpdateEmployeeActive] ✅ Successfully updated employee isActive status to: ${updatedEmployeeData.isActive}`);
        
        // If user didn't have employeeRef, update it now for future use
        if (!userData.employeeRef) {
            console.log(`[UpdateEmployeeActive] 🔗 Updating user document with employeeRef for future use`);
            await db.collection('users').doc(userId).update({
                employeeRef: employeeRef,
                updatedAt: admin.firestore.Timestamp.now()
            });
        }
        
        return { 
            success: true, 
            employeeRef: employeeDocPath,
            previousStatus: currentEmployeeData.isActive,
            newStatus: updatedEmployeeData.isActive
        };
        
    } catch (error) {
        console.error(`[UpdateEmployeeActive] ❌ Error updating employee active status:`, error);
        console.error(`[UpdateEmployeeActive] Error details:`, {
            userId,
            isActive,
            operation,
            errorMessage: error.message,
            errorCode: error.code
        });
        return { success: false, error: error.message };
    }
};

const sendVerificationEmail = async (userData, req) => {
    const now = Date.now();
    const lastSent = userData.lastVerificationEmailSent || 0;
    
    if (now - lastSent < AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN) {
        const minutesLeft = Math.ceil((AUTH_CONSTANTS.VERIFICATION_EMAIL_COOLDOWN - (now - lastSent)) / 60000);
        throw new Error(`Please wait ${minutesLeft} minutes before requesting another verification email`);
    }

    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const verificationLink = `${getBaseUrl(req)}/verify-email?token=${verificationToken}&uid=${userData.uid}`;
    
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
        const verificationLink = `${getBaseUrl(req)}/verify-email?token=${verificationToken}&uid=${userRecord.uid}`;
        
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

        // Check if user account is deactivated
        if (userData.active === false) {
            console.log(`[SignIn] Blocking login for deactivated user: ${userData.email}`);
            
            // Log failed login - account deactivated
            await logActivity({
                action: ACTIONS.ERROR,
                resource: RESOURCES.USER,
                userId: localId,
                resourceId: localId,
                status: 'error',
                details: {
                    error: 'Account deactivated',
                    operation: 'login',
                    email,
                    deactivatedAt: userData.deactivatedAt
                }
            });
            
            return res.status(403).send({
                message: 'Your account has been deactivated. Please contact your administrator for assistance.',
                accountDeactivated: true,
                uid: localId,
                deactivatedAt: userData.deactivatedAt
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
        const resetLink = `${getBaseUrl(req)}/reset-password?token=${resetToken}&uid=${userId}`;
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

exports.deactivateUser = async (req, res) => {
    try {
        const requestingUserId = req.user.uid;
        const { active, targetUserId } = req.body;

        console.log(`[DeactivateUser] 🔍 Deactivating user: ${targetUserId || requestingUserId}`);
        console.log(`[DeactivateUser] 📝 Active status: ${active}`);
        console.log(`[DeactivateUser] 👤 Requesting user: ${requestingUserId}`);

        if (active !== false) {
            console.log(`[DeactivateUser] ❌ Invalid active status: ${active}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Only deactivation (active: false) is supported.'
            });
        }

        // Determine target user ID
        const userId = targetUserId || requestingUserId;
        const isSelfOperation = userId === requestingUserId;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log(`[DeactivateUser] ❌ User not found: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check permissions
        if (!isSelfOperation) {
            // Admin operation - verify admin has access to this user's enterprise
            const requestingUserRef = db.collection('users').doc(requestingUserId);
            const requestingUserDoc = await requestingUserRef.get();
            
            if (!requestingUserDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Requesting user not found'
                });
            }

            const requestingUserData = requestingUserDoc.data();
            const targetUserData = userDoc.data();

            // Check if requesting user is an admin by looking in the enterprise employees subcollection
            let isAdmin = false;
            let requestingUserEnterpriseId = null;
            let targetUserEnterpriseId = null;

            // Get requesting user's enterprise reference
            if (requestingUserData.enterpriseRef) {
                requestingUserEnterpriseId = requestingUserData.enterpriseRef.id;
                
                // Find the requesting user in the enterprise employees subcollection
                const departmentsSnapshot = await db.collection('enterprise')
                    .doc(requestingUserEnterpriseId)
                    .collection('departments')
                    .get();

                for (const deptDoc of departmentsSnapshot.docs) {
                    const employeesSnapshot = await deptDoc.ref.collection('employees')
                        .where('userId', '==', db.doc(`users/${requestingUserId}`))
                        .get();

                    if (!employeesSnapshot.empty) {
                        const employeeData = employeesSnapshot.docs[0].data();
                        if (employeeData.role === 'admin') {
                            isAdmin = true;
                            break;
                        }
                    }
                }
            }

            if (!isAdmin) {
                console.log(`[DeactivateUser] ❌ Unauthorized: User ${requestingUserId} is not an admin`);
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized. Only admins can deactivate other users.'
                });
            }

            // Check if both users belong to the same enterprise
            targetUserEnterpriseId = targetUserData.enterpriseRef?.id;
            if (requestingUserEnterpriseId !== targetUserEnterpriseId) {
                console.log(`[DeactivateUser] ❌ Unauthorized: Users belong to different enterprises`);
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized. You can only deactivate users in your enterprise.'
                });
            }

            console.log(`[DeactivateUser] ✅ Admin ${requestingUserId} authorized to deactivate user ${userId}`);
        }

        // Log current user data before update
        const currentData = userDoc.data();
        console.log(`[DeactivateUser] 📋 Current user data:`);
        console.log(`[DeactivateUser]   - Current active status: ${currentData.active || 'undefined'}`);
        console.log(`[DeactivateUser]   - Email: ${currentData.email}`);

        // Update user active status
        console.log(`[DeactivateUser] 🔄 Updating active field to: ${active}`);
        console.log(`[DeactivateUser] 📍 Document path: ${userRef.path}`);
        console.log(`[DeactivateUser] 📝 Update data:`, {
            active: false,
            deactivatedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        let employeeUpdateResult = null;
        
        try {
            // Update user document
            await userRef.update({
                active: false,
                deactivatedAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log(`[DeactivateUser] ✅ User database update completed`);
            
            // Update employee document if user is an enterprise employee
            employeeUpdateResult = await updateEmployeeActiveStatus(userId, false, 'deactivation');
            if (employeeUpdateResult.success) {
                if (employeeUpdateResult.skipped) {
                    console.log(`[DeactivateUser] ⏭️  Employee update skipped: ${employeeUpdateResult.reason}`);
                } else {
                    console.log(`[DeactivateUser] ✅ Employee database update completed: ${employeeUpdateResult.employeeRef}`);
                    console.log(`[DeactivateUser] 📊 Employee status changed from ${employeeUpdateResult.previousStatus} to ${employeeUpdateResult.newStatus}`);
                }
            } else {
                console.log(`[DeactivateUser] ⚠️  Employee update failed: ${employeeUpdateResult.error}`);
                // Don't fail the entire operation if employee update fails
            }
            
        } catch (updateError) {
            console.error(`[DeactivateUser] ❌ Database update failed:`, updateError);
            throw updateError;
        }

        // Verify the update by reading the document again
        const updatedDoc = await userRef.get();
        const updatedData = updatedDoc.data();
        console.log(`[DeactivateUser] ✅ Verification - Updated active status: ${updatedData.active}`);
        console.log(`[DeactivateUser] 📋 Full updated document:`, updatedData);

        // Log user deactivation
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: requestingUserId,
            resourceId: userId,
            details: {
                updateType: 'account_deactivation',
                oldStatus: currentData.active || 'undefined',
                newStatus: 'inactive',
                deactivatedAt: updatedData.deactivatedAt,
                operationType: isSelfOperation ? 'self_deactivation' : 'admin_deactivation',
                targetUserId: userId,
                employeeUpdated: !employeeUpdateResult?.skipped,
                employeeRef: employeeUpdateResult?.employeeRef || null,
                employeePreviousStatus: employeeUpdateResult?.previousStatus,
                employeeNewStatus: employeeUpdateResult?.newStatus,
                employeeUpdateSuccess: employeeUpdateResult?.success || false,
                employeeUpdateReason: employeeUpdateResult?.reason || null
            }
        });

        res.status(200).json({
            success: true,
            message: 'User account deactivated successfully',
            data: {
                userId: userId,
                active: updatedData.active,
                deactivatedAt: updatedData.deactivatedAt,
                operationType: isSelfOperation ? 'self_deactivation' : 'admin_deactivation'
            }
        });

    } catch (error) {
        console.error('[DeactivateUser] ❌ Error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: req.user?.uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'deactivate_user'
            }
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate user account',
            error: error.message
        });
    }
};

exports.reactivateUser = async (req, res) => {
    try {
        const requestingUserId = req.user.uid;
        const { active, targetUserId } = req.body;

        console.log(`[ReactivateUser] 🔍 Reactivating user: ${targetUserId || requestingUserId}`);
        console.log(`[ReactivateUser] 📝 Active status: ${active}`);
        console.log(`[ReactivateUser] 👤 Requesting user: ${requestingUserId}`);

        if (active !== true) {
            console.log(`[ReactivateUser] ❌ Invalid active status: ${active}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Only reactivation (active: true) is supported.'
            });
        }

        // Determine target user ID
        const userId = targetUserId || requestingUserId;
        const isSelfOperation = userId === requestingUserId;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log(`[ReactivateUser] ❌ User not found: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check permissions
        if (!isSelfOperation) {
            // Admin operation - verify admin has access to this user's enterprise
            const requestingUserRef = db.collection('users').doc(requestingUserId);
            const requestingUserDoc = await requestingUserRef.get();
            
            if (!requestingUserDoc.exists) {
                return res.status(404).json({
                    success: false,
                    message: 'Requesting user not found'
                });
            }

            const requestingUserData = requestingUserDoc.data();
            const targetUserData = userDoc.data();

            // Check if requesting user is an admin by looking in the enterprise employees subcollection
            let isAdmin = false;
            let requestingUserEnterpriseId = null;
            let targetUserEnterpriseId = null;

            // Get requesting user's enterprise reference
            if (requestingUserData.enterpriseRef) {
                requestingUserEnterpriseId = requestingUserData.enterpriseRef.id;
                
                // Find the requesting user in the enterprise employees subcollection
                const departmentsSnapshot = await db.collection('enterprise')
                    .doc(requestingUserEnterpriseId)
                    .collection('departments')
                    .get();

                for (const deptDoc of departmentsSnapshot.docs) {
                    const employeesSnapshot = await deptDoc.ref.collection('employees')
                        .where('userId', '==', db.doc(`users/${requestingUserId}`))
                        .get();

                    if (!employeesSnapshot.empty) {
                        const employeeData = employeesSnapshot.docs[0].data();
                        if (employeeData.role === 'admin') {
                            isAdmin = true;
                            break;
                        }
                    }
                }
            }

            if (!isAdmin) {
                console.log(`[ReactivateUser] ❌ Unauthorized: User ${requestingUserId} is not an admin`);
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized. Only admins can reactivate other users.'
                });
            }

            // Check if both users belong to the same enterprise
            targetUserEnterpriseId = targetUserData.enterpriseRef?.id;
            if (requestingUserEnterpriseId !== targetUserEnterpriseId) {
                console.log(`[ReactivateUser] ❌ Unauthorized: Users belong to different enterprises`);
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized. You can only reactivate users in your enterprise.'
                });
            }

            console.log(`[ReactivateUser] ✅ Admin ${requestingUserId} authorized to reactivate user ${userId}`);
        }

        // Log current user data before update
        const currentData = userDoc.data();
        console.log(`[ReactivateUser] 📋 Current user data:`);
        console.log(`[ReactivateUser]   - Current active status: ${currentData.active || 'undefined'}`);
        console.log(`[ReactivateUser]   - Email: ${currentData.email}`);

        // Update user active status
        console.log(`[ReactivateUser] 🔄 Updating active field to: ${active}`);
        console.log(`[ReactivateUser] 📍 Document path: ${userRef.path}`);
        console.log(`[ReactivateUser] 📝 Update data:`, {
            active: true,
            reactivatedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            deactivatedAt: admin.firestore.FieldValue.delete()
        });
        
        let employeeUpdateResult = null;
        
        try {
            // Update user document
            await userRef.update({
                active: true,
                reactivatedAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
                deactivatedAt: admin.firestore.FieldValue.delete() // Remove deactivation timestamp
            });
            console.log(`[ReactivateUser] ✅ User database update completed`);
            
            // Update employee document if user is an enterprise employee
            employeeUpdateResult = await updateEmployeeActiveStatus(userId, true, 'reactivation');
            if (employeeUpdateResult.success) {
                if (employeeUpdateResult.skipped) {
                    console.log(`[ReactivateUser] ⏭️  Employee update skipped: ${employeeUpdateResult.reason}`);
                } else {
                    console.log(`[ReactivateUser] ✅ Employee database update completed: ${employeeUpdateResult.employeeRef}`);
                    console.log(`[ReactivateUser] 📊 Employee status changed from ${employeeUpdateResult.previousStatus} to ${employeeUpdateResult.newStatus}`);
                }
            } else {
                console.log(`[ReactivateUser] ⚠️  Employee update failed: ${employeeUpdateResult.error}`);
                // Don't fail the entire operation if employee update fails
            }
            
        } catch (updateError) {
            console.error(`[ReactivateUser] ❌ Database update failed:`, updateError);
            throw updateError;
        }

        // Verify the update by reading the document again
        const updatedDoc = await userRef.get();
        const updatedData = updatedDoc.data();
        console.log(`[ReactivateUser] ✅ Verification - Updated active status: ${updatedData.active}`);
        console.log(`[ReactivateUser] 📋 Full updated document:`, updatedData);

        // Log user reactivation
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: requestingUserId,
            resourceId: userId,
            details: {
                updateType: 'account_reactivation',
                oldStatus: currentData.active || 'undefined',
                newStatus: 'active',
                reactivatedAt: updatedData.reactivatedAt,
                operationType: isSelfOperation ? 'self_reactivation' : 'admin_reactivation',
                targetUserId: userId,
                employeeUpdated: !employeeUpdateResult?.skipped,
                employeeRef: employeeUpdateResult?.employeeRef || null,
                employeePreviousStatus: employeeUpdateResult?.previousStatus,
                employeeNewStatus: employeeUpdateResult?.newStatus,
                employeeUpdateSuccess: employeeUpdateResult?.success || false,
                employeeUpdateReason: employeeUpdateResult?.reason || null
            }
        });

        res.status(200).json({
            success: true,
            message: 'User account reactivated successfully',
            data: {
                userId: userId,
                active: updatedData.active,
                reactivatedAt: updatedData.reactivatedAt,
                operationType: isSelfOperation ? 'self_reactivation' : 'admin_reactivation'
            }
        });

    } catch (error) {
        console.error('[ReactivateUser] ❌ Error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: req.user?.uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'reactivate_user'
            }
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to reactivate user account',
            error: error.message
        });
    }
};

// Bulk Deactivate Users
exports.bulkDeactivateUsers = async (req, res) => {
    try {
        const requestingUserId = req.user.uid;
        const { userIds } = req.body;

        console.log(`[BulkDeactivateUsers] 🔍 Starting bulk deactivation`);
        console.log(`[BulkDeactivateUsers] 📝 Target users: ${userIds?.length || 0}`);
        console.log(`[BulkDeactivateUsers] 👤 Requesting user: ${requestingUserId}`);

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required and must not be empty'
            });
        }

        // Remove duplicates and validate
        const uniqueUserIds = [...new Set(userIds)];
        if (uniqueUserIds.length !== userIds.length) {
            console.log(`[BulkDeactivateUsers] ⚠️  Removed ${userIds.length - uniqueUserIds.length} duplicate user IDs`);
        }

        // Get requesting user data for permission checks
        const requestingUserRef = db.collection('users').doc(requestingUserId);
        const requestingUserDoc = await requestingUserRef.get();
        
        if (!requestingUserDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Requesting user not found'
            });
        }

        const requestingUserData = requestingUserDoc.data();
        let requestingUserEnterpriseId = null;
        let isAdmin = false;

        // Check if requesting user is an admin
        if (requestingUserData.enterpriseRef) {
            requestingUserEnterpriseId = requestingUserData.enterpriseRef.id;
            
            // Find the requesting user in the enterprise employees subcollection
            const departmentsSnapshot = await db.collection('enterprise')
                .doc(requestingUserEnterpriseId)
                .collection('departments')
                .get();

            for (const deptDoc of departmentsSnapshot.docs) {
                const employeesSnapshot = await deptDoc.ref.collection('employees')
                    .where('userId', '==', db.doc(`users/${requestingUserId}`))
                    .get();

                if (!employeesSnapshot.empty) {
                    const employeeData = employeesSnapshot.docs[0].data();
                    if (employeeData.role === 'admin') {
                        isAdmin = true;
                        break;
                    }
                }
            }
        }

        console.log(`[BulkDeactivateUsers] 🔐 Admin status: ${isAdmin}`);
        console.log(`[BulkDeactivateUsers] 🏢 Enterprise ID: ${requestingUserEnterpriseId}`);

        // Process users in batches
        const batchSize = 10; // Process 10 users at a time
        const results = {
            successful: [],
            failed: [],
            skipped: [],
            summary: {
                total: uniqueUserIds.length,
                successful: 0,
                failed: 0,
                skipped: 0
            }
        };

        console.log(`[BulkDeactivateUsers] 🔄 Processing ${uniqueUserIds.length} users in batches of ${batchSize}`);

        for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
            const batch = uniqueUserIds.slice(i, i + batchSize);
            console.log(`[BulkDeactivateUsers] 📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUserIds.length / batchSize)}`);

            // Process batch concurrently
            const batchPromises = batch.map(async (userId) => {
                try {
                    console.log(`[BulkDeactivateUsers] 👤 Processing user: ${userId}`);

                    // Check if user exists
                    const userRef = db.collection('users').doc(userId);
                    const userDoc = await userRef.get();

                    if (!userDoc.exists) {
                        console.log(`[BulkDeactivateUsers] ❌ User not found: ${userId}`);
                        return {
                            userId,
                            status: 'failed',
                            error: 'User not found'
                        };
                    }

                    const userData = userDoc.data();
                    const isSelfOperation = userId === requestingUserId;

                    // Permission checks
                    if (!isSelfOperation) {
                        if (!isAdmin) {
                            console.log(`[BulkDeactivateUsers] ❌ Unauthorized: User ${requestingUserId} is not an admin`);
                            return {
                                userId,
                                status: 'failed',
                                error: 'Unauthorized. Only admins can deactivate other users.'
                            };
                        }

                        // Check if user belongs to the same enterprise
                        const targetUserEnterpriseId = userData.enterpriseRef?.id;
                        if (requestingUserEnterpriseId !== targetUserEnterpriseId) {
                            console.log(`[BulkDeactivateUsers] ❌ Unauthorized: User ${userId} belongs to different enterprise`);
                            return {
                                userId,
                                status: 'failed',
                                error: 'Unauthorized. You can only deactivate users in your enterprise.'
                            };
                        }
                    }

                    // Update user document
                    await userRef.update({
                        active: false,
                        deactivatedAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now()
                    });

                    // Update employee document if user is an enterprise employee
                    const employeeUpdateResult = await updateEmployeeActiveStatus(userId, false, 'deactivation');

                    console.log(`[BulkDeactivateUsers] ✅ Successfully deactivated user: ${userId}`);

                    return {
                        userId,
                        status: 'successful',
                        data: {
                            active: false,
                            deactivatedAt: new Date().toISOString(),
                            operationType: isSelfOperation ? 'self_deactivation' : 'admin_deactivation',
                            employeeUpdated: !employeeUpdateResult?.skipped,
                            employeeRef: employeeUpdateResult?.employeeRef || null
                        }
                    };

                } catch (error) {
                    console.error(`[BulkDeactivateUsers] ❌ Error processing user ${userId}:`, error);
                    return {
                        userId,
                        status: 'failed',
                        error: error.message
                    };
                }
            });

            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Categorize results
            batchResults.forEach(result => {
                if (result.status === 'successful') {
                    results.successful.push(result);
                    results.summary.successful++;
                } else {
                    results.failed.push(result);
                    results.summary.failed++;
                }
            });

            // Small delay between batches to prevent overwhelming the database
            if (i + batchSize < uniqueUserIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[BulkDeactivateUsers] ✅ Bulk deactivation completed`);
        console.log(`[BulkDeactivateUsers] 📊 Summary:`, results.summary);

        // Log bulk operation
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: requestingUserId,
            resourceId: 'bulk_operation',
            details: {
                operationType: 'bulk_deactivation',
                totalUsers: results.summary.total,
                successfulCount: results.summary.successful,
                failedCount: results.summary.failed,
                skippedCount: results.summary.skipped,
                targetUserIds: uniqueUserIds,
                requestingUserEnterpriseId: requestingUserEnterpriseId,
                isAdminOperation: isAdmin,
                batchSize: batchSize,
                processingTime: Date.now()
            }
        });

        res.status(200).json({
            success: true,
            message: `Bulk deactivation completed. ${results.summary.successful} successful, ${results.summary.failed} failed.`,
            data: {
                summary: results.summary,
                successful: results.successful,
                failed: results.failed,
                skipped: results.skipped
            }
        });

    } catch (error) {
        console.error('[BulkDeactivateUsers] ❌ Error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: req.user?.uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'bulk_deactivate_users',
                targetUserIds: req.body?.userIds || []
            }
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk deactivation',
            error: error.message
        });
    }
};

// Bulk Reactivate Users
exports.bulkReactivateUsers = async (req, res) => {
    try {
        const requestingUserId = req.user.uid;
        const { userIds } = req.body;

        console.log(`[BulkReactivateUsers] 🔍 Starting bulk reactivation`);
        console.log(`[BulkReactivateUsers] 📝 Target users: ${userIds?.length || 0}`);
        console.log(`[BulkReactivateUsers] 👤 Requesting user: ${requestingUserId}`);

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required and must not be empty'
            });
        }

        // Remove duplicates and validate
        const uniqueUserIds = [...new Set(userIds)];
        if (uniqueUserIds.length !== userIds.length) {
            console.log(`[BulkReactivateUsers] ⚠️  Removed ${userIds.length - uniqueUserIds.length} duplicate user IDs`);
        }

        // Get requesting user data for permission checks
        const requestingUserRef = db.collection('users').doc(requestingUserId);
        const requestingUserDoc = await requestingUserRef.get();
        
        if (!requestingUserDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Requesting user not found'
            });
        }

        const requestingUserData = requestingUserDoc.data();
        let requestingUserEnterpriseId = null;
        let isAdmin = false;

        // Check if requesting user is an admin
        if (requestingUserData.enterpriseRef) {
            requestingUserEnterpriseId = requestingUserData.enterpriseRef.id;
            
            // Find the requesting user in the enterprise employees subcollection
            const departmentsSnapshot = await db.collection('enterprise')
                .doc(requestingUserEnterpriseId)
                .collection('departments')
                .get();

            for (const deptDoc of departmentsSnapshot.docs) {
                const employeesSnapshot = await deptDoc.ref.collection('employees')
                    .where('userId', '==', db.doc(`users/${requestingUserId}`))
                    .get();

                if (!employeesSnapshot.empty) {
                    const employeeData = employeesSnapshot.docs[0].data();
                    if (employeeData.role === 'admin') {
                        isAdmin = true;
                        break;
                    }
                }
            }
        }

        console.log(`[BulkReactivateUsers] 🔐 Admin status: ${isAdmin}`);
        console.log(`[BulkReactivateUsers] 🏢 Enterprise ID: ${requestingUserEnterpriseId}`);

        // Process users in batches
        const batchSize = 10; // Process 10 users at a time
        const results = {
            successful: [],
            failed: [],
            skipped: [],
            summary: {
                total: uniqueUserIds.length,
                successful: 0,
                failed: 0,
                skipped: 0
            }
        };

        console.log(`[BulkReactivateUsers] 🔄 Processing ${uniqueUserIds.length} users in batches of ${batchSize}`);

        for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
            const batch = uniqueUserIds.slice(i, i + batchSize);
            console.log(`[BulkReactivateUsers] 📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUserIds.length / batchSize)}`);

            // Process batch concurrently
            const batchPromises = batch.map(async (userId) => {
                try {
                    console.log(`[BulkReactivateUsers] 👤 Processing user: ${userId}`);

                    // Check if user exists
                    const userRef = db.collection('users').doc(userId);
                    const userDoc = await userRef.get();

                    if (!userDoc.exists) {
                        console.log(`[BulkReactivateUsers] ❌ User not found: ${userId}`);
                        return {
                            userId,
                            status: 'failed',
                            error: 'User not found'
                        };
                    }

                    const userData = userDoc.data();
                    const isSelfOperation = userId === requestingUserId;

                    // Permission checks
                    if (!isSelfOperation) {
                        if (!isAdmin) {
                            console.log(`[BulkReactivateUsers] ❌ Unauthorized: User ${requestingUserId} is not an admin`);
                            return {
                                userId,
                                status: 'failed',
                                error: 'Unauthorized. Only admins can reactivate other users.'
                            };
                        }

                        // Check if user belongs to the same enterprise
                        const targetUserEnterpriseId = userData.enterpriseRef?.id;
                        if (requestingUserEnterpriseId !== targetUserEnterpriseId) {
                            console.log(`[BulkReactivateUsers] ❌ Unauthorized: User ${userId} belongs to different enterprise`);
                            return {
                                userId,
                                status: 'failed',
                                error: 'Unauthorized. You can only reactivate users in your enterprise.'
                            };
                        }
                    }

                    // Update user document
                    await userRef.update({
                        active: true,
                        reactivatedAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now(),
                        deactivatedAt: admin.firestore.FieldValue.delete() // Remove deactivation timestamp
                    });

                    // Update employee document if user is an enterprise employee
                    const employeeUpdateResult = await updateEmployeeActiveStatus(userId, true, 'reactivation');

                    console.log(`[BulkReactivateUsers] ✅ Successfully reactivated user: ${userId}`);

                    return {
                        userId,
                        status: 'successful',
                        data: {
                            active: true,
                            reactivatedAt: new Date().toISOString(),
                            operationType: isSelfOperation ? 'self_reactivation' : 'admin_reactivation',
                            employeeUpdated: !employeeUpdateResult?.skipped,
                            employeeRef: employeeUpdateResult?.employeeRef || null
                        }
                    };

                } catch (error) {
                    console.error(`[BulkReactivateUsers] ❌ Error processing user ${userId}:`, error);
                    return {
                        userId,
                        status: 'failed',
                        error: error.message
                    };
                }
            });

            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Categorize results
            batchResults.forEach(result => {
                if (result.status === 'successful') {
                    results.successful.push(result);
                    results.summary.successful++;
                } else {
                    results.failed.push(result);
                    results.summary.failed++;
                }
            });

            // Small delay between batches to prevent overwhelming the database
            if (i + batchSize < uniqueUserIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[BulkReactivateUsers] ✅ Bulk reactivation completed`);
        console.log(`[BulkReactivateUsers] 📊 Summary:`, results.summary);

        // Log bulk operation
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: requestingUserId,
            resourceId: 'bulk_operation',
            details: {
                operationType: 'bulk_reactivation',
                totalUsers: results.summary.total,
                successfulCount: results.summary.successful,
                failedCount: results.summary.failed,
                skippedCount: results.summary.skipped,
                targetUserIds: uniqueUserIds,
                requestingUserEnterpriseId: requestingUserEnterpriseId,
                isAdminOperation: isAdmin,
                batchSize: batchSize,
                processingTime: Date.now()
            }
        });

        res.status(200).json({
            success: true,
            message: `Bulk reactivation completed. ${results.summary.successful} successful, ${results.summary.failed} failed.`,
            data: {
                summary: results.summary,
                successful: results.successful,
                failed: results.failed,
                skipped: results.skipped
            }
        });

    } catch (error) {
        console.error('[BulkReactivateUsers] ❌ Error:', error);
        
        // Log error
        await logActivity({
            action: ACTIONS.ERROR,
            resource: RESOURCES.USER,
            userId: req.user?.uid || 'unknown',
            status: 'error',
            details: {
                error: error.message,
                operation: 'bulk_reactivate_users',
                targetUserIds: req.body?.userIds || []
            }
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk reactivation',
            error: error.message
        });
    }
};

/**
 * Create or update user's email signature
 */
exports.updateEmailSignature = async (req, res) => {
    const { id } = req.params;
    const { 
        signatureText, 
        signatureHtml, 
        includeName = true, 
        includeTitle = true, 
        includeCompany = true, 
        includePhone = true, 
        includeEmail = true,
        includeWebsite = false,
        includeSocials = false,
        signatureStyle = 'professional',
        isActive = true
    } = req.body;

    try {
        // Verify the user exists
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = userDoc.data();
        
        // Get user's card data for signature generation
        const cardDoc = await db.collection('cards').doc(id).get();
        const cardData = cardDoc.exists ? cardDoc.data() : { cards: [] };
        const userCard = cardData.cards && cardData.cards.length > 0 ? cardData.cards[0] : {};

        // Generate signature HTML if not provided
        let finalSignatureHtml = signatureHtml;
        if (!signatureHtml && signatureText) {
            finalSignatureHtml = generateSignatureHtml({
                signatureText,
                userData,
                userCard,
                includeName,
                includeTitle,
                includeCompany,
                includePhone,
                includeEmail,
                includeWebsite,
                includeSocials,
                signatureStyle
            });
        }

        // Prepare signature data
        const signatureData = {
            signatureText: signatureText || '',
            signatureHtml: finalSignatureHtml || '',
            includeName,
            includeTitle,
            includeCompany,
            includePhone,
            includeEmail,
            includeWebsite,
            includeSocials,
            signatureStyle,
            isActive,
            updatedAt: admin.firestore.Timestamp.now()
        };

        // Update user with signature data
        await userRef.update({
            emailSignature: signatureData
        });

        // Log signature update
        await logActivity({
            action: ACTIONS.UPDATE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                signatureUpdated: true,
                signatureStyle,
                isActive
            }
        });

        res.status(200).send({
            message: 'Email signature updated successfully',
            signature: signatureData
        });

    } catch (error) {
        console.error('Error updating email signature:', error);
        res.status(500).send({
            message: 'Failed to update email signature',
            error: error.message
        });
    }
};

/**
 * Get user's email signature
 */
exports.getEmailSignature = async (req, res) => {
    const { id } = req.params;

    try {
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        const userData = userDoc.data();
        const signature = userData.emailSignature || null;

        res.status(200).send({
            signature,
            hasSignature: !!signature
        });

    } catch (error) {
        console.error('Error getting email signature:', error);
        res.status(500).send({
            message: 'Failed to get email signature',
            error: error.message
        });
    }
};

/**
 * Delete user's email signature
 */
exports.deleteEmailSignature = async (req, res) => {
    const { id } = req.params;

    try {
        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Remove email signature
        await userRef.update({
            emailSignature: admin.firestore.FieldValue.delete()
        });

        // Log signature deletion
        await logActivity({
            action: ACTIONS.DELETE,
            resource: RESOURCES.USER,
            userId: id,
            resourceId: id,
            details: {
                signatureDeleted: true
            }
        });

        res.status(200).send({
            message: 'Email signature deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting email signature:', error);
        res.status(500).send({
            message: 'Failed to delete email signature',
            error: error.message
        });
    }
};

/**
 * Generate signature HTML based on user data and preferences
 */
const generateSignatureHtml = ({ 
    signatureText, 
    userData, 
    userCard, 
    includeName, 
    includeTitle, 
    includeCompany, 
    includePhone, 
    includeEmail, 
    includeWebsite, 
    includeSocials, 
    signatureStyle 
}) => {
    const styles = {
        professional: {
            container: 'font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.4;',
            name: 'font-weight: bold; color: #2c3e50; font-size: 16px;',
            title: 'color: #7f8c8d; font-style: italic;',
            contact: 'color: #34495e;',
            separator: 'color: #bdc3c7;'
        },
        modern: {
            container: 'font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #2c3e50; line-height: 1.6;',
            name: 'font-weight: 600; color: #1a252f; font-size: 16px;',
            title: 'color: #5d6d7e; font-weight: 500;',
            contact: 'color: #34495e;',
            separator: 'color: #85929e;'
        },
        minimal: {
            container: 'font-family: "Helvetica Neue", Arial, sans-serif; font-size: 13px; color: #555; line-height: 1.5;',
            name: 'font-weight: 600; color: #333; font-size: 15px;',
            title: 'color: #666;',
            contact: 'color: #555;',
            separator: 'color: #ddd;'
        }
    };

    const style = styles[signatureStyle] || styles.professional;
    
    let signatureParts = [];
    
    // Add custom signature text if provided
    if (signatureText) {
        signatureParts.push(`<div style="${style.container}">${signatureText}</div>`);
    }
    
    // Add name
    if (includeName && (userData.name || userCard.name)) {
        const fullName = `${userData.name || userCard.name || ''} ${userData.surname || userCard.surname || ''}`.trim();
        if (fullName) {
            signatureParts.push(`<div style="${style.name}">${fullName}</div>`);
        }
    }
    
    // Add title
    if (includeTitle && (userData.occupation || userCard.occupation)) {
        signatureParts.push(`<div style="${style.title}">${userData.occupation || userCard.occupation}</div>`);
    }
    
    // Add company
    if (includeCompany && (userData.company || userCard.company)) {
        signatureParts.push(`<div style="${style.contact}">${userData.company || userCard.company}</div>`);
    }
    
    // Add contact information
    const contactInfo = [];
    
    if (includePhone && (userData.phone || userCard.phone)) {
        contactInfo.push(`📞 ${userData.phone || userCard.phone}`);
    }
    
    if (includeEmail && (userData.email || userCard.email)) {
        contactInfo.push(`✉️ ${userData.email || userCard.email}`);
    }
    
    if (includeWebsite && userCard.website) {
        contactInfo.push(`🌐 ${userCard.website}`);
    }
    
    if (contactInfo.length > 0) {
        signatureParts.push(`<div style="${style.contact}">${contactInfo.join(' | ')}</div>`);
    }
    
    // Add social media links
    if (includeSocials && userCard.socials) {
        const socialLinks = [];
        const socials = userCard.socials;
        
        if (socials.linkedin) socialLinks.push(`<a href="${socials.linkedin}" style="color: #0077b5; text-decoration: none;">LinkedIn</a>`);
        if (socials.twitter) socialLinks.push(`<a href="${socials.twitter}" style="color: #1da1f2; text-decoration: none;">Twitter</a>`);
        if (socials.facebook) socialLinks.push(`<a href="${socials.facebook}" style="color: #1877f2; text-decoration: none;">Facebook</a>`);
        if (socials.instagram) socialLinks.push(`<a href="${socials.instagram}" style="color: #e4405f; text-decoration: none;">Instagram</a>`);
        
        if (socialLinks.length > 0) {
            signatureParts.push(`<div style="${style.contact}">${socialLinks.join(' | ')}</div>`);
        }
    }
    
    // Add XS Card branding
    signatureParts.push(`<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid ${style.separator}; font-size: 12px; color: #95a5a6;">
        Sent via <a href="https://xscard.com" style="color: #3498db; text-decoration: none;">XS Card</a>
    </div>`);
    
    return signatureParts.join('<br>');
};
