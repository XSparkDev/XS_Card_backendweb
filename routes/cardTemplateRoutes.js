const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { handleSingleUpload } = require('../middleware/fileUpload');
const cardTemplateController = require('../controllers/cardTemplateController');

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * Template CRUD Routes
 */

// Create a new template with logo upload
// POST /api/templates
router.post('/', handleSingleUpload('companyLogo'), cardTemplateController.createTemplate);

// Get all templates for an enterprise
// GET /api/templates/:enterpriseId
router.get('/:enterpriseId', cardTemplateController.getEnterpriseTemplates);

// Get templates for a specific department
// GET /api/templates/:enterpriseId/departments/:departmentId
router.get('/:enterpriseId/departments/:departmentId', cardTemplateController.getDepartmentTemplates);

// Get effective template for a department (with inheritance)
// GET /api/templates/:enterpriseId/:departmentId/effective
router.get('/:enterpriseId/:departmentId/effective', cardTemplateController.getEffectiveTemplate);

// Get a specific template by ID
// GET /api/templates/template/:templateId
router.get('/template/:templateId', cardTemplateController.getTemplate);

// Preview template - returns what a card would look like
// GET /api/templates/template/:templateId/preview
router.get('/template/:templateId/preview', cardTemplateController.previewTemplate);

// Update a template with logo upload
// PUT /api/templates/:templateId
router.put('/:templateId', handleSingleUpload('companyLogo'), cardTemplateController.updateTemplate);

// Delete a template (soft delete)
// DELETE /api/templates/:templateId
router.delete('/:templateId', cardTemplateController.deleteTemplate);

module.exports = router;