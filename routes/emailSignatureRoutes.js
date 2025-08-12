const express = require('express');
const router = express.Router();
const emailSignatureController = require('../controllers/emailSignatureController');
const { authenticateUser } = require('../middleware/auth');

// Public routes (no authentication required) - moved to root level
router.get('/public/signature-templates', emailSignatureController.getSignatureTemplates);

// All routes below this middleware will require authentication
router.use(authenticateUser);

// Protected routes
router.post('/Users/:id/signature-preview', emailSignatureController.previewSignature);
router.post('/Users/:id/test-signature', emailSignatureController.testSignature);
router.patch('/enterprise/:enterpriseId/bulk-signatures', emailSignatureController.bulkUpdateSignatures);

module.exports = router;

