/**
 * Test Role Management with Curl
 * 
 * This script tests the role management implementation using curl commands
 * with the provided user credentials
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8383';
const TEST_ENTERPRISE_ID = 'x-spark-test';
const TEST_DEPARTMENT_ID = 'marketing';

// User credentials
const USERS = {
    admin: {
        email: "xenacoh740@percyfx.com",
        password: "Password.10"
    },
    emp1: {
        email: "higenaw972@fursee.com", 
        password: "Password.10"
    }
};

async function loginUser(userType) {
    console.log(`🔐 Logging in as ${userType}...`);
    
    try {
        const response = await axios.post(`${BASE_URL}/SignIn`, {
            email: USERS[userType].email,
            password: USERS[userType].password
        });
        
        if (response.data.token) {
            console.log(`✅ Login successful for ${userType}`);
            return response.data.token;
        } else {
            console.log(`❌ Login failed for ${userType}: No token received`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Login failed for ${userType}:`, error.response?.data?.message || error.message);
        return null;
    }
}

async function testRoleManagement() {
    console.log('🧪 Testing Role Management with Curl Commands\n');
    
    // Test with employee user first
    console.log('=== TESTING WITH EMPLOYEE USER ===');
    const empToken = await loginUser('emp1');
    
    if (empToken) {
        console.log('\n📋 Employee User Test Commands:');
        console.log('----------------------------------------');
        
        // Test updating own role to manager
        console.log('\n1️⃣ Test updating own role to manager:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${empToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "manager"}'`);
        
        // Test updating own role to admin
        console.log('\n2️⃣ Test updating own role to admin:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${empToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "admin"}'`);
        
        // Test invalid role
        console.log('\n3️⃣ Test invalid role validation:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${empToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "invalid_role"}'`);
        
        // Test missing role parameter
        console.log('\n4️⃣ Test missing role parameter:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${empToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{}'`);
        
        // Test updating back to employee
        console.log('\n5️⃣ Test updating back to employee:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${empToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "employee"}'`);
        
    } else {
        console.log('❌ Cannot proceed with employee tests - login failed');
    }
    
    // Test with admin user
    console.log('\n\n=== TESTING WITH ADMIN USER ===');
    const adminToken = await loginUser('admin');
    
    if (adminToken) {
        console.log('\n📋 Admin User Test Commands:');
        console.log('----------------------------------------');
        
        // Test admin updating employee role
        console.log('\n1️⃣ Test admin updating employee role to manager:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${adminToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "manager"}'`);
        
        // Test admin updating employee role to admin
        console.log('\n2️⃣ Test admin updating employee role to admin:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${adminToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "admin"}'`);
        
        // Test admin updating employee role to director
        console.log('\n3️⃣ Test admin updating employee role to director:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${adminToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "director"}'`);
        
        // Test admin updating employee role back to employee
        console.log('\n4️⃣ Test admin updating employee role back to employee:');
        console.log(`curl -X PATCH \\`);
        console.log(`  "${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role" \\`);
        console.log(`  -H "Authorization: Bearer ${adminToken}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"role": "employee"}'`);
        
    } else {
        console.log('❌ Cannot proceed with admin tests - login failed');
    }
    
    console.log('\n\n=== QUICK TEST WITH AXIOS ===');
    console.log('Running a quick test with axios to verify the endpoint...');
    
    if (empToken) {
        try {
            console.log('\n🔍 Testing role update with axios...');
            const response = await axios.patch(
                `${BASE_URL}/enterprise/${TEST_ENTERPRISE_ID}/departments/${TEST_DEPARTMENT_ID}/employees/yy9prnU8sMWsjoQVaHiZSQrwKFJ2/role`,
                {
                    role: 'manager'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${empToken}`
                    }
                }
            );
            
            console.log('✅ Role update successful!');
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            console.log('❌ Role update failed:');
            console.log('Status:', error.response?.status);
            console.log('Error:', error.response?.data || error.message);
            
            if (error.response?.status === 404) {
                console.log('\n💡 404 Error - Possible causes:');
                console.log('   • Server not running on port 8383');
                console.log('   • Enterprise/department/employee not found');
                console.log('   • Route not properly registered');
            }
        }
    }
    
    console.log('\n\n=== TESTING INSTRUCTIONS ===');
    console.log('1. Copy any of the curl commands above');
    console.log('2. Paste into your terminal/command prompt');
    console.log('3. Press Enter to execute');
    console.log('4. Check the response for success/error messages');
    console.log('\nExpected successful response:');
    console.log('{"success":true,"message":"Employee role updated successfully",...}');
    console.log('\nExpected error response:');
    console.log('{"success":false,"message":"Role must be one of: employee, manager, director, admin"}');
}

// Run the test
testRoleManagement()
    .then(() => {
        console.log('\n🏁 Test script completed');
        console.log('\n💡 Remember to restart the server if you get 404 errors!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
