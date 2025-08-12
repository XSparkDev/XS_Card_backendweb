const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8383';
const TEST_USER_ID = 'BPxFmmG6SVXvbwwRJ0YjBnuI8e73'; // User ID from the token
const AUTH_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjJiN2JhZmIyZjEwY2FlMmIxZjA3ZjM4MTZjNTQyMmJlY2NhNWMyMjMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20veHNjYXJkLWFkZGQ0IiwiYXVkIjoieHNjYXJkLWFkZGQ0IiwiYXV0aF90aW1lIjoxNzU0Njc0MTcyLCJ1c2VyX2lkIjoiQlB4Rm1tRzZTVlh2Ynd3UkowWWpCbnVJOGU3MyIsInN1YiI6IkJQeEZtbUc2U1ZYdmJ3d1JKMFlqQm51SThlNzMiLCJpYXQiOjE3NTQ2NzQxNzIsImV4cCI6MTc1NDY3Nzc3MiwiZW1haWwiOiJ4ZW5hY29oNzQwQHBlcmN5ZnguY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsieGVuYWNvaDc0MEBwZXJjeWZ4LmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.zhyJ9XVM8ILQ6f1ccDFsmYodNTFlLbmv8FqvmJ6eaHAKmjw5edk1YF-SKgYrL78tr1X0o0WDtNT8qKQ5zoDJZQeAJkrOWoKTxxeIv6xJYwXUlL5fgpOj_Yb1hX_s0wksLoAxoe7PilmnRsMwceuD2-BN2uDuuR7nOBCx3bCa1atn7OHgZyNIbXJ8fc20MjVQj4hao78IcuI1bDE-oPR3B-1y6-Pni0UMweaKB_LPfmiRZuLWnQeYTGNUKnjgMH6uRoNj-GvteYWL4zqTpjrrMGEpoEWoiecB08yNsRlIIRUz_sCVyg5Qb7ixD-unTwStUuxkLfXy0Wkaiq9Zh9pkQ';

// Create axios instance with auth headers
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

// Test data
const testSignatureData = {
    signatureText: "Best regards,",
    includeName: true,
    includeTitle: true,
    includeCompany: true,
    includePhone: true,
    includeEmail: true,
    includeWebsite: false,
    includeSocials: false,
    signatureStyle: 'professional',
    isActive: true
};

const testPreviewData = {
    signatureText: "Thank you for your time,",
    includeName: true,
    includeTitle: true,
    includeCompany: true,
    includePhone: true,
    includeEmail: true,
    includeWebsite: false,
    includeSocials: false,
    signatureStyle: 'modern'
};

const testEmailData = {
    testEmail: 'test@example.com'
};

// Test functions
async function testSignatureTemplates() {
    console.log('🧪 Testing signature templates...');
    try {
        const response = await api.get(`/signature-templates`);
        console.log('✅ Signature templates retrieved successfully');
        console.log('📋 Available templates:', response.data.templates.length);
        response.data.templates.forEach(template => {
            console.log(`  - ${template.name}: ${template.description}`);
        });
        return true;
    } catch (error) {
        console.error('❌ Failed to get signature templates:', error.response?.data || error.message);
        return false;
    }
}

async function testCreateSignature() {
    console.log('\n🧪 Testing signature creation...');
    try {
        const response = await api.patch(`/Users/${TEST_USER_ID}/email-signature`, testSignatureData);
        console.log('✅ Signature created successfully');
        console.log('📝 Signature data:', response.data.signature);
        return true;
    } catch (error) {
        console.error('❌ Failed to create signature:', error.response?.data || error.message);
        return false;
    }
}

async function testGetSignature() {
    console.log('\n🧪 Testing signature retrieval...');
    try {
        const response = await api.get(`/Users/${TEST_USER_ID}/email-signature`);
        console.log('✅ Signature retrieved successfully');
        console.log('📝 Has signature:', response.data.hasSignature);
        if (response.data.signature) {
            console.log('📝 Signature style:', response.data.signature.signatureStyle);
            console.log('📝 Is active:', response.data.signature.isActive);
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to get signature:', error.response?.data || error.message);
        return false;
    }
}

async function testPreviewSignature() {
    console.log('\n🧪 Testing signature preview...');
    try {
        const response = await api.post(`/Users/${TEST_USER_ID}/signature-preview`, testPreviewData);
        console.log('✅ Signature preview generated successfully');
        console.log('📝 Preview length:', response.data.preview.length);
        console.log('📝 Preview preview (first 200 chars):', response.data.preview.substring(0, 200) + '...');
        return true;
    } catch (error) {
        console.error('❌ Failed to generate preview:', error.response?.data || error.message);
        return false;
    }
}

async function testTestEmail() {
    console.log('\n🧪 Testing test email functionality...');
    try {
        const response = await api.post(`/Users/${TEST_USER_ID}/test-signature`, testEmailData);
        console.log('✅ Test email sent successfully');
        console.log('📧 Email result:', response.data.emailResult);
        return true;
    } catch (error) {
        console.error('❌ Failed to send test email:', error.response?.data || error.message);
        return false;
    }
}

async function testDeleteSignature() {
    console.log('\n🧪 Testing signature deletion...');
    try {
        const response = await api.delete(`/Users/${TEST_USER_ID}/email-signature`);
        console.log('✅ Signature deleted successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to delete signature:', error.response?.data || error.message);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting Email Signature Feature Tests\n');
    
    const tests = [
        { name: 'Signature Templates', fn: testSignatureTemplates },
        { name: 'Create Signature', fn: testCreateSignature },
        { name: 'Get Signature', fn: testGetSignature },
        { name: 'Preview Signature', fn: testPreviewSignature },
        { name: 'Test Email', fn: testTestEmail },
        { name: 'Delete Signature', fn: testDeleteSignature }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
        console.log(`\n📋 Running: ${test.name}`);
        const result = await test.fn();
        if (result) {
            passedTests++;
        }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All tests passed! Email signature feature is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test runner error:', error);
        process.exit(1);
    });
}

module.exports = {
    testSignatureTemplates,
    testCreateSignature,
    testGetSignature,
    testPreviewSignature,
    testTestEmail,
    testDeleteSignature,
    runTests
};

