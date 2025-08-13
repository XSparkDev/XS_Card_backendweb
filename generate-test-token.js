const { admin } = require('./firebase.js');

async function generateTestToken() {
    try {
        console.log('🔐 Generating new test token...');
        
        // Create a custom token for the test user
        const uid = 'test-user-email-signature';
        const customToken = await admin.auth().createCustomToken(uid, {
            email: 'testehakke@gufum.com',
            password: '123456'
        });
        
        console.log('✅ Custom token generated successfully');
        console.log('📋 Token:', customToken);
        
        // For testing purposes, we can also create a mock user object
        const mockUser = {
            uid: uid,
            email: 'testehakke@gufum.com',
            emailVerified: true,
            displayName: 'Test User',
            photoURL: null,
            disabled: false,
            metadata: {
                lastSignInTime: new Date().toISOString(),
                creationTime: new Date().toISOString()
            }
        };
        
        console.log('\n📝 Mock user data for testing:');
        console.log(JSON.stringify(mockUser, null, 2));
        
        return { customToken, mockUser };
        
    } catch (error) {
        console.error('❌ Failed to generate test token:', error.message);
        throw error;
    }
}

// Alternative approach: Create a test user directly
async function createTestUser() {
    try {
        console.log('👤 Creating test user...');
        
        const userRecord = await admin.auth().createUser({
            email: 'testehakke@gufum.com',
            password: '123456',
            displayName: 'Test User for Email Signature',
            emailVerified: true
        });
        
        console.log('✅ Test user created successfully');
        console.log('📋 User ID:', userRecord.uid);
        console.log('📧 Email:', userRecord.email);
        
        // Generate a custom token for this user
        const customToken = await admin.auth().createCustomToken(userRecord.uid);
        console.log('🔐 Custom token:', customToken);
        
        return { userRecord, customToken };
        
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            console.log('⚠️  User already exists, getting existing user...');
            
            // Get the existing user
            const userRecord = await admin.auth().getUserByEmail('testehakke@gufum.com');
            console.log('✅ Existing user found');
            console.log('📋 User ID:', userRecord.uid);
            
            // Generate a custom token for this user
            const customToken = await admin.auth().createCustomToken(userRecord.uid);
            console.log('🔐 Custom token:', customToken);
            
            return { userRecord, customToken };
        } else {
            console.error('❌ Failed to create/get test user:', error.message);
            throw error;
        }
    }
}

// Main function
async function main() {
    try {
        console.log('🚀 Starting token generation...\n');
        
        // Try to create/get the test user
        const { userRecord, customToken } = await createTestUser();
        
        console.log('\n🎉 Token generation completed!');
        console.log('\n📋 Test Configuration:');
        console.log('User ID:', userRecord.uid);
        console.log('Email:', userRecord.email);
        console.log('Custom Token:', customToken);
        
        console.log('\n💡 To use this token in your tests:');
        console.log('1. Replace the AUTH_TOKEN in your test files');
        console.log('2. Replace the TEST_USER_ID with:', userRecord.uid);
        console.log('3. Use the custom token for authentication');
        
        return { userRecord, customToken };
        
    } catch (error) {
        console.error('💥 Token generation failed:', error);
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

module.exports = { generateTestToken, createTestUser, main };





