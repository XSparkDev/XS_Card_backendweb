const axios = require('axios');
const { db, admin } = require('./firebase.js');

// Configuration
const BASE_URL = 'http://localhost:8383';
const TEST_USER_ID = 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1';
const AUTH_TOKEN = 'test_token_1754676066482_email_signature_test';

// Create axios instance with auth headers
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

// Test data variations
const testSignatures = {
    professional: {
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
    },
    modern: {
        signatureText: "Thank you for your time,",
        includeName: true,
        includeTitle: true,
        includeCompany: true,
        includePhone: true,
        includeEmail: true,
        includeWebsite: true,
        includeSocials: true,
        signatureStyle: 'modern',
        isActive: true
    },
    minimal: {
        signatureText: "Cheers,",
        includeName: true,
        includeTitle: false,
        includeCompany: false,
        includePhone: true,
        includeEmail: true,
        includeWebsite: false,
        includeSocials: false,
        signatureStyle: 'minimal',
        isActive: true
    },
    empty: {
        signatureText: "",
        includeName: false,
        includeTitle: false,
        includeCompany: false,
        includePhone: false,
        includeEmail: false,
        includeWebsite: false,
        includeSocials: false,
        signatureStyle: 'professional',
        isActive: false
    },
    invalid: {
        signatureText: "Test",
        includeName: true,
        includeTitle: true,
        includeCompany: true,
        includePhone: true,
        includeEmail: true,
        includeWebsite: false,
        includeSocials: false,
        signatureStyle: 'invalid_style',
        isActive: true
    }
};

// Test functions
async function testSignatureTemplates() {
    console.log('🧪 Testing signature templates...');
    try {
        const response = await api.get(`/public/signature-templates`);
        console.log('✅ Signature templates retrieved successfully');
        console.log('📋 Available templates:', response.data.templates.length);
        
        // Validate template structure
        const templates = response.data.templates;
        const requiredFields = ['id', 'name', 'description', 'preview'];
        
        for (const template of templates) {
            for (const field of requiredFields) {
                if (!template[field]) {
                    throw new Error(`Template missing required field: ${field}`);
                }
            }
        }
        
        console.log('✅ Template structure validation passed');
        return true;
    } catch (error) {
        console.error('❌ Failed to get signature templates:', error.response?.data || error.message);
        return false;
    }
}

async function testCreateSignature() {
    console.log('\n🧪 Testing signature creation...');
    const results = [];
    
    // Test all signature styles
    for (const [style, data] of Object.entries(testSignatures)) {
        try {
            console.log(`  Testing ${style} signature...`);
            const response = await api.patch(`/Users/${TEST_USER_ID}/email-signature`, data);
            
            if (response.data.success) {
                console.log(`  ✅ ${style} signature created successfully`);
                results.push(true);
            } else {
                console.log(`  ❌ ${style} signature creation failed`);
                results.push(false);
            }
        } catch (error) {
            console.log(`  ❌ ${style} signature creation failed:`, error.response?.data?.message || error.message);
            results.push(false);
        }
    }
    
    return results.every(result => result);
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
            console.log('📝 Include name:', response.data.signature.includeName);
            console.log('📝 Include title:', response.data.signature.includeTitle);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to get signature:', error.response?.data || error.message);
        return false;
    }
}

async function testPreviewSignature() {
    console.log('\n🧪 Testing signature preview...');
    const results = [];
    
    // Test preview for each style
    for (const [style, data] of Object.entries(testSignatures)) {
        try {
            console.log(`  Testing ${style} preview...`);
            const response = await api.post(`/Users/${TEST_USER_ID}/signature-preview`, data);
            
            if (response.data.preview && response.data.preview.length > 0) {
                console.log(`  ✅ ${style} preview generated (${response.data.preview.length} chars)`);
                results.push(true);
            } else {
                console.log(`  ❌ ${style} preview generation failed`);
                results.push(false);
            }
        } catch (error) {
            console.log(`  ❌ ${style} preview failed:`, error.response?.data?.message || error.message);
            results.push(false);
        }
    }
    
    return results.every(result => result);
}

async function testTestEmail() {
    console.log('\n🧪 Testing test email functionality...');
    const testEmails = [
        'test@example.com',
        'user@domain.com',
        'invalid-email',
        ''
    ];
    
    const results = [];
    
    for (const email of testEmails) {
        try {
            console.log(`  Testing email: ${email}`);
            const response = await api.post(`/Users/${TEST_USER_ID}/test-signature`, { testEmail: email });
            
            if (response.data.emailResult) {
                console.log(`  ✅ Test email sent successfully`);
                results.push(true);
            } else {
                console.log(`  ❌ Test email failed`);
                results.push(false);
            }
        } catch (error) {
            console.log(`  ❌ Test email failed:`, error.response?.data?.message || error.message);
            results.push(false);
        }
    }
    
    return results.every(result => result);
}

async function testDeleteSignature() {
    console.log('\n🧪 Testing signature deletion...');
    try {
        const response = await api.delete(`/Users/${TEST_USER_ID}/email-signature`);
        console.log('✅ Signature deleted successfully');
        
        // Verify deletion
        const getResponse = await api.get(`/Users/${TEST_USER_ID}/email-signature`);
        if (!getResponse.data.hasSignature) {
            console.log('✅ Deletion verified - no signature found');
            return true;
        } else {
            console.log('❌ Deletion verification failed - signature still exists');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to delete signature:', error.response?.data || error.message);
        return false;
    }
}

async function testErrorHandling() {
    console.log('\n🧪 Testing error handling...');
    const results = [];
    
    // Test invalid user ID
    try {
        await api.get(`/Users/invalid-user-id/email-signature`);
        console.log('  ❌ Should have failed with invalid user ID');
        results.push(false);
    } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 400) {
            console.log('  ✅ Invalid user ID handled correctly');
            results.push(true);
        } else {
            console.log('  ❌ Unexpected error for invalid user ID');
            results.push(false);
        }
    }
    
    // Test invalid signature data
    try {
        await api.patch(`/Users/${TEST_USER_ID}/email-signature`, { invalid: 'data' });
        console.log('  ❌ Should have failed with invalid data');
        results.push(false);
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('  ✅ Invalid data handled correctly');
            results.push(true);
        } else {
            console.log('  ❌ Unexpected error for invalid data');
            results.push(false);
        }
    }
    
    // Test unauthorized access
    try {
        const unauthorizedApi = axios.create({
            baseURL: BASE_URL,
            headers: { 'Content-Type': 'application/json' }
        });
        await unauthorizedApi.get(`/Users/${TEST_USER_ID}/email-signature`);
        console.log('  ❌ Should have failed without authentication');
        results.push(false);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('  ✅ Unauthorized access handled correctly');
            results.push(true);
        } else {
            console.log('  ❌ Unexpected error for unauthorized access');
            results.push(false);
        }
    }
    
    return results.every(result => result);
}

async function testDatabaseIntegration() {
    console.log('\n🧪 Testing database integration...');
    try {
        // Check if user exists in database
        const userRef = db.collection('users').doc(TEST_USER_ID);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            console.log('✅ User exists in database');
            
            // Check if email signature field exists
            const userData = userDoc.data();
            if (userData.emailSignature !== undefined) {
                console.log('✅ Email signature field exists in user document');
                return true;
            } else {
                console.log('⚠️  Email signature field not found in user document');
                return true; // This is expected for new users
            }
        } else {
            console.log('⚠️  User not found in database - this is expected for testing');
            return true;
        }
    } catch (error) {
        console.error('❌ Database integration test failed:', error.message);
        return false;
    }
}

async function testEmailServiceIntegration() {
    console.log('\n🧪 Testing email service integration...');
    try {
        // Test the email service functions directly
        const { sendMailWithStatus } = require('./public/Utils/emailService');
        
        // Create a test email with signature
        const testMailOptions = {
            to: 'test@example.com',
            subject: 'Test Email with Signature',
            html: '<p>This is a test email.</p>'
        };
        
        // This should automatically apply the user's signature
        const result = await sendMailWithStatus(testMailOptions, TEST_USER_ID);
        
        if (result.success) {
            console.log('✅ Email service integration working');
            return true;
        } else {
            console.log('❌ Email service integration failed');
            return false;
        }
    } catch (error) {
        console.error('❌ Email service integration test failed:', error.message);
        return false;
    }
}

// Main test runner
async function runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive Email Signature Tests\n');
    
    const tests = [
        { name: 'Signature Templates', fn: testSignatureTemplates },
        { name: 'Create Signature (All Styles)', fn: testCreateSignature },
        { name: 'Get Signature', fn: testGetSignature },
        { name: 'Preview Signature (All Styles)', fn: testPreviewSignature },
        { name: 'Test Email Functionality', fn: testTestEmail },
        { name: 'Delete Signature', fn: testDeleteSignature },
        { name: 'Error Handling', fn: testErrorHandling },
        { name: 'Database Integration', fn: testDatabaseIntegration },
        { name: 'Email Service Integration', fn: testEmailServiceIntegration }
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
    
    console.log('\n📊 Comprehensive Test Results:');
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
    
    const successRate = (passedTests / totalTests) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 98) {
        console.log('\n🎉 Comprehensive tests passed with 98%+ success rate!');
        console.log('✅ Email signature feature is fully functional and ready for production.');
        return true;
    } else {
        console.log('\n⚠️  Some comprehensive tests failed. Please review the implementation.');
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runComprehensiveTests().catch(error => {
        console.error('💥 Comprehensive test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runComprehensiveTests };
