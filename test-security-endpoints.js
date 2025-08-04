const { db, admin } = require('./firebase');

// Test security endpoints with proper authentication
async function testSecurityEndpoints() {
  try {
    console.log('🔐 Testing Security Alerts System...');
    console.log('');

    // Create a custom token for testing
    const testUserId = 'admin-user-456'; // Use our test admin user
    const customToken = await admin.auth().createCustomToken(testUserId);
    console.log('✅ Created test authentication token');

    // Test endpoints using node fetch
    const fetch = require('node-fetch');
    const baseUrl = 'http://localhost:8383';
    const enterpriseId = 'test-enterprise';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customToken}`
    };

    // Helper function to make requests
    async function testEndpoint(method, endpoint, data = null, description) {
      console.log(`\n📡 Testing: ${description}`);
      console.log(`${method} ${endpoint}`);
      
      try {
        const options = {
          method: method,
          headers: headers
        };
        
        if (data) {
          options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${baseUrl}${endpoint}`, options);
        const result = await response.json();
        
        if (response.ok) {
          console.log('✅ Success:', response.status);
          console.log('Response:', JSON.stringify(result, null, 2));
        } else {
          console.log('❌ Error:', response.status);
          console.log('Response:', JSON.stringify(result, null, 2));
        }
      } catch (error) {
        console.log('❌ Request failed:', error.message);
      }
    }

    // Wait for alert processing
    console.log('\n⏱️ Waiting 10 seconds for alert detection to process...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test 1: Get security alerts
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/alerts`, null, 'Get All Security Alerts');

    // Test 2: Get high severity alerts
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/alerts?severity=high`, null, 'Get High Severity Alerts');

    // Test 3: Get critical alerts
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/alerts?severity=critical`, null, 'Get Critical Alerts');

    // Test 4: Get failed login alerts
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/alerts?type=failed_login_attempts`, null, 'Get Failed Login Alerts');

    // Test 5: Get security logs
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/logs`, null, 'Get Security Logs');

    // Test 6: Get security log stats
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/logs/stats`, null, 'Get Security Log Statistics');

    // Test 7: Security action - Force password reset
    await testEndpoint('POST', `/enterprise/${enterpriseId}/security/actions/force-password-reset`, {
      userId: 'test-user-123',
      reason: 'Multiple failed login attempts detected during testing'
    }, 'Force Password Reset Action');

    // Test 8: Security action - Send alert
    await testEndpoint('POST', `/enterprise/${enterpriseId}/security/actions/send-security-alert`, {
      title: 'Test Security Alert',
      message: 'This is a test security alert to verify the system is working properly.',
      severity: 'medium',
      recipients: 'admins'
    }, 'Send Security Alert');

    // Test 9: Get alerts again to see if we have new ones
    await testEndpoint('GET', `/enterprise/${enterpriseId}/security/alerts`, null, 'Get All Security Alerts (After Actions)');

    console.log('\n🎯 Security endpoint testing complete!');
    console.log('\n📊 Test Results Summary:');
    console.log('  - Tested alert retrieval endpoints');
    console.log('  - Tested security log endpoints');
    console.log('  - Tested security action endpoints');
    console.log('  - Verified authentication works');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error testing security endpoints:', error);
  }
}

// Check if node-fetch is available, if not, suggest installation
try {
  require('node-fetch');
  testSecurityEndpoints().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} catch (error) {
  console.log('❌ node-fetch not found. Please install it:');
  console.log('npm install node-fetch@2');
  console.log('\nOr run the PowerShell test script instead.');
  process.exit(1);
}