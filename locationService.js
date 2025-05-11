/**
 * Location Service for IP-based Geolocation
 * 
 * This service provides functions to look up geographical locations based on IP addresses.
 * Primary services: ipapi.co and ip-api.com (free)
 * Final fallback: Google Maps Geocoding API (paid, reliable)
 */

const fetch = require('node-fetch');

// Simple in-memory cache for IP lookup results
const ipCache = new Map();

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get geographic location data from an IP address
 * 
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object>} - Location data including coordinates and region info
 */
async function getLocationFromIp(ip) {
  try {
    console.log(`[LocationService] Looking up IP: ${ip}`);
    
    // Remove any IPv6 prefix if present (API doesn't handle IPv6 well)
    const cleanIp = ip.replace(/^::ffff:/, '');
    console.log(`[LocationService] Cleaned IP: ${cleanIp}`);
    
    // Skip private/internal IPs
    if (isPrivateIp(cleanIp)) {
      console.log(`[LocationService] Skipping private IP: ${cleanIp}`);
      return null;
    }
    
    // Check if we have this IP in cache
    if (ipCache.has(cleanIp)) {
      console.log(`[LocationService] Using cached location data for IP: ${cleanIp}`);
      return ipCache.get(cleanIp);
    }
    
    // Strategy: Try free services first, then fallback to Google (paid) if needed
    
    // Try first free service (ipapi.co)
    try {
      const location = await getLocationFromIpApi1(cleanIp);
      if (location) {
        // Cache the result
        ipCache.set(cleanIp, location);
        return location;
      }
    } catch (error) {
      console.log(`[LocationService] Primary API failed, trying second free service: ${error.message}`);
    }
    
    // Try second free service (ip-api.com)
    try {
      const location = await getLocationFromIpApi2(cleanIp);
      if (location) {
        // Cache the result
        ipCache.set(cleanIp, location);
        return location;
      }
    } catch (error) {
      console.log(`[LocationService] Second free API failed, trying Google fallback: ${error.message}`);
    }
    
    // As a final reliable fallback, try Google Maps API (paid)
    try {
      const location = await getLocationFromGoogleMaps(cleanIp);
      if (location) {
        // Cache the result
        ipCache.set(cleanIp, location);
        return location;
      }
    } catch (error) {
      console.error(`[LocationService] Google fallback also failed: ${error.message}`);
    }
    
    // All services failed
    return null;
  } catch (error) {
    console.error(`[LocationService] Error looking up IP ${ip}:`, error);
    return null;
  }
}

/**
 * Get location from primary ipapi.co service (free)
 * 
 * @param {string} ip - IP address
 * @returns {Promise<Object>} - Location data
 */
async function getLocationFromIpApi1(ip) {
  console.log(`[LocationService] Fetching from ipapi.co for IP: ${ip}`);
  const response = await fetch(`https://ipapi.co/${ip}/json/`);
  console.log(`[LocationService] Response status: ${response.status}`);
  
  if (!response.ok) {
    throw new Error(`IP lookup failed with status ${response.status}`);
  }
  
  const data = await response.json();
  
  // Check for error response
  if (data.error) {
    throw new Error(`API error: ${data.reason}`);
  }
  
  // Return formatted location data
  const locationData = {
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.city,
    region: data.region,
    country: data.country_name,
    countryCode: data.country_code,
    timezone: data.timezone,
    provider: 'ipapi.co',
    createdAt: new Date()
  };
  
  console.log(`[LocationService] Successfully resolved location for IP ${ip} using ipapi.co`);
  return locationData;
}

/**
 * Get location from fallback ip-api.com service (free, higher rate limits)
 * 
 * @param {string} ip - IP address
 * @returns {Promise<Object>} - Location data
 */
async function getLocationFromIpApi2(ip) {
  console.log(`[LocationService] Fetching from ip-api.com for IP: ${ip}`);
  const response = await fetch(`http://ip-api.com/json/${ip}`);
  console.log(`[LocationService] Response status: ${response.status}`);
  
  if (!response.ok) {
    throw new Error(`IP lookup failed with status ${response.status}`);
  }
  
  const data = await response.json();
  
  // Check for error response
  if (data.status === 'fail') {
    throw new Error(`API error: ${data.message}`);
  }
  
  // Return formatted location data
  const locationData = {
    latitude: data.lat,
    longitude: data.lon,
    city: data.city,
    region: data.regionName,
    country: data.country,
    countryCode: data.countryCode,
    timezone: data.timezone,
    provider: 'ip-api.com',
    createdAt: new Date()
  };
  
  console.log(`[LocationService] Successfully resolved location for IP ${ip} using ip-api.com`);
  return locationData;
}

/**
 * Get location using Google Maps API (paid, highly reliable final fallback)
 * First converts IP to location using ip-api.com, then gets detailed info from Google
 * 
 * @param {string} ip - IP address
 * @returns {Promise<Object>} - Location data
 */
async function getLocationFromGoogleMaps(ip) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }
  
  console.log(`[LocationService] Using Google Maps fallback for IP: ${ip}`);
  
  // First try to get basic location data from a free service to minimize Google API usage
  try {
    // Use a direct third-party service that doesn't require API key for basic IP lookup
    const geoResponse = await fetch(`https://ip-api.com/json/${ip}?fields=lat,lon`);
    
    if (!geoResponse.ok) {
      throw new Error('Failed to get coordinates from IP');
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.lat || !geoData.lon) {
      throw new Error('Invalid coordinates from IP lookup');
    }
    
    // Now use Google Reverse Geocoding to get detailed location information
    // This gives us the most accurate and reliable data
    const coords = `${geoData.lat},${geoData.lon}`;
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords}&key=${GOOGLE_MAPS_API_KEY}`;
    
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
    
    // Return formatted location data in the same structure as other services
    const locationData = {
      latitude: geoData.lat,
      longitude: geoData.lon,
      city: city,
      region: region,
      country: country,
      countryCode: countryCode,
      timezone: null, // Google doesn't provide timezone info in this API
      provider: 'google',
      createdAt: new Date()
    };
    
    console.log(`[LocationService] Successfully resolved location for IP ${ip} using Google Maps`);
    return locationData;
  } catch (error) {
    console.error(`[LocationService] Error with Google Maps lookup: ${error.message}`);
    throw error;
  }
}

/**
 * Check if an IP address is private/internal
 * 
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if IP is private/internal
 */
function isPrivateIp(ip) {
  // Check for localhost
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
    return true;
  }
  
  // Check for private IPv4 ranges
  const privateRanges = [
    /^10\./,                     // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./               // 192.168.0.0 - 192.168.255.255
  ];
  
  return privateRanges.some(range => range.test(ip));
}

module.exports = {
  getLocationFromIp,
  // Export these for testing
  getLocationFromIpApi1,
  getLocationFromIpApi2,
  getLocationFromGoogleMaps
}; 