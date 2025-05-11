/**
 * Location Service for IP-based Geolocation
 * 
 * This service provides functions to look up geographical locations based on IP addresses.
 * It uses ipapi.co as the geolocation service but can be easily modified to use alternatives.
 */

const fetch = require('node-fetch');

/**
 * Get geographic location data from an IP address
 * 
 * @param {string} ip - IP address to look up
 * @returns {Promise<Object>} - Location data including coordinates and region info
 */
async function getLocationFromIp(ip) {
  try {
    // Remove any IPv6 prefix if present (ipapi doesn't handle IPv6 well)
    const cleanIp = ip.replace(/^::ffff:/, '');
    
    // Skip private/internal IPs
    if (isPrivateIp(cleanIp)) {
      return null;
    }
    
    // Call the ipapi.co service (free tier)
    const response = await fetch(`https://ipapi.co/${cleanIp}/json/`);
    
    if (!response.ok) {
      throw new Error(`IP lookup failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for error response
    if (data.error) {
      console.warn(`IP lookup error: ${data.reason}`, { ip: cleanIp });
      return null;
    }
    
    // Return formatted location data
    return {
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
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return null;
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
  getLocationFromIp
}; 