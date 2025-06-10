/**
 * Location Analytics Routes
 * 
 * This file provides Express routes for retrieving
 * geographic connection data for heatmap visualization.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { authenticateUser } = require('../middleware/auth');

/**
 * GET /api/analytics/locations
 * 
 * Retrieves aggregated location data for connections
 * Can be filtered by date range
 */
router.get('/analytics/locations', authenticateUser, async (req, res) => {
  try {
    console.log('[LocationRoutes] Analytics request received');
    
    // Get query parameters
    const { startDate, endDate } = req.query;
    const userId = req.user.uid;
    
    console.log(`[LocationRoutes] Fetching data for user: ${userId}`);
    
    // Get the contacts document
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    if (!doc.exists) {
      console.log(`[LocationRoutes] No contacts found for user: ${userId}`);
      return res.status(404).json({ error: 'No contacts found' });
    }
    
    // Get contacts with location data
    const contactList = doc.data().contactList || [];
    console.log(`[LocationRoutes] Total contacts found: ${contactList.length}`);
    
    // Filter to only contacts with location data
    let contactsWithLocation = contactList.filter(contact => contact.location);
    console.log(`[LocationRoutes] Contacts with location data: ${contactsWithLocation.length}`);
    
    // If no location data found, return empty result
    if (contactsWithLocation.length === 0) {
      console.log(`[LocationRoutes] No location data found for user: ${userId}`);
      return res.json([]);
    }
    
    // Apply date filtering if provided
    if (startDate && endDate) {
      console.log(`[LocationRoutes] Applying date filter: ${startDate} to ${endDate}`);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      contactsWithLocation = contactsWithLocation.filter(contact => {
        if (!contact.createdAt) return false;
        
        const contactDate = contact.createdAt.toDate ? 
          contact.createdAt.toDate() : 
          new Date(contact.createdAt);
          
        return contactDate >= start && contactDate <= end;
      });
      
      console.log(`[LocationRoutes] Contacts after date filtering: ${contactsWithLocation.length}`);
    }
    
    // Aggregate data for the heatmap
    const locationData = aggregateLocationData(contactsWithLocation);
    console.log(`[LocationRoutes] Aggregated to ${locationData.length} unique locations`);
    
    res.json(locationData);
  } catch (error) {
    console.error('[LocationRoutes] Error fetching location analytics:', error);
    res.status(500).json({ error: 'Failed to fetch location data', details: error.message });
  }
});

/**
 * Aggregate location data for heatmap visualization
 * 
 * @param {Array} contacts - Contacts with location data
 * @returns {Array} - Aggregated location data
 */
function aggregateLocationData(contacts) {
  // Create a map to store the aggregated data
  const locationMap = new Map();
  
  // Aggregate contacts by location
  contacts.forEach(contact => {
    if (!contact.location) return;
    
    try {
      const { latitude, longitude, city, country } = contact.location;
      
      // Skip if missing coordinates
      if (!latitude || !longitude) {
        console.warn('[LocationRoutes] Skipping contact with missing coordinates:', contact.location);
        return;
      }
      
      const key = `${latitude},${longitude}`;
      
      if (locationMap.has(key)) {
        locationMap.get(key).connectionCount++;
      } else {
        const locationName = city && country ? 
          `${city}, ${country}` : 
          city || country || 'Unknown Location';
          
        locationMap.set(key, {
          latitude,
          longitude,
          locationName,
          connectionCount: 1
        });
      }
    } catch (error) {
      console.error('[LocationRoutes] Error processing contact location:', error);
    }
  });
  
  // Convert the map to an array
  return Array.from(locationMap.values());
}

module.exports = router; 