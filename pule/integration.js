/**
 * Example Integration for XS Card Location Analytics
 * 
 * This file demonstrates how to incorporate the location tracking
 * and analytics features into an existing Express application.
 */

const express = require('express');
const { enrichContactWithIp, processContactLocation } = require('./contactMiddleware');
const locationEndpoints = require('./locationEndpoint');

/**
 * Apply location tracking features to an existing Express app
 * 
 * @param {Object} app - Express application instance
 */
function applyLocationTracking(app) {
  // 1. Register the location analytics API endpoints
  app.use('/api', locationEndpoints);
  
  // 2. Apply middleware to the AddContact endpoint to capture IP addresses
  // Find the existing route definition
  const routes = app._router.stack;
  
  // Look for the AddContact route
  let addContactRoute = null;
  for (const layer of routes) {
    if (layer.route && layer.route.path === '/AddContact') {
      addContactRoute = layer.route;
      break;
    }
  }
  
  // If we didn't find the route, log a warning
  if (!addContactRoute) {
    console.warn('Could not find /AddContact route to apply IP tracking middleware');
    
    // Provide instructions for manual integration
    console.info('Please apply the middleware manually:');
    console.info('app.post("/AddContact", enrichContactWithIp, yourExistingHandler);');
    
    return;
  }
  
  // Get the existing handler
  const existingHandlers = addContactRoute.stack.map(layer => layer.handle);
  
  // Clear existing handlers
  addContactRoute.stack = [];
  
  // Add the IP enrichment middleware
  addContactRoute.stack.push({ handle: enrichContactWithIp, method: 'post' });
  
  // Add a wrapper for the last handler to process locations after response
  const lastHandlerIndex = existingHandlers.length - 1;
  const lastHandler = existingHandlers[lastHandlerIndex];
  
  // Create a wrapper that calls the original handler but also processes location
  const wrappedHandler = async (req, res) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to capture the contactId before sending response
    res.json = function(data) {
      // Extract contactId from response if available
      if (data && data.contactId) {
        req.contactId = data.contactId;
      }
      
      // Process location data
      processContactLocation(req, res);
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    // Call the original handler
    return lastHandler(req, res);
  };
  
  // Add the original handlers except the last one
  for (let i = 0; i < lastHandlerIndex; i++) {
    addContactRoute.stack.push({ handle: existingHandlers[i], method: 'post' });
  }
  
  // Add the wrapped last handler
  addContactRoute.stack.push({ handle: wrappedHandler, method: 'post' });
  
  console.log('Successfully applied location tracking middleware to /AddContact endpoint');
}

/**
 * Alternative: Manual route replacement
 * 
 * Use this if the automatic route modification doesn't work
 * 
 * @param {Object} app - Express application instance
 * @param {Function} existingHandler - Your existing AddContact handler
 */
function manuallyApplyLocationTracking(app, existingHandler) {
  // Redefine the AddContact route with our middleware
  app.post('/AddContact', enrichContactWithIp, async (req, res) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to capture the contactId
    res.json = function(data) {
      // Extract contactId from response if available
      if (data && data.contactId) {
        req.contactId = data.contactId;
      }
      
      // Process location
      processContactLocation(req, res);
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    // Call the original handler
    return existingHandler(req, res);
  });
}

module.exports = {
  applyLocationTracking,
  manuallyApplyLocationTracking
}; 