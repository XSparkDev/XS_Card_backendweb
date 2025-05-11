/**
 * Contact Middleware for IP Capture
 * 
 * This file contains middleware functions to be applied to the AddContact endpoint
 * to capture IP addresses and enrich contact data.
 */

const { queueLocationLookup } = require('./locationQueue');

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
  
  // Add metadata to the request body
  req.body = {
    ...originalBody,
    _metadata: {
      ipAddress: clientIp,
      timestamp: new Date(),
      userAgent: req.headers['user-agent']
    }
  };
  
  // Continue to the next middleware
  next();
}

/**
 * Middleware to handle contact creation post-processing
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function processContactLocation(req, res, originalRes) {
  // Extract the contact ID and IP address
  const contactId = req.contactId; // Assumes the main handler sets contactId
  const ipAddress = req.body?._metadata?.ipAddress;
  
  // Queue a job to process location data asynchronously
  if (contactId && ipAddress) {
    queueLocationLookup(contactId, ipAddress);
    console.log(`Queued location lookup for contact ${contactId}`);
  }
  
  // Return the original response
  return originalRes;
}

module.exports = {
  enrichContactWithIp,
  processContactLocation
}; 