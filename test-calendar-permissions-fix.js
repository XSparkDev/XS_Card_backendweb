/**
 * Test Calendar Permissions Fix
 * 
 * This script tests that calendar permissions are now included in employee fetch responses
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8383';
const TEST_ENTERPRISE_ID = 'x-spark-test';
const TEST_USER_ID = 'test-user-calendar';

async function testCalendarPermissionsFix() {
    console.log('🧪 Testing Calendar Permissions Fix\n');
    
    try {
        // 1. First, set some calendar permissions
        console.log('1️⃣ Setting calendar permissions...');
        const setPermissionsResponse = await axios.put(
            `${BASE_URL}/api/enterprise/${TEST_ENTERPRISE_ID}/users/${TEST_USER_ID}/calendar-permissions`,
            {
                individualPermissions: {
                    added: ['viewCalendar', 'createMeetings'],
                    removed: ['manageAllMeetings']
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Calendar permissions set successfully');
        console.log('Response:', JSON.stringify(setPermissionsResponse.data, null, 2));
        console.log('');
        
        // 2. Now fetch employees and check if calendar permissions are included
        console.log('2️⃣ Fetching employees to check if calendar permissions are included...');
        const getEmployeesResponse = await axios.get(
            `${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/employees`,
            {
                headers: {
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Employees fetched successfully');
        
        // 3. Check if our test user has calendar permissions in the response
        const employees = getEmployeesResponse.data.employees || [];
        const testEmployee = employees.find(emp => emp.id === TEST_USER_ID);
        
        if (testEmployee) {
            console.log('✅ Test employee found in response');
            console.log('Employee data:', JSON.stringify(testEmployee, null, 2));
            
            if (testEmployee.calendarPermissions) {
                console.log('✅ CALENDAR PERMISSIONS FIX WORKING!');
                console.log('calendarPermissions field is present:', testEmployee.calendarPermissions);
            } else {
                console.log('❌ CALENDAR PERMISSIONS FIX FAILED!');
                console.log('calendarPermissions field is missing');
            }
        } else {
            console.log('⚠️ Test employee not found in response');
            console.log('Available employees:', employees.map(emp => ({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` })));
        }
        
        console.log('\n🎯 Test Summary:');
        console.log('✅ Calendar permissions endpoint working');
        console.log('✅ Employee fetch endpoint working');
        console.log(testEmployee?.calendarPermissions ? '✅ Calendar permissions included in response' : '❌ Calendar permissions missing from response');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 Note: If you get 404 errors, make sure:');
            console.log('   • The server is running on port 8383');
            console.log('   • The test enterprise and user exist');
            console.log('   • You have valid authentication');
        }
    }
}

// Run the test
testCalendarPermissionsFix()
    .then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
