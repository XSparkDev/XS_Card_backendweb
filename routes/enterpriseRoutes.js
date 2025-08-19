const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const enterpriseController = require('../controllers/enterpriseController');
const contactAggregationController = require('../controllers/enterprise/contactAggregationController');

// Get all enterprises
router.get('/enterprise', authenticateUser, enterpriseController.getAllEnterprises);

// Get enterprise by ID
router.get('/enterprise/:enterpriseId', authenticateUser, enterpriseController.getEnterpriseById);

// Create new enterprise
router.post('/enterprise', authenticateUser, enterpriseController.createEnterprise);

// Update enterprise
router.put('/enterprise/:enterpriseId', authenticateUser, enterpriseController.updateEnterprise);

// Delete enterprise
router.delete('/enterprise/:enterpriseId', authenticateUser, enterpriseController.deleteEnterprise);

// Get enterprise statistics
router.get('/enterprise/:enterpriseId/stats', authenticateUser, enterpriseController.getEnterpriseStats);

// PHASE 3: Enterprise billing endpoints
router.get('/enterprise/invoices', authenticateUser, enterpriseController.getEnterpriseInvoices);
router.get('/enterprise/invoices/:invoiceId/download', authenticateUser, enterpriseController.downloadInvoice);
router.post('/enterprise/demo', authenticateUser, enterpriseController.submitDemoRequest);
router.post('/enterprise/inquiry', authenticateUser, enterpriseController.submitEnterpriseInquiry);

// Development/Testing only - Create sample invoices
if (process.env.NODE_ENV !== 'production') {
  router.post('/enterprise/:enterpriseId/create-sample-invoices', authenticateUser, enterpriseController.createSampleInvoices);
}

// Enterprise Email Interface - with increased payload limit for attachments
router.post('/enterprise/email/send', 
  express.json({ limit: '50mb' }), 
  authenticateUser, 
  enterpriseController.sendEnterpriseEmail
);
router.get('/enterprise/email/logs', authenticateUser, enterpriseController.getEnterpriseEmailLogs);

// Contact aggregation endpoints (with caching)
router.get('/enterprise/:enterpriseId/contacts/summary', authenticateUser, contactAggregationController.getEnterpriseContactsSummary);
router.get('/enterprise/:enterpriseId/departments/:departmentId/contacts/summary', authenticateUser, contactAggregationController.getDepartmentContactsSummary);

// Contact details endpoints (detailed contact information)
router.get('/enterprise/:enterpriseId/contacts/details', authenticateUser, contactAggregationController.getEnterpriseContactsWithDetails);
router.get('/enterprise/:enterpriseId/departments/:departmentId/contacts/details', authenticateUser, contactAggregationController.getDepartmentContactsWithDetails);

// Cache management endpoints (for admin/debugging)
router.get('/cache/stats', authenticateUser, contactAggregationController.getCacheStats);
router.delete('/cache/clear', authenticateUser, contactAggregationController.clearAllCache);

// PHASE 5 & 6: Advanced cache management endpoints
router.delete('/cache/departments/clear', authenticateUser, contactAggregationController.invalidateAllDepartmentCaches);
router.post('/cache/warm', authenticateUser, contactAggregationController.warmCacheForEnterprises);

// Configuration endpoints
router.put('/cache/config', authenticateUser, contactAggregationController.updateCacheConfig);
router.get('/cache/config', authenticateUser, contactAggregationController.getCacheConfig);

// Advanced analytics
router.get('/cache/analytics', authenticateUser, contactAggregationController.getCacheAnalytics);

// Security Alerts System Routes
const securityAlertsController = require('../controllers/enterprise/securityAlertsController');
const securityLogsController = require('../controllers/enterprise/securityLogsController');
const securityActionsController = require('../controllers/enterprise/securityActionsController');

// Security Alerts endpoints
router.get('/enterprise/:enterpriseId/security/alerts', authenticateUser, securityAlertsController.getSecurityAlerts);
router.post('/enterprise/:enterpriseId/security/alerts/:alertId/acknowledge', authenticateUser, securityAlertsController.acknowledgeSecurityAlert);
router.post('/enterprise/:enterpriseId/security/alerts/:alertId/resolve', authenticateUser, securityAlertsController.resolveSecurityAlert);

// Security Logs endpoints
router.get('/enterprise/:enterpriseId/security/logs', authenticateUser, securityLogsController.getSecurityLogs);
router.get('/enterprise/:enterpriseId/security/logs/export', authenticateUser, securityLogsController.exportSecurityLogs);
router.get('/enterprise/:enterpriseId/security/logs/stats', authenticateUser, securityLogsController.getSecurityLogStats);

// Security Actions endpoints
router.post('/enterprise/:enterpriseId/security/actions/force-password-reset', authenticateUser, securityActionsController.forcePasswordReset);
router.post('/enterprise/:enterpriseId/security/actions/temp-lock-account', authenticateUser, securityActionsController.tempLockAccount);
router.post('/enterprise/:enterpriseId/security/actions/send-security-alert', authenticateUser, securityActionsController.sendSecurityAlert);
router.post('/enterprise/:enterpriseId/security/actions/create-incident', authenticateUser, securityActionsController.createIncidentReport);

// Individual Permissions endpoints (Business Cards POC)
router.put('/enterprise/:enterpriseId/users/:userId/permissions', authenticateUser, enterpriseController.updateUserIndividualPermissions);

// Calendar Permissions endpoints
router.put('/enterprise/:enterpriseId/users/:userId/calendar-permissions', authenticateUser, enterpriseController.updateUserCalendarPermissions);

module.exports = router;