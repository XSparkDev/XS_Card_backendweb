const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const enterpriseController = require('../controllers/enterpriseController');

// Get all enterprises
router.get('/enterprises', authenticateUser, enterpriseController.getAllEnterprises);

// Get enterprise by ID
router.get('/enterprises/:enterpriseId', authenticateUser, enterpriseController.getEnterpriseById);

// Create new enterprise
router.post('/enterprises', authenticateUser, enterpriseController.createEnterprise);

// Update enterprise
router.put('/enterprises/:enterpriseId', authenticateUser, enterpriseController.updateEnterprise);

// Delete enterprise
router.delete('/enterprises/:enterpriseId', authenticateUser, enterpriseController.deleteEnterprise);

// Get enterprise statistics
router.get('/enterprises/:enterpriseId/stats', authenticateUser, enterpriseController.getEnterpriseStats);

module.exports = router; 