/**
 * File Upload Middleware
 */

const multer = require('multer');
const { uploadFile } = require('../utils/firebaseStorage');

// Set up multer with memory storage instead of disk storage
const storage = multer.memoryStorage();

// Create upload middleware with file size and type validation
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 120 * 1024 * 1024, // Increased to 120MB for larger files
  },
  fileFilter: (req, file, cb) => {
    // Accept image files and APK files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else if (file.mimetype === 'application/vnd.android.package-archive' || 
               file.originalname.toLowerCase().endsWith('.apk')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files and APK files are allowed!'), false);
    }
  }
});

/**
 * Middleware to handle upload and Firebase Storage processing for a single file
 * @param {string} fieldName - Name of the field containing the file
 */
const handleSingleUpload = (fieldName) => {
  return async (req, res, next) => {
    // Use multer to process the upload
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: `File upload failed: ${err.message}`
        });
      }

      try {
        // If no file was uploaded, just continue
        if (!req.file || !req.file.buffer) {
          console.log('No file uploaded or file buffer is missing');
          return next();
        }

        // Get user ID from authenticated request or params
        // Check both id and userId params, also allow userId or uid in the body
        let userId = req.user?.uid || 
                     req.params.id || 
                     req.params.userId || 
                     req.body.userId || 
                     req.body.uid || 
                     req.query.userId ||
                     (req.body.email ? `temp_${req.body.email}` : null);
        
        // For APK files, use a system/default userId since APKs are global
        if (fieldName === 'apk') {
          userId = 'system_apk_uploads';
          console.log('Using system userId for APK upload');
        } else if (!userId) {
          return res.status(400).json({
            success: false,
            message: 'User ID or email is required for file upload'
          });
        }

        console.log(`Uploading file: ${fieldName}, buffer size: ${req.file.buffer.length}, userId: ${userId}`);
        
        // Upload file to Firebase Storage
        const fileUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname || `${fieldName}.jpg`,
          userId,
          fieldName
        );

        // Add the Firebase Storage URL to the request
        req.firebaseStorageUrl = fileUrl;
        
        // For backward compatibility, maintain similar structure to the old multer middleware
        req.file.firebaseUrl = fileUrl;

        next();
      } catch (error) {
        console.error('Error in file upload middleware:', error);
        return res.status(500).json({
          success: false,
          message: `File upload to storage failed: ${error.message}`
        });
      }
    });
  };
};

/**
 * Middleware to handle upload and Firebase Storage processing for multiple files
 * @param {Array} fields - Array of field configurations ([{ name: 'fieldName', maxCount: 1 }])
 */
const handleMultipleUploads = (fields) => {
  return async (req, res, next) => {
    // Use multer to process the uploads
    upload.fields(fields)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: `File upload failed: ${err.message}`
        });
      }

      try {
        // If no files were uploaded, just continue
        if (!req.files || Object.keys(req.files).length === 0) {
          return next();
        }

        // Get user ID from authenticated request or params
        // Check both id and userId params, also allow userId or uid in the body and query
        let userId = req.user?.uid || 
                     req.params.id || 
                     req.params.userId || 
                     req.body.userId || 
                     req.body.uid || 
                     req.query.userId ||
                     (req.body.email ? `temp_${req.body.email}` : null);
        
        // For APK files, use a system/default userId since APKs are global
        if (Object.keys(req.files).includes('apk')) {
          userId = 'system_apk_uploads';
          console.log('Using system userId for APK upload in multiple files');
        } else if (!userId) {
          return res.status(400).json({
            success: false,
            message: 'User ID or email is required for file upload'
          });
        }

        // Upload each file to Firebase Storage
        req.firebaseStorageUrls = {};
        
        // Process each field
        for (const fieldName of Object.keys(req.files)) {
          // Process each file in the field
          const filePromises = req.files[fieldName].map(async (file) => {
            if (!file || !file.buffer) {
              console.log(`Invalid file in ${fieldName}`);
              return null;
            }
            
            console.log(`Uploading file in ${fieldName}, buffer size: ${file.buffer.length}`);
            
            const fileUrl = await uploadFile(
              file.buffer,
              file.originalname || `${fieldName}.jpg`,
              userId,
              fieldName
            );
            
            // Add Firebase URL to the file object for backward compatibility
            file.firebaseUrl = fileUrl;
            
            return fileUrl;
          });
          
          // Wait for all files in this field to be uploaded
          const urls = await Promise.all(filePromises);
          const validUrls = urls.filter(url => url !== null);
          
          // Store the first URL if there's only one file, or array if multiple
          if (validUrls.length > 0) {
            req.firebaseStorageUrls[fieldName] = validUrls.length === 1 ? validUrls[0] : validUrls;
          }
        }

        next();
      } catch (error) {
        console.error('Error in multiple files upload middleware:', error);
        return res.status(500).json({
          success: false,
          message: `File upload to storage failed: ${error.message}`
        });
      }
    });
  };
};

module.exports = {
  handleSingleUpload,
  handleMultipleUploads
};