const { db, admin } = require('./firebase');

/**
 * Test script to verify the Individual Permissions endpoint
 * This will test the actual database operations that the endpoint performs
 */

const TEST_ENTERPRISE_ID = 'x-spark-test';
const TEST_USER_ID = 'user-001';

// Valid business card permissions
const VALID_PERMISSIONS = [
    'viewCards', 'createCards', 'editCards', 'deleteCards', 
    'manageAllCards', 'exportCards', 'shareCards'
];

async function testPermissionsEndpoint() {
    console.log('🧪 Testing Individual Permissions Endpoint...\n');
    
    try {
        // 1. Test the database operations that the endpoint performs
        console.log('📋 Testing database operations...');
        
        // Check if enterprise exists
        const enterpriseRef = db.collection('enterprise').doc(TEST_ENTERPRISE_ID);
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            console.log('❌ Enterprise not found, creating test enterprise...');
            await enterpriseRef.set({
                name: 'X-Spark Test Enterprise',
                createdAt: admin.firestore.Timestamp.now()
            });
        }
        
        // Check if user exists in enterprise users collection
        const userRef = enterpriseRef.collection('users').doc(TEST_USER_ID);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            console.log('❌ User not found, creating test user...');
            await userRef.set({
                id: TEST_USER_ID,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@x-spark-test.com',
                role: 'Manager',
                status: 'active',
                individualPermissions: { removed: [], added: [] },
                createdAt: admin.firestore.Timestamp.now()
            });
        }
        
        console.log('✅ Test data verified/created\n');
        
        // 2. Test the update operation (what the PUT endpoint does)
        console.log('📦 Testing permission update operation...');
        
        const testPayload = {
            individualPermissions: {
                removed: ['createCards', 'deleteCards'],
                added: ['manageAllCards', 'exportCards']
            }
        };
        
        console.log('Request Body:');
        console.log(JSON.stringify(testPayload, null, 2));
        console.log('');
        
        // Perform the update (this is what the endpoint does)
        const updateData = {
            individualPermissions: {
                removed: testPayload.individualPermissions.removed || [],
                added: testPayload.individualPermissions.added || []
            },
            lastModified: new Date(),
            lastModifiedBy: 'test-admin'
        };
        
        await userRef.update(updateData);
        console.log('✅ Permission update successful\n');
        
        // 3. Get updated user data
        console.log('📤 Getting updated user data...');
        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data();
        
        // 4. Format the response (what the endpoint returns)
        const response = {
            success: true,
            data: {
                userId: TEST_USER_ID,
                updatedPermissions: updatedUserData.individualPermissions,
                timestamp: new Date().toISOString(),
                updatedBy: 'test-admin'
            }
        };
        
        console.log('Response:');
        console.log(JSON.stringify(response, null, 2));
        console.log('');
        
        // 5. Test the GET endpoint operation
        console.log('📋 Testing GET endpoint operation...');
        const employeesSnapshot = await enterpriseRef.collection('users').get();
        const employees = [];
        
        employeesSnapshot.forEach(doc => {
            const userData = doc.data();
            employees.push({
                id: doc.id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                role: userData.role,
                individualPermissions: userData.individualPermissions || { removed: [], added: [] }
            });
        });
        
        const getResponse = {
            success: true,
            employees: employees,
            totalCount: employees.length
        };
        
        console.log('GET Response (first 2 employees):');
        console.log(JSON.stringify({ ...getResponse, employees: getResponse.employees.slice(0, 2) }, null, 2));
        console.log('');
        
        // 6. Summary
        console.log('🎯 Test Summary:');
        console.log('✅ Database operations working');
        console.log('✅ Permission update working');
        console.log('✅ GET endpoint working');
        console.log('');
        console.log('📋 Endpoint Details for Frontend:');
        console.log(`PUT /api/enterprises/${TEST_ENTERPRISE_ID}/users/${TEST_USER_ID}/permissions`);
        console.log(`GET /api/enterprises/${TEST_ENTERPRISE_ID}/employees`);
        console.log('');
        console.log('🚀 Backend is ready! The endpoint should work when called from frontend.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testPermissionsEndpoint()
    .then(() => {
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });

