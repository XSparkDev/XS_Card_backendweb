/**
 * Location Queue for Processing IP Lookups
 * 
 * This module handles asynchronous processing of IP-to-location lookups
 * using Bull queue to avoid blocking the main request/response cycle
 * and to handle rate limiting gracefully.
 */

const Queue = require('bull');
const { getLocationFromIp } = require('./locationService');

// Create a Bull queue for location processing jobs
// In a real implementation, this would use the same Redis instance as your main app
const locationQueue = new Queue('location-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

/**
 * Queue a job to look up location from IP and update the contact record
 * 
 * @param {string} contactId - ID of the contact record to update
 * @param {string} ipAddress - IP address to look up
 */
function queueLocationLookup(contactId, ipAddress) {
  // Enqueue a job with retry logic
  locationQueue.add({
    contactId,
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
  const { contactId, ipAddress } = job.data;
  
  try {
    console.log(`Processing location lookup for IP: ${ipAddress}`);
    
    // Skip if no IP address provided
    if (!ipAddress) {
      console.warn('No IP address provided for location lookup', { contactId });
      return { success: false, reason: 'no_ip_address' };
    }
    
    // Get location data from IP
    const locationData = await getLocationFromIp(ipAddress);
    
    // If no location data could be determined, log and exit
    if (!locationData) {
      console.warn('Could not determine location from IP', { ipAddress, contactId });
      return { success: false, reason: 'location_not_found' };
    }
    
    // Update the contact record with location data
    // Note: In a real implementation, this would be replaced with your database update logic
    await updateContactWithLocation(contactId, locationData);
    
    console.log(`Successfully added location data for contact ${contactId}`);
    return { success: true, location: locationData };
  } catch (error) {
    console.error(`Failed to process location for contact ${contactId}:`, error);
    throw error; // This will trigger retry mechanism based on our configuration
  }
});

/**
 * Update a contact record with location data
 * 
 * Note: This is a placeholder. Replace with your actual database update logic.
 * 
 * @param {string} contactId - ID of the contact to update
 * @param {Object} locationData - Location data to save
 */
async function updateContactWithLocation(contactId, locationData) {
  // This is where you would update your database
  // Example using Mongoose (MongoDB):
  // await ContactModel.findByIdAndUpdate(contactId, { 
  //   $set: { 
  //     location: locationData 
  //   } 
  // });
  
  // For now, we'll just log the update
  console.log(`[MOCK] Updated contact ${contactId} with location data:`, locationData);
}

// Handle failed jobs
locationQueue.on('failed', (job, err) => {
  console.error(`Location job ${job.id} failed with error:`, err);
});

module.exports = {
  queueLocationLookup
}; 