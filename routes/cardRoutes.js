const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');
const { authenticateUser } = require('../middleware/auth');

// Add multer middleware
const multer = require('multer');
const path = require('path');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/profiles/');  // Store files in public/profiles/
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
  }
});

// Apply authentication middleware to all card routes
router.use(authenticateUser);

// Group routes by resource
// Card operations
router.get('/Cards/:id', cardController.getCardById);
router.post('/AddCard', 
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'companyLogo', maxCount: 1 }
  ]), 
  cardController.addCard
);
router.patch('/Cards/:id', upload.single('image'), cardController.updateCard);
router.delete('/Cards/:id', cardController.deleteCard);
router.post('/Cards/:userId/wallet/:cardIndex?', cardController.createWalletPass);
router.patch('/Cards/:id/color', cardController.updateCardColor);
router.get('/generateQR/:userId/:cardIndex', cardController.generateQR);
// router.get('/Cards', cardController.getAllCards);

module.exports = router;
