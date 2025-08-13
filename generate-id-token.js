const { admin } = require('./firebase.js');
const axios = require('axios');

async function generateIdToken() {
    try {
        console.log('🔐 Generating Firebase ID token...');
        
        // First, let's create a test user if it doesn't exist
        const email = 'testehakke@gufum.com';
        const password = '123456';
        
        let userRecord;
        try {
            // Try to create the user
            userRecord = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: 'Test User for Email Signature',
                emailVerified: true
            });
            console.log('✅ Test user created successfully');
        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                // Get existing user
                userRecord = await admin.auth().getUserByEmail(email);
                console.log('✅ Existing user found');
            } else {
                throw error;
            }
        }
        
        console.log('📋 User ID:', userRecord.uid);
        console.log('📧 Email:', userRecord.email);
        
        // Now we need to simulate the sign-in process to get an ID token
        // Since we can't directly sign in with Firebase Admin SDK, let's create a mock ID token
        const mockIdToken = await createMockIdToken(userRecord);
        
        console.log('✅ ID token generated successfully');
        console.log('🔐 Token:', mockIdToken);
        
        return { userRecord, idToken: mockIdToken };
        
    } catch (error) {
        console.error('❌ Failed to generate ID token:', error.message);
        throw error;
    }
}

async function createMockIdToken(userRecord) {
    // Create a mock ID token structure similar to what Firebase Auth would generate
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        iss: `https://securetoken.google.com/xscard-addd4`,
        aud: 'xscard-addd4',
        auth_time: now,
        user_id: userRecord.uid,
        sub: userRecord.uid,
        iat: now,
        exp: now + 3600, // 1 hour from now
        email: userRecord.email,
        email_verified: userRecord.emailVerified,
        firebase: {
            identities: {
                email: [userRecord.email]
            },
            sign_in_provider: 'password'
        }
    };
    
    // For testing purposes, we'll create a simple token
    // In a real scenario, this would be signed by Firebase
    const tokenString = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    return `mock.${tokenString}.signature`;
}

// Alternative approach: Use the existing authentication middleware's test token feature
async function createTestToken() {
    try {
        console.log('🔐 Creating test token for authentication...');
        
        // Create a test token that the middleware will recognize
        const testToken = `test_token_${Date.now()}_email_signature_test`;
        
        console.log('✅ Test token created successfully');
        console.log('🔐 Token:', testToken);
        
        return { 
            userRecord: {
                uid: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
                email: 'testehakke@gufum.com',
                displayName: 'Test User for Email Signature'
            },
            idToken: testToken
        };
        
    } catch (error) {
        console.error('❌ Failed to create test token:', error.message);
        throw error;
    }
}

// Main function
async function main() {
    try {
        console.log('🚀 Starting ID token generation...\n');
        
        // Use the test token approach since it's simpler for testing
        const { userRecord, idToken } = await createTestToken();
        
        console.log('\n🎉 ID token generation completed!');
        console.log('\n📋 Test Configuration:');
        console.log('User ID:', userRecord.uid);
        console.log('Email:', userRecord.email);
        console.log('ID Token:', idToken);
        
        console.log('\n💡 To use this token in your tests:');
        console.log('1. Replace the AUTH_TOKEN in your test files with:', idToken);
        console.log('2. Replace the TEST_USER_ID with:', userRecord.uid);
        console.log('3. This token will be recognized by the authentication middleware');
        
        return { userRecord, idToken };
        
    } catch (error) {
        console.error('💥 ID token generation failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Main function error:', error);
        process.exit(1);
    });
}

module.exports = { generateIdToken, createTestToken, main };





