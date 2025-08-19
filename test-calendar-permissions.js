/**
 * Test script for Calendar Permissions API endpoint
 * Tests the updateUserCalendarPermissions function with various scenarios
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8383';
const TEST_ENTERPRISE_ID = 'test-enterprise';
const TEST_USER_ID = 'user-001';

// You'll need to replace this with a valid Firebase token
const AUTH_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjU3YmZiMmExMWRkZmZjMGFkMmU2ODE0YzY4NzYzYjhjNjg3NTgxZDgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20veHNjYXJkLWFkZGQ0IiwiYXVkIjoieHNjYXJkLWFkZGQ0IiwiYXV0aF90aW1lIjoxNzU1NTA2MjgxLCJ1c2VyX2lkIjoieXk5cHJuVThzTVdzam9RVmFIaVpTUXJ3S0ZKMiIsInN1YiI6Inl5OXByblU4c01Xc2pvUVZhSGlaU1Fyd0tGSjIiLCJpYXQiOjE3NTU1MDYyODEsImV4cCI6MTc1NTUwOTg4MSwiZW1haWwiOiJoaWdlbmF3OTcyQGZ1cnNlZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJoaWdlbmF3OTcyQGZ1cnNlZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.T7bTDeLgNc_Uij4MF48tCRk6Ug7ekapjGLR_KeStv3T0wJnMfho1mxkZzopkRISVOqt75PK2zF4_wV1KxbRMAPGZg0Q8bIDEmGV7QzG_OloQu06iuJtV0jV5-hCQNFcvAXqLWt9n0C_isnGSK7rgCqr3uYA_ulfn4UBTlEtgz_DMnrfZhtE-irdt8YzeCJBN4x7n-F5D_D477WmbE4O8_4HPgaAtBHKpoY8-YerqPxjY-p4QMhgNZhZCmGKT0xLKmIsVBcabKONqsR16ozewF7h9jK0wgGjh119MNUhHDoWpUpL_XvYkjL0zyqaEEUGEvdtruckUtVeAjM7nFrlCRA';

/**
 * Test cases for calendar permissions
 */
const testCases = [
  {
    name: 'Valid permissions - Add viewCalendar and createMeetings',
    payload: {
      individualPermissions: {
        added: ['viewCalendar', 'createMeetings'],
        removed: []
      }
    },
    expectedStatus: 200,
    expectedSuccess: true
  },
  {
    name: 'Valid permissions - Remove manageAllMeetings',
    payload: {
      individualPermissions: {
        added: [],
        removed: ['manageAllMeetings']
      }
    },
    expectedStatus: 200,
    expectedSuccess: true
  },
  {
    name: 'Valid permissions - Mixed add and remove',
    payload: {
      individualPermissions: {
        added: ['viewCalendar'],
        removed: ['createMeetings', 'manageAllMeetings']
      }
    },
    expectedStatus: 200,
    expectedSuccess: true
  },
  {
    name: 'Invalid permissions - Invalid permission name',
    payload: {
      individualPermissions: {
        added: ['invalidPermission'],
        removed: []
      }
    },
    expectedStatus: 400,
    expectedSuccess: false
  },
  {
    name: 'Invalid payload - Missing individualPermissions',
    payload: {},
    expectedStatus: 400,
    expectedSuccess: false
  },
  {
    name: 'Invalid payload - Invalid structure',
    payload: {
      individualPermissions: {
        added: 'not-an-array',
        removed: []
      }
    },
    expectedStatus: 400,
    expectedSuccess: false
  },
  {
    name: 'Empty permissions arrays',
    payload: {
      individualPermissions: {
        added: [],
        removed: []
      }
    },
    expectedStatus: 200,
    expectedSuccess: true
  }
];

/**
 * Make API request
 */
async function makeRequest(payload) {
      try {
      const response = await axios.put(
        `${BASE_URL}/api/enterprise/${TEST_ENTERPRISE_ID}/users/${TEST_USER_ID}/calendar-permissions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        status: response.status,
        data: response.data,
        success: true
      };
    } catch (error) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: error.message },
        success: false
      };
    }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting Calendar Permissions API Tests...\n');
  console.log(`📡 Testing endpoint: PUT ${BASE_URL}/api/enterprise/${TEST_ENTERPRISE_ID}/users/${TEST_USER_ID}/calendar-permissions\n`);

  let passedTests = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`📋 Test ${i + 1}/${totalTests}: ${test.name}`);

    try {
      const result = await makeRequest(test.payload);
      
      // Check status code
      const statusMatch = result.status === test.expectedStatus;
      
      // Check success field
      const successMatch = test.expectedSuccess ? 
        (result.data.success === true) : 
        (result.data.success === false || result.success === false);

      const testPassed = statusMatch && successMatch;

      if (testPassed) {
        console.log(`✅ PASS`);
        console.log(`   Status: ${result.status} (expected: ${test.expectedStatus})`);
        console.log(`   Success: ${result.data.success || result.success} (expected: ${test.expectedSuccess})`);
        if (result.data.message) {
          console.log(`   Message: ${result.data.message}`);
        }
        passedTests++;
      } else {
        console.log(`❌ FAIL`);
        console.log(`   Status: ${result.status} (expected: ${test.expectedStatus})`);
        console.log(`   Success: ${result.data.success || result.success} (expected: ${test.expectedSuccess})`);
        console.log(`   Response:`, JSON.stringify(result.data, null, 2));
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Calendar permissions endpoint is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }

  return { passedTests, totalTests };
}

/**
 * Test authentication
 */
async function testAuthentication() {
  console.log('🔐 Testing authentication...\n');

      try {
      const response = await axios.put(
        `${BASE_URL}/api/enterprise/${TEST_ENTERPRISE_ID}/users/${TEST_USER_ID}/calendar-permissions`,
        {
          individualPermissions: {
            added: ['viewCalendar'],
            removed: []
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header
          }
        }
      );
      console.log('❌ Authentication test failed - should have returned 401');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Authentication test passed - correctly returned 401 for missing token');
      } else {
        console.log(`⚠️ Authentication test unclear - returned ${error.response?.status || 'unknown'}`);
      }
    }
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Calendar Permissions API Test Suite\n');
    console.log('📝 Setup Instructions:');
    console.log('1. Make sure your backend server is running on port 8383');
    console.log('2. Update AUTH_TOKEN with a valid Firebase token');
    console.log('3. Update TEST_ENTERPRISE_ID and TEST_USER_ID with valid IDs');
    console.log('4. Run: node test-calendar-permissions.js\n');

    // Test authentication first
    await testAuthentication();

    // Run main tests
    const results = await runTests();

    console.log('\n🛠️ Expected API Behavior:');
    console.log('✅ Valid calendar permissions: viewCalendar, createMeetings, manageAllMeetings');
    console.log('✅ Supports both adding and removing permissions');
    console.log('✅ Validates permission names');
    console.log('✅ Requires authentication');
    console.log('✅ Returns consistent response format');

    console.log('\n📋 Next Steps:');
    console.log('1. Frontend integration - uncomment calendar permission routing in api.ts');
    console.log('2. Enable permission modals in CalendarMain.tsx');
    console.log('3. Test full frontend flow');

    return results;

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Instructions
console.log(`
🔧 SETUP INSTRUCTIONS:
1. Update AUTH_TOKEN with a valid Firebase token from your test user
2. Update TEST_ENTERPRISE_ID and TEST_USER_ID with valid IDs from your database
3. Make sure your backend server is running on port 8383
4. Run: node test-calendar-permissions.js

📝 NOTE: This test requires a running backend server and valid authentication.
`);

// Run tests if this file is executed directly
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  runTests,
  testAuthentication
};
