/**
 * Location Queue for Processing IP Lookups
 * 
 * This module handles asynchronous processing of IP-to-location lookups
 * using Bull queue to avoid blocking the main request/response cycle
 * and to handle rate limiting gracefully.
 */

const Queue = require('bull');
const { getLocationFromIp } = require('./locationService');
const { db } = require('./firebase');

// Create a Bull queue for location processing jobs
const locationQueue = new Queue('location-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

/**
 * Queue a job to look up location from IP and update the contact record
 * 
 * @param {string} userId - ID of the user whose contact list contains the contact
 * @param {number} contactIndex - Index of the contact in the contact list
 * @param {string} ipAddress - IP address to look up
 */
function queueLocationLookup(userId, contactIndex, ipAddress) {
  // Enqueue a job with retry logic
  locationQueue.add({
    userId,
    contactIndex,
    ipAddress
  }, {
    attempts: 3,             // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',   // Exponential backoff between retries
      delay: 2000            // Initial delay in ms
    },
    removeOnComplete: true   // Remove job when complete
  });
}

// Process jobs in the queue
locationQueue.process(async (job) => {
  const { userId, contactIndex, ipAddress } = job.data;
  
  try {
    console.log(`Processing location lookup for IP: ${ipAddress}`);
    
    // Skip if no IP address provided
    if (!ipAddress) {
      console.warn('No IP address provided for location lookup', { userId, contactIndex });
      return { success: false, reason: 'no_ip_address' };
    }
    
    // Get location data from IP
    const locationData = await getLocationFromIp(ipAddress);
    
    // If no location data could be determined, log and exit
    if (!locationData) {
      console.warn('Could not determine location from IP', { ipAddress, userId, contactIndex });
      return { success: false, reason: 'location_not_found' };
    }
    
    // Update the contact record with location data
    await updateContactWithLocation(userId, contactIndex, locationData);
    
    console.log(`Successfully added location data for contact at index ${contactIndex} for user ${userId}`);
    return { success: true, location: locationData };
  } catch (error) {
    console.error(`Failed to process location for user ${userId}, contact index ${contactIndex}:`, error);
    throw error; // This will trigger retry mechanism based on our configuration
  }
});

/**
 * Update a contact record with location data
 * 
 * @param {string} userId - ID of the user whose contact list contains the contact
 * @param {number} contactIndex - Index of the contact in the contact list
 * @param {Object} locationData - Location data to save
 */
async function updateContactWithLocation(userId, contactIndex, locationData) {
  try {
    // Get the contacts document
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    if (!doc.exists) {
      console.warn(`Contact document for user ${userId} not found`);
      return;
    }
    
    // Get the contact list
    const contactList = doc.data().contactList || [];
    
    // Check if the index is valid
    if (contactIndex < 0 || contactIndex >= contactList.length) {
      console.warn(`Invalid contact index: ${contactIndex}, list length: ${contactList.length}`);
      return;
    }
    
    // Add location data to the contact
    contactList[contactIndex].location = locationData;
    
    // Update the document
    await contactRef.update({
      contactList: contactList
    });
    
    console.log(`Updated contact at index ${contactIndex} with location data for user ${userId}`);
  } catch (error) {
    console.error('Error updating contact with location:', error);
    throw error;
  }
}

// Handle failed jobs
locationQueue.on('failed', (job, err) => {
  console.error(`Location job ${job.id} failed with error:`, err);
});

module.exports = {
  queueLocationLookup
}; 