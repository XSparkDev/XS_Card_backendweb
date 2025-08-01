const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');
const { authenticateUser } = require('../middleware/auth');
const { handleSingleUpload, handleMultipleUploads } = require('../middleware/fileUpload');

// Apply authentication middleware to all card routes
router.use(authenticateUser);

// Group routes by resource
// Card operations
router.get('/Cards/:id', cardController.getCardById);
router.post('/AddCard', 
  handleMultipleUploads([
    { name: 'profileImage', maxCount: 1 },
    { name: 'companyLogo', maxCount: 1 }
  ]), 
  cardController.addCard
);
router.patch('/Cards/:id', handleSingleUpload('image'), cardController.updateCard);
router.delete('/Cards/:id', cardController.deleteCard);
router.post('/Cards/:userId/wallet/:cardIndex?', cardController.createWalletPass);
router.patch('/Cards/:id/color', cardController.updateCardColor);
router.get('/generateQR/:userId/:cardIndex', cardController.generateQR);
// router.get('/Cards', cardController.getAllCards);

module.exports = router;
