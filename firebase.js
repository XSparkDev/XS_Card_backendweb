const admin = require('firebase-admin');
require('dotenv').config();

// Check for required environment variables
const requiredEnvVars = [
  'FIREBASE_TYPE',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID'
];

// Check if we have the minimum required Firebase credentials
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
const hasValidCredentials = missingVars.length === 0;

// Initialize exports
let db, storage, bucket;

// Function to implement fallback file storage behavior without Firebase
const createLocalStorageFallbacks = () => {
  console.warn('=====================================================================');
  console.warn('WARNING: Running without Firebase Storage due to missing credentials!');
  console.warn('Images will not be uploaded to Firebase Storage.');
  console.warn('Add Firebase credentials to your .env file to enable Firebase Storage.');
  console.warn('=====================================================================');
  
  // Create mock storage object
  storage = {
    bucket: () => {
      console.warn('[MOCK] Attempted to access Firebase Storage bucket without credentials');
      return null;
    }
  };
  
  // Create mock bucket object
  bucket = {
    name: 'mock-bucket',
    file: (filePath) => {
      console.warn('[MOCK] Attempted to create Firebase Storage file:', filePath);
      return {
        save: async () => {
          console.warn('[MOCK] Attempted to save file to Firebase Storage');
          return null;
        },
        makePublic: async () => {
          console.warn('[MOCK] Attempted to make file public in Firebase Storage');
          return null;
        }
      };
    }
  };
};

try {
  if (hasValidCredentials) {
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
};

    // Determine storage bucket
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      storageBucket: storageBucket
    });
    
    console.log('Firebase initialized successfully with bucket:', storageBucket);
    
    // Initialize Firestore and Storage
    db = admin.firestore();
    storage = admin.storage();
    bucket = storage.bucket();
    
    // Enable timestamps in snapshots and ignore undefined properties
    db.settings({ 
      timestampsInSnapshots: true,
      ignoreUndefinedProperties: true 
    });
  } else {
    throw new Error('Missing required Firebase credentials');
  }
} catch (error) {
  console.error('Failed to initialize Firebase with credentials:', error.message);
  
  // Create mock objects when Firebase initialization fails
  createLocalStorageFallbacks();
  
  // Try to initialize Firebase without Storage for Firestore only
  try {
    // Use service account from environment or application default credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Attempting to initialize Firebase with application default credentials...');
      admin.initializeApp();
    } else {
      console.log('Initializing Firebase in fallback mode without Storage...');
      
      // Create a minimal service account for Firestore
      const minimalServiceAccount = {
        type: process.env.FIREBASE_TYPE || 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || 'demo-project',
        private_key_id: 'dummy-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu\nNMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ\n-----END PRIVATE KEY-----\n',
        client_email: 'firebase-adminsdk@demo-project.iam.gserviceaccount.com',
        client_id: '123456789',
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(minimalServiceAccount)
      });
    }
    
    // Get Firestore instance
    db = admin.firestore();

// Enable timestamps in snapshots
    db.settings({ 
      timestampsInSnapshots: true,
      ignoreUndefinedProperties: true 
    });
    
    console.log('Firebase Firestore initialized successfully in fallback mode');
  } catch (firestoreError) {
    console.error('Failed to initialize Firebase Firestore in fallback mode:', firestoreError);
    
    // Create empty db object as last resort
    db = {
      collection: () => {
        console.warn('[MOCK] Attempted to access Firestore collection without credentials');
        return {
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            set: async () => {},
            update: async () => {}
          })
        };
      }
    };
  }
}

// Export the Firebase services (either real or mock)
module.exports = { db, admin, storage, bucket };
