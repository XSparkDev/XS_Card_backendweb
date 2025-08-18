const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateUser } = require('../middleware/auth');

// Keep these public routes
router.post('/saveContactInfo', contactController.saveContactInfo);
router.post('/saveContact', contactController.saveContactInfo);
router.post('/public/saveContact', contactController.saveContactInfo);

// Protected routes
router.use(authenticateUser);
router.get('/Contacts', contactController.getAllContacts);
router.get('/Contacts/:id', contactController.getContactById);
router.patch('/Contacts/:id', contactController.updateContact);
router.delete('/Contacts/:id', contactController.deleteContact);
router.delete('/Contacts/:id/contact/:index', contactController.deleteContactFromList);

// Contact permissions management
router.put('/enterprise/:enterpriseId/users/:userId/contact-permissions', contactController.updateUserContactPermissions);

module.exports = router;


module.exports = router;


module.exports = router;
