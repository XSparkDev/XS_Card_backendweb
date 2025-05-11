/**
 * Location Service Testing for Contact Addition Flow
 * 
 * This file provides endpoints to test the location service specifically
 * in the context of adding contacts, which is when it's actually used.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { 
  getLocationFromIp,
  getLocationFromIpApi1,
  getLocationFromIpApi2,
  getLocationFromGoogleMaps
} = require('../locationService');
const { queueLocationLookup } = require('../locationQueue');

// Test adding a contact with location tracking (normal operation)
router.post('/add-contact', async (req, res) => {
  try {
    const { userId, name, surname, email, phone, howWeMet, ipAddress } = req.body;
    
    if (!userId || !name || !surname || !ipAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields. Provide userId, name, surname, and ipAddress' 
      });
    }
    
    console.log(`[TEST] Adding contact for user ${userId} with IP ${ipAddress}`);
    
    // First get location data for the IP
    console.log(`[TEST] Looking up location for IP: ${ipAddress}`);
    const locationData = await getLocationFromIp(ipAddress);
    
    // Create a test contact
    const contactInfo = {
      name,
      surname,
      email: email || '',
      phone: phone || '',
      howWeMet: howWeMet || 'Test contact',
      testContact: true
    };
    
    // Get existing contacts
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    let contactList = [];
    if (doc.exists) {
      contactList = doc.data().contactList || [];
    }
    
    // Add the new contact
    contactList.push({
      ...contactInfo,
      createdAt: new Date()
    });
    
    const contactIndex = contactList.length - 1;
    
    // Add location data directly
    if (locationData) {
      contactList[contactIndex].location = locationData;
      console.log(`[TEST] Added location data to contact:`, locationData);
    } else {
      console.log(`[TEST] No location data found for IP: ${ipAddress}`);
    }
    
    // Update the contact document
    await contactRef.set({
      userId: userId,
      contactList: contactList
    }, { merge: true });
    
    res.json({
      success: true,
      scenario: 'normal contact addition with location',
      contactIndex,
      locationData,
      contact: contactList[contactIndex]
    });
  } catch (error) {
    console.error(`[TEST] Error in test contact addition:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test adding a contact with the queue-based approach (mimics real flow)
router.post('/add-contact/queued', async (req, res) => {
  try {
    const { userId, name, surname, email, phone, howWeMet, ipAddress } = req.body;
    
    if (!userId || !name || !surname || !ipAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields. Provide userId, name, surname, and ipAddress' 
      });
    }
    
    console.log(`[TEST] Adding queued contact for user ${userId} with IP ${ipAddress}`);
    
    // Create a test contact
    const contactInfo = {
      name,
      surname,
      email: email || '',
      phone: phone || '',
      howWeMet: howWeMet || 'Test contact with queue',
      testContact: true
    };
    
    // Get existing contacts
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    let contactList = [];
    if (doc.exists) {
      contactList = doc.data().contactList || [];
    }
    
    // Add the new contact
    contactList.push({
      ...contactInfo,
      createdAt: new Date()
    });
    
    const contactIndex = contactList.length - 1;
    
    // Update the contact document
    await contactRef.set({
      userId: userId,
      contactList: contactList
    }, { merge: true });
    
    // Queue the location lookup (this is how it works in the real app)
    queueLocationLookup(userId, contactIndex, ipAddress);
    
    res.json({
      success: true,
      scenario: 'contact addition with queued location lookup',
      message: 'Contact added and location lookup queued',
      contactIndex,
      notes: 'Location will be processed asynchronously. Check Firebase after a few seconds to see the updated contact.'
    });
  } catch (error) {
    console.error(`[TEST] Error in test queued contact addition:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test with modified location services to test fallback scenarios
router.post('/add-contact/fallback-test', async (req, res) => {
  try {
    const { userId, name, surname, ipAddress, scenario } = req.body;
    
    if (!userId || !name || !surname || !ipAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields. Provide userId, name, surname, and ipAddress' 
      });
    }
    
    if (!scenario) {
      return res.status(400).json({
        error: 'Scenario required. Use: ipapi-fails, ipapi-and-ipapi2-fail, google-fails, all-fail'
      });
    }
    
    console.log(`[TEST] Testing ${scenario} scenario for contact addition with IP ${ipAddress}`);
    
    // Create a test contact
    const contactInfo = {
      name,
      surname,
      howWeMet: `Test contact for ${scenario} scenario`,
      testContact: true
    };
    
    // Get existing contacts
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    let contactList = [];
    if (doc.exists) {
      contactList = doc.data().contactList || [];
    }
    
    // Add the new contact
    contactList.push({
      ...contactInfo,
      createdAt: new Date()
    });
    
    const contactIndex = contactList.length - 1;
    
    // Perform a custom location lookup based on scenario
    let locationData = null;
    let providerUsed = null;
    let errorDetails = null;
    
    try {
      if (scenario === 'ipapi-fails') {
        // Try primary service (which will fail due to invalid format)
        console.log(`[TEST] Simulating ipapi.co failure, should use ip-api.com fallback`);
        try {
          await getLocationFromIpApi1('invalid.ip');
        } catch (error) {
          console.log(`[TEST] Expected error from ipapi.co: ${error.message}`);
        }
        
        // Use second service directly
        locationData = await getLocationFromIpApi2(ipAddress);
        providerUsed = 'ip-api.com';
      } 
      else if (scenario === 'ipapi-and-ipapi2-fail') {
        // Both free services fail, should use Google
        console.log(`[TEST] Simulating both free services failing, should use Google Maps`);
        try {
          await getLocationFromIpApi1('invalid.ip');
        } catch (error) {
          console.log(`[TEST] Expected error from ipapi.co: ${error.message}`);
        }
        
        try {
          await getLocationFromIpApi2('invalid.ip');
        } catch (error) {
          console.log(`[TEST] Expected error from ip-api.com: ${error.message}`);
        }
        
        // Use Google directly with proper error catching
        try {
          console.log(`[TEST] Attempting to use Google Maps API with IP ${ipAddress}`);
          
          // Check if Google Maps function exists
          if (typeof getLocationFromGoogleMaps !== 'function') {
            throw new Error('getLocationFromGoogleMaps is not a function');
          }
          
          // Check for Google API key (without exposing it)
          const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
          if (!googleApiKey) {
            throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set');
          }
          
          // Call Google Maps API
          locationData = await getLocationFromGoogleMaps(ipAddress);
          
          if (!locationData) {
            throw new Error('Google Maps API returned null result');
          }
          
          providerUsed = 'Google Maps';
          console.log(`[TEST] Successfully got location from Google Maps:`, locationData);
        } catch (error) {
          console.error(`[TEST] Google Maps API error: ${error.message}`);
          errorDetails = {
            message: error.message,
            stack: error.stack
          };
          
          // For testing purposes, create minimal location data
          // so we can see if the contact update works
          locationData = null;
        }
      }
      else if (scenario === 'google-fails') {
        // Google fails but free services work
        console.log(`[TEST] Simulating Google Maps failure, should still use primary services`);
        try {
          await getLocationFromGoogleMaps('invalid.ip');
        } catch (error) {
          console.log(`[TEST] Expected error from Google Maps: ${error.message}`);
        }
        
        // Try the normal chain which should still work
        locationData = await getLocationFromIp(ipAddress);
        providerUsed = 'ipapi.co or ip-api.com';
      }
      else if (scenario === 'all-fail') {
        // All services fail
        console.log(`[TEST] Simulating all services failing`);
        
        // This will attempt all services and should return null
        locationData = await getLocationFromIp('invalid.ip.address');
        providerUsed = 'none - all failed';
      }
      else {
        return res.status(400).json({
          error: 'Invalid scenario. Use: ipapi-fails, ipapi-and-ipapi2-fail, google-fails, all-fail'
        });
      }
    } catch (error) {
      console.log(`[TEST] Error in location lookup: ${error.message}`);
      errorDetails = {
        message: error.message,
        stack: error.stack
      };
    }
    
    // Add location data if found
    if (locationData) {
      contactList[contactIndex].location = locationData;
      console.log(`[TEST] Added location data to contact from ${providerUsed}:`, locationData);
    } else {
      console.log(`[TEST] No location data found for scenario: ${scenario}`);
    }
    
    // Update the contact document
    await contactRef.set({
      userId: userId,
      contactList: contactList
    }, { merge: true });
    
    res.json({
      success: true,
      scenario: scenario,
      contactIndex,
      locationFound: !!locationData,
      providerUsed,
      locationData,
      contact: contactList[contactIndex],
      errorDetails
    });
  } catch (error) {
    console.error(`[TEST] Error in fallback test:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Direct test for Google Maps API in isolation
router.get('/google-test', async (req, res) => {
  try {
    const { ip } = req.query;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address required as query parameter' });
    }
    
    // Check API key
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        error: 'GOOGLE_MAPS_API_KEY environment variable is not set', 
        instructions: 'Add GOOGLE_MAPS_API_KEY to your .env file with a valid Google Maps API key'
      });
    }
    
    console.log(`[TEST] Testing Google Maps API directly with IP: ${ip}`);
    
    try {
      const result = await getLocationFromGoogleMaps(ip);
      res.json({
        success: !!result,
        result,
        apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
        apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
        apiKeyPreview: process.env.GOOGLE_MAPS_API_KEY ? `${process.env.GOOGLE_MAPS_API_KEY.substring(0, 3)}...` : null
      });
    }
  } catch (error) {
    console.error(`[TEST] Error in Google Maps API test:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get contact's location data for verification
router.get('/check-contact', async (req, res) => {
  try {
    const { userId, contactIndex } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (contactIndex === undefined) {
      return res.status(400).json({ error: 'Contact index is required' });
    }
    
    console.log(`[TEST] Checking contact location for user ${userId}, contact index ${contactIndex}`);
    
    // Get the contact from Firebase
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'User contacts not found' });
    }
    
    const contactList = doc.data().contactList || [];
    
    if (contactIndex >= contactList.length) {
      return res.status(404).json({ error: 'Contact not found at specified index' });
    }
    
    const contact = contactList[contactIndex];
    
    res.json({
      success: true,
      contact,
      hasLocation: !!contact.location,
      location: contact.location || null
    });
  } catch (error) {
    console.error(`[TEST] Error checking contact:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Direct test for initial coordinates lookup which is failing
router.get('/google-coords-test', async (req, res) => {
  try {
    const { ip } = req.query;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address required as query parameter' });
    }
    
    console.log(`[TEST] Testing initial coordinates lookup for IP: ${ip}`);
    
    try {
      // This is replicating what happens inside getLocationFromGoogleMaps
      // to diagnose the "Failed to get coordinates from IP" error
      const fetch = require('node-fetch');
      
      // Try to get just lat/lon from ip-api.com (which is what the Google function does)
      const geoResponse = await fetch(`https://ip-api.com/json/${ip}?fields=lat,lon`);
      
      if (!geoResponse.ok) {
        return res.status(500).json({
          success: false,
          error: `Initial coordinate lookup failed with status ${geoResponse.status}`,
          message: 'This explains the "Failed to get coordinates from IP" error'
        });
      }
      
      const geoData = await geoResponse.json();
      
      if (!geoData.lat || !geoData.lon) {
        return res.status(500).json({
          success: false,
          error: 'Coordinate lookup returned invalid data',
          data: geoData,
          message: 'The lat/lon fields are missing in the response'
        });
      }
      
      // If we got here, we have coordinates, so we can test the Google Maps part
      // Only if the API key is configured
      let googleResult = null;
      
      if (process.env.GOOGLE_MAPS_API_KEY) {
        const coords = `${geoData.lat},${geoData.lon}`;
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        console.log(`[TEST] Testing Google Geocoding with coordinates: ${coords}`);
        const googleResponse = await fetch(googleUrl);
        
        if (!googleResponse.ok) {
          return res.status(500).json({
            success: false,
            error: `Google geocoding failed with status ${googleResponse.status}`,
            initialCoordinates: {
              latitude: geoData.lat,
              longitude: geoData.lon
            }
          });
        }
        
        googleResult = await googleResponse.json();
        
        if (googleResult.status !== 'OK' || !googleResult.results || googleResult.results.length === 0) {
          return res.status(500).json({
            success: false,
            error: `Google geocoding error: ${googleResult.status || 'No results'}`,
            initialCoordinates: {
              latitude: geoData.lat,
              longitude: geoData.lon
            },
            googleResponse: googleResult
          });
        }
      }
      
      // Success - return the coordinates and Google result if available
      res.json({
        success: true,
        initialCoordinates: {
          latitude: geoData.lat,
          longitude: geoData.lon
        },
        googleResult: googleResult ? {
          status: googleResult.status,
          resultCount: googleResult.results.length,
          firstResult: googleResult.results[0]
        } : 'Google API key not configured'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
        tip: 'This error is happening in the first step of the Google Maps location function'
      });
    }
  } catch (error) {
    console.error(`[TEST] Error in coordinate lookup test:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Google Maps directly without requiring initial IP coordinates
router.post('/add-contact/google-direct', async (req, res) => {
  try {
    const { userId, name, surname, ipAddress, latitude, longitude } = req.body;
    
    if (!userId || !name || !surname) {
      return res.status(400).json({ 
        error: 'Missing required fields. Provide userId, name, and surname' 
      });
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Must provide latitude and longitude coordinates'
      });
    }
    
    // Check for Google API key
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        error: 'GOOGLE_MAPS_API_KEY environment variable is not set',
        instructions: 'Add GOOGLE_MAPS_API_KEY to your .env file'
      });
    }
    
    console.log(`[TEST] Testing Google Maps with provided coordinates: ${latitude},${longitude}`);
    
    // Create a test contact
    const contactInfo = {
      name,
      surname,
      howWeMet: `Google Direct Test`,
      testContact: true
    };
    
    // Get existing contacts
    const contactRef = db.collection('contacts').doc(userId);
    const doc = await contactRef.get();
    
    let contactList = [];
    if (doc.exists) {
      contactList = doc.data().contactList || [];
    }
    
    // Add the new contact
    contactList.push({
      ...contactInfo,
      createdAt: new Date()
    });
    
    const contactIndex = contactList.length - 1;
    
    // Custom implementation of Google Maps geocoding without requiring IP-to-coordinates first
    let locationData = null;
    let error = null;
    
    try {
      const fetch = require('node-fetch');
      const coords = `${latitude},${longitude}`;
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
      console.log(`[TEST] Calling Google Geocoding API with coords: ${coords}`);
      const googleResponse = await fetch(googleUrl);
      
      if (!googleResponse.ok) {
        throw new Error(`Google geocoding failed with status ${googleResponse.status}`);
      }
      
      const googleData = await googleResponse.json();
      
      if (googleData.status !== 'OK' || !googleData.results || googleData.results.length === 0) {
        throw new Error(`Google geocoding error: ${googleData.status || 'No results'}`);
      }
      
      // Extract needed information from Google's response
      const result = googleData.results[0];
      const addressComponents = result.address_components || [];
      
      // Initialize with defaults
      let city = '';
      let region = '';
      let country = '';
      let countryCode = '';
      
      // Extract address components from Google result
      for (const component of addressComponents) {
        const types = component.types || [];
        
        if (types.includes('locality')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          region = component.long_name;
        } else if (types.includes('country')) {
          country = component.long_name;
          countryCode = component.short_name;
        }
      }
      
      // Create location data in the standard format
      locationData = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        city: city,
        region: region,
        country: country,
        countryCode: countryCode,
        timezone: null, // Google doesn't provide timezone info in this API
        provider: 'google-direct',
        createdAt: new Date()
      };
      
      console.log(`[TEST] Successfully processed location data from Google Maps`);
    } catch (err) {
      console.error(`[TEST] Google Maps API error: ${err.message}`);
      error = err;
    }
    
    // Add location data if found
    if (locationData) {
      contactList[contactIndex].location = locationData;
      console.log(`[TEST] Added location data to contact from Google Maps:`, locationData);
    } else {
      console.log(`[TEST] No location data obtained from Google Maps`);
    }
    
    // Update the contact document
    await contactRef.set({
      userId: userId,
      contactList: contactList
    }, { merge: true });
    
    res.json({
      success: !!locationData,
      contactIndex,
      locationFound: !!locationData,
      locationData,
      contact: contactList[contactIndex],
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null
    });
  } catch (error) {
    console.error(`[TEST] Error in Google direct test:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router; 