const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userController = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const profilesDir = path.join(__dirname, '..', 'public', 'profiles');
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

// Public routes (no authentication required)
router.post('/SignIn', userController.signIn);
router.post('/AddUser', upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'companyLogo', maxCount: 1 }
]), userController.addUser);
router.get('/verify-email', userController.verifyEmail);

// Public routes for the frontend (no authentication required)
router.get('/public/Users', userController.getAllUsers);
router.get('/public/Users/:id', userController.getUserById);

// Password reset routes (no authentication required)
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/reset-user-info', userController.getResetUserInfo);

// All routes below this middleware will require authentication
router.use(authenticateUser);

// Protected routes
router.post('/logout', userController.logout);
router.post('/resend-verification/:uid', userController.resendVerification);
router.get('/Users', userController.getAllUsers);
router.get('/Users/:id', userController.getUserById);
router.patch('/UpdateUser/:id', upload.single('profileImage'), userController.updateUser);
router.delete('/Users/:id', userController.deleteUser);
router.patch('/Users/:id/profile-image', upload.single('profileImage'), userController.updateProfileImage);
router.patch('/Users/:id/company-logo', upload.single('companyLogo'), userController.updateCompanyLogo);
router.patch('/Users/:id/color', userController.updateUserColor);
router.patch('/Users/:id/upgrade', authenticateUser, userController.upgradeToPremium);
router.patch('/deactivate', userController.deactivateUser);
router.patch('/reactivate', userController.reactivateUser);
router.patch('/bulk-deactivate', userController.bulkDeactivateUsers);
router.patch('/bulk-reactivate', userController.bulkReactivateUsers);

module.exports = router;
