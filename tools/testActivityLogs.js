/**
 * Activity Logs API Test Script
 * 
 * Run with: node tools/testActivityLogs.js [endpoint]
 * 
 * Examples:
 *   node tools/testActivityLogs.js health
 *   node tools/testActivityLogs.js test
 *   node tools/testActivityLogs.js all
 *   node tools/testActivityLogs.js user/abc123
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:8383/logs';  // Updated to match new route pattern
const TOKEN_PATH = path.join(__dirname, 'auth_token.txt');

// Helper to read token from file
const getToken = () => {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    }
  } catch (err) {
    console.error('Error reading token file:', err.message);
  }
  return null;
};

// Helper to save token to file
const saveToken = (token) => {
  try {
    fs.writeFileSync(TOKEN_PATH, token);
    console.log('Token saved to', TOKEN_PATH);
  } catch (err) {
    console.error('Error saving token:', err.message);
  }
};

// Execute a test request
const testEndpoint = async (endpoint, token = null) => {
  try {
    console.log(`\n----- Testing ${endpoint || ''} -----`);
    
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log(`GET ${BASE_URL}/${endpoint}`);
    console.log('Headers:', headers);
    
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}/${endpoint}`, { headers });
    const duration = Date.now() - startTime;
    
    console.log(`Status: ${response.status} (${duration}ms)`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`Error testing ${endpoint}:`);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request error:', error.message);
    }
    
    return { success: false, error };
  }
};

// Main function
const main = async () => {
  const endpoint = process.argv[2] || '';
  let token = getToken();
  
  if (!token) {
    console.log('No authentication token found. Will test unauthenticated endpoints only.');
    console.log('To add a token, create a file at tools/auth_token.txt with your JWT token.');
  }
  
  if (endpoint === 'health') {
    await testEndpoint('health');
  } else if (endpoint === 'test') {
    await testEndpoint('test');
  } else if (token) {
    if (endpoint === 'all') {
      // Test multiple endpoints
      await testEndpoint('', token);
      await testEndpoint('action/create', token);
      await testEndpoint('resource/user', token);
      await testEndpoint('errors', token);
    } else {
      // Test the specific endpoint
      await testEndpoint(endpoint, token);
    }
  } else {
    console.log('Need authentication token to test this endpoint.');
    console.log('Please add a token to tools/auth_token.txt');
  }
};

main().catch(console.error);
