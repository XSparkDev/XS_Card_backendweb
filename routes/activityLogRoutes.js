const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticateUser } = require('../middleware/auth');

// Add a test route without authentication
router.get('/logs/test', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Activity log API is working',
    timestamp: new Date().toISOString()
  });
});

router.get('/logs/health', (req, res) => {
  res.status(200).json({
    status: 'logs_api_available',
    timestamp: new Date().toISOString(),
    actions: Object.values(require('../utils/logger').ACTIONS),
    resources: Object.values(require('../utils/logger').RESOURCES)
  });
});

// Apply authentication middleware to protected routes
router.use('/logs', authenticateUser);

// Activity log routes
router.get('/logs/action/:action', activityLogController.getByAction);
router.get('/logs/resource/:resource', activityLogController.getByResource);
router.get('/logs/user/:userId', activityLogController.getUserHistory);
router.get('/logs/errors', activityLogController.getErrors);
router.get('/logs', activityLogController.getAll);

// Scan analytics routes
router.get('/logs/analytics/scan', activityLogController.getScanAnalytics);
router.get('/logs/analytics/scan/:enterpriseId', activityLogController.getScanAnalytics);

// Comprehensive enterprise scan analytics
router.get('/logs/analytics/enterprise/:enterpriseId/comprehensive', activityLogController.getEnterpriseScanAnalytics);
router.get('/logs/analytics/enterprise/:enterpriseId/cards', activityLogController.getEnterpriseCardsWithScans);

module.exports = router;
