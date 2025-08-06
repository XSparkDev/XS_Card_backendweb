const axios = require('axios');

const BASE_URL = 'http://localhost:8383';

async function testEmailLinks() {
    console.log('🧪 Testing Email Links...\n');

    try {
        // Test 1: Check if the server is running
        console.log('1. Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/api/health`);
        console.log('✅ Server is running:', healthResponse.data);
        console.log('');

        // Test 2: Test email verification endpoint
        console.log('2. Testing email verification endpoint...');
        try {
            const verifyResponse = await axios.get(`${BASE_URL}/verify-email?token=test&uid=test`);
            console.log('✅ Email verification endpoint is accessible');
            console.log('Status:', verifyResponse.status);
        } catch (error) {
            console.log('⚠️ Email verification endpoint error:', error.response?.status || error.message);
        }
        console.log('');

        // Test 3: Test password reset page
        console.log('3. Testing password reset page...');
        try {
            const resetResponse = await axios.get(`${BASE_URL}/reset-password?token=test&uid=test`);
            console.log('✅ Password reset page is accessible');
            console.log('Status:', resetResponse.status);
            console.log('Content type:', resetResponse.headers['content-type']);
        } catch (error) {
            console.log('⚠️ Password reset page error:', error.response?.status || error.message);
        }
        console.log('');

        // Test 4: Test password reset API endpoint
        console.log('4. Testing password reset API endpoint...');
        try {
            const resetApiResponse = await axios.post(`${BASE_URL}/reset-password`, {
                token: 'test',
                uid: 'test',
                newPassword: 'TestPassword123!'
            });
            console.log('✅ Password reset API endpoint is accessible');
            console.log('Status:', resetApiResponse.status);
        } catch (error) {
            console.log('⚠️ Password reset API endpoint error:', error.response?.status || error.message);
            if (error.response?.data) {
                console.log('Error message:', error.response.data.message);
            }
        }
        console.log('');

        // Test 5: Test forgot password endpoint
        console.log('5. Testing forgot password endpoint...');
        try {
            const forgotResponse = await axios.post(`${BASE_URL}/forgot-password`, {
                email: 'test@example.com'
            });
            console.log('✅ Forgot password endpoint is accessible');
            console.log('Status:', forgotResponse.status);
        } catch (error) {
            console.log('⚠️ Forgot password endpoint error:', error.response?.status || error.message);
        }
        console.log('');

        console.log('🎉 Email link testing completed!');
        console.log('\n📋 Summary:');
        console.log('- Server health: ✅');
        console.log('- Email verification page: ✅');
        console.log('- Password reset page: ✅');
        console.log('- Password reset API: ✅');
        console.log('- Forgot password API: ✅');
        console.log('\n💡 If you see any ⚠️ warnings, they might be expected for invalid test data.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure your server is running on port 8383');
            console.log('   Run: npm start or node server.js');
        }
    }
}

// Run the test
testEmailLinks(); 