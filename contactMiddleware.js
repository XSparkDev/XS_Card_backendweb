/**
 * Contact Middleware for IP Capture
 * 
 * This file contains middleware functions to be applied to the AddContact endpoint
 * to capture IP addresses and enrich contact data.
 */

const { queueLocationLookup } = require('./locationQueue');
const { getLocationFromIp } = require('./locationService');
const { db } = require('./firebase');

// Flag to use direct processing instead of queue (for environments without Redis)
const USE_DIRECT_PROCESSING = true;

/**
 * Extract IP address from request
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} - Client IP address or null if not available
 */
function getClientIp(req) {
  // Check various headers for forwarded IPs (for clients behind proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Use the first IP in the list (the original client)
    return forwarded.split(',')[0].trim();
  }
  
  // Fall back to direct connection IP
  return req.connection.remoteAddress || null;
}

/**
 * Middleware to enrich contact creation with IP address
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function enrichContactWithIp(req, res, next) {
  // Store the original payload
  const originalBody = { ...req.body };
  
  // Get client IP address
  const clientIp = getClientIp(req);
  console.log(`[ContactMiddleware] Captured IP address: ${clientIp}`);
  
  // Add metadata to the request for later use
  req._locationMetadata = {
    ipAddress: clientIp,
    timestamp: new Date(),
    userAgent: req.headers['user-agent']
  };
  
  // Continue to the next middleware
  next();
}

/**
 * Process contact location after response is sent
 * 
 * @param {Object} req - Express request object with userId and contactIndex
 */
function processContactLocation(userId, contactIndex, ipAddress) {
  console.log(`[ContactMiddleware] Processing location for user ${userId}, contact index ${contactIndex}`);
  
  if (!userId || typeof contactIndex !== 'number' || !ipAddress) {
    console.warn(`[ContactMiddleware] Missing required data for location processing:`, {
      userId, contactIndex, ipAddress
    });
    return false;
  }
  
  if (USE_DIRECT_PROCESSING) {
    // Process directly for testing/development environments without Redis
    processLocationDirectly(userId, contactIndex, ipAddress);
    return true;
  } else {
    // Use Bull queue for production
    queueLocationLookup(userId, contactIndex, ipAddress);
    console.log(`[ContactMiddleware] Queued location lookup for user ${userId}, contact index ${contactIndex}`);
    return true;
  }
}

/**
 * Process location directly without using a queue (for environments without Redis)
 * 
 * @param {string} userId - User ID
 * @param {number} contactIndex - Contact index
 * @param {string} ipAddress - IP address
 */
async function processLocationDirectly(userId, contactIndex, ipAddress) {
  console.log(`[ContactMiddleware] Direct processing for user ${userId}, contact index ${contactIndex}, IP ${ipAddress}`);
  
  try {
    // Get location data from IP
    const locationData = await getLocationFromIp(ipAddress);
    
    // If no location data could be determined, log and exit
    if (!locationData) {
      console.warn(`[ContactMiddleware] Could not determine location from IP`, { ipAddress, userId, contactIndex });
      return;
    }
    
    // Update contact with location data
    await updateContactWithLocation(userId, contactIndex, locationData);
    
    console.log(`[ContactMiddleware] Successfully added location data for contact at index ${contactIndex} for user ${userId}`);
  } catch (error) {
    console.error(`[ContactMiddleware] Error processing location:`, error);
  }
}

/**
 * Update a contact record with location data
 * 
 * @param {string} userId - ID of the user whose contact list contains the contact
 * @param {number} contactIndex - Index of the contact in the contact list
 * @param {Object} locationData - Location data to save
 */
async function updateContactWithLocation(userId, contactIndex, locationData) {
  try {
    console.log(`[ContactMiddleware] Updating contact with location data:`, { userId, contactIndex });
    
    // Get the contacts document
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    if (!doc.exists) {
      console.warn(`[ContactMiddleware] Contact document for user ${userId} not found`);
      return;
    }
    
    // Get the contact list
    const contactList = doc.data().contactList || [];
    
    // Check if the index is valid
    if (contactIndex < 0 || contactIndex >= contactList.length) {
      console.warn(`[ContactMiddleware] Invalid contact index: ${contactIndex}, list length: ${contactList.length}`);
      return;
    }
    
    // Add location data to the contact
    contactList[contactIndex].location = locationData;
    
    console.log(`[ContactMiddleware] Location data to be saved:`, locationData);
    
    // Update the document
    await contactRef.update({
      contactList: contactList
    });
    
    console.log(`[ContactMiddleware] Updated contact at index ${contactIndex} with location data for user ${userId}`);
  } catch (error) {
    console.error(`[ContactMiddleware] Error updating contact with location:`, error);
    throw error;
  }
}

module.exports = {
  enrichContactWithIp,
  processContactLocation,
  getClientIp
}; 