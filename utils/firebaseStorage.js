const { bucket } = require('../firebase');
const path = require('path');
const { format } = require('util');
const fs = require('fs');

/**
 * Upload a file to Firebase Storage
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID for folder structure
 * @param {string} fileType - Type of file (e.g., 'profileImage', 'companyLogo')
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
const uploadFile = async (fileBuffer, originalName, userId, fileType) => {
  // Debugging to trace issues
  console.log('uploadFile called with:');
  console.log('- fileBuffer exists:', !!fileBuffer);
  console.log('- originalName:', originalName);
  console.log('- userId:', userId);
  console.log('- fileType:', fileType);
  console.log('- bucket exists:', !!bucket);

  if (!fileBuffer) {
    throw new Error('No file provided');
  }

  // Check if Firebase Storage is available (bucket is not a mock)
  const isFirebaseAvailable = bucket && typeof bucket.file === 'function' && bucket.name !== 'mock-bucket';
  
  try {
    if (isFirebaseAvailable) {
      // FIREBASE STORAGE APPROACH
      console.log('Using Firebase Storage approach');
      
      // Create a unique filename to avoid collisions
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(originalName || '.jpg');
      const filename = `${fileType}-${uniqueSuffix}${extension}`;
      
      // Create a reference to the file in Firebase Storage
      let filePath;
      if (fileType === 'apk') {
        // Store APK files in a dedicated apk-files folder
        filePath = `apk-files/${filename}`;
      } else if (fileType === 'bannerImage' || fileType === 'eventImages') {
        // Store event-related images in events folder
        filePath = `events/${userId}/${filename}`;
      } else if (fileType === 'companyLogo' && userId.includes('template')) {
        // Store template logos in templates folder
        filePath = `templates/${userId}/${filename}`;
      } else if (fileType === 'companyLogo') {
        // Store regular company logos in profiles folder
        filePath = `profiles/${userId}/${filename}`;
      } else {
        // Default to user-specific profile folders
        filePath = `profiles/${userId}/${filename}`;
      }
      console.log('Creating file reference at path:', filePath);
      
      const file = bucket.file(filePath);
      if (!file) {
        throw new Error('Failed to create file reference');
      }

      // Set metadata for the file
      const metadata = {
        contentType: getContentType(extension)
      };

      // Upload the file
      console.log('Starting file upload to Firebase...');
      await file.save(fileBuffer, {
        metadata: metadata,
        public: true, // Make file publicly accessible
        validation: 'md5'
      });

      // Make the file publicly accessible
      console.log('Making file public...');
      await file.makePublic();

      // Get the public URL
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${filePath}`);
      console.log('Upload complete. Firebase URL:', publicUrl);
      
      return publicUrl;
    } else {
      // FALLBACK LOCAL APPROACH 
      console.warn('FALLBACK: Using local file storage approach since Firebase Storage is not available');
      
      // Create uploads directory if it doesn't exist
      let uploadsDir;
      if (fileType === 'apk') {
        uploadsDir = path.join(__dirname, '..', 'public', 'downloads');
      } else if (fileType === 'bannerImage' || fileType === 'eventImages') {
        uploadsDir = path.join(__dirname, '..', 'public', 'events');
      } else if (fileType === 'companyLogo' && userId.includes('template')) {
        uploadsDir = path.join(__dirname, '..', 'public', 'templates');
      } else {
        uploadsDir = path.join(__dirname, '..', 'public', 'profiles');
      }
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      let userDir;
      if (fileType === 'apk') {
        // APK files don't need user-specific directories in local storage
        userDir = uploadsDir;
      } else {
        // Create user directory for other images
        userDir = path.join(uploadsDir, userId);
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }
      }
      
      // Create a unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(originalName || '.jpg');
      const filename = `${fileType}-${uniqueSuffix}${extension}`;
      const filePath = path.join(userDir, filename);
      
      // Write the file
      fs.writeFileSync(filePath, fileBuffer);
      
      // Return the relative URL path
      let relativePath;
      if (fileType === 'apk') {
        relativePath = `/downloads/${filename}`;
      } else if (fileType === 'bannerImage' || fileType === 'eventImages') {
        relativePath = `/events/${userId}/${filename}`;
      } else if (fileType === 'companyLogo' && userId.includes('template')) {
        relativePath = `/templates/${userId}/${filename}`;
      } else {
        relativePath = `/profiles/${userId}/${filename}`;
      }
      console.log('Local fallback successful. URL:', relativePath);
      
      return relativePath;
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    console.error('Error stack:', error.stack);
    
    // In case of error, try to fall back to local storage if we were using Firebase
    if (isFirebaseAvailable) {
      console.warn('Attempting local fallback after Firebase upload failure');
      try {
        // Create uploads directory if it doesn't exist
        let uploadsDir;
        if (fileType === 'apk') {
          uploadsDir = path.join(__dirname, '..', 'public', 'downloads');
        } else if (fileType === 'bannerImage' || fileType === 'eventImages') {
          uploadsDir = path.join(__dirname, '..', 'public', 'events');
        } else if (fileType === 'companyLogo' && userId.includes('template')) {
          uploadsDir = path.join(__dirname, '..', 'public', 'templates');
        } else {
          uploadsDir = path.join(__dirname, '..', 'public', 'profiles');
        }
        
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        let userDir;
        if (fileType === 'apk') {
          // APK files don't need user-specific directories in local storage
          userDir = uploadsDir;
        } else {
          // Create user directory for other images
          userDir = path.join(uploadsDir, userId);
          if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
          }
        }
        
        // Create a unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(originalName || '.jpg');
        const filename = `${fileType}-${uniqueSuffix}${extension}`;
        const filePath = path.join(userDir, filename);
        
        // Write the file
        fs.writeFileSync(filePath, fileBuffer);
        
        // Return the relative URL path
        let relativePath;
        if (fileType === 'apk') {
          relativePath = `/downloads/${filename}`;
        } else if (fileType === 'bannerImage' || fileType === 'eventImages') {
          relativePath = `/events/${userId}/${filename}`;
        } else if (fileType === 'companyLogo' && userId.includes('template')) {
          relativePath = `/templates/${userId}/${filename}`;
        } else {
          relativePath = `/profiles/${userId}/${filename}`;
        }
        console.log('Local fallback successful. URL:', relativePath);
        
        return relativePath;
      } catch (fallbackError) {
        console.error('Fallback to local storage also failed:', fallbackError);
        throw new Error(`Failed to upload file and fallback also failed: ${error.message}`);
      }
    }
    
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete a file from Firebase Storage
 * @param {string} fileUrl - Public URL of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
const deleteFile = async (fileUrl) => {
  try {
    // Check if it's a Firebase Storage URL
    if (fileUrl.includes('storage.googleapis.com')) {
      // Extract file path from the URL
      const storagePath = new URL(fileUrl).pathname.split('/').slice(2).join('/');
      const file = bucket.file(storagePath);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`File ${storagePath} does not exist`);
        return true; // Return true as the file is already gone
      }
      
      // Delete the file
      await file.delete();
      return true;
    } else {
      // Handle local file deletion
      const localPath = path.join(__dirname, '..', 'public', fileUrl);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log('Local file deleted:', localPath);
      }
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get content type based on file extension
 * @param {string} extension - File extension
 * @returns {string} - Content type
 */
const getContentType = (extension) => {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.apk': 'application/vnd.android.package-archive'
  };
  
  return types[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Convert a relative path to a Firebase Storage URL
 * Used for migrating existing references
 * @param {string} relativePath - Relative path (e.g. /profiles/image.jpg)
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Public URL or null if file doesn't exist
 */
const convertPathToStorageUrl = async (relativePath, userId) => {
  if (!relativePath || !relativePath.startsWith('/profiles/')) {
    return null;
  }
  
  try {
    // Extract filename from path
    const filename = path.basename(relativePath);
    
    // New path in Firebase Storage
    const newPath = `profiles/${userId}/${filename}`;
    
    // Return the Firebase Storage URL
    return format(`https://storage.googleapis.com/${bucket.name}/${newPath}`);
  } catch (error) {
    console.error('Error converting path to storage URL:', error);
    return null;
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getContentType,
  convertPathToStorageUrl
};