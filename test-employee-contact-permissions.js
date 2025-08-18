/**
 * Simple test script to verify employee contact permissions
 * Tests the checkContactPermissions function with various scenarios
 */

const { db, admin } = require('./firebase.js');

// Import the permission function (we'll need to export it from contactController)
// For now, we'll copy the function here for testing
const checkContactPermissions = async (userId, action, targetUserId = null) => {
    try {
        console.log(`🔍 [ContactPermissions] Checking ${action} permission for user: ${userId}, target: ${targetUserId}`);

        // Get user's basic data to check if they have enterprise association
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return { allowed: false, reason: 'User not found' };
        }

        const userData = userDoc.data();
        const enterpriseRef = userData.enterpriseRef;

        // If no enterprise association, allow access to own contacts only
        if (!enterpriseRef) {
            console.log(`📝 [ContactPermissions] No enterprise association - allowing own access only`);
            if (targetUserId && targetUserId !== userId) {
                return { 
                    allowed: false, 
                    reason: 'Non-enterprise users can only access their own contacts' 
                };
            }
            return { 
                allowed: true, 
                accessLevel: 'own', 
                userRole: 'individual',
                ownUserId: userId,
                effectivePermissions: ['viewContacts', 'deleteContacts', 'shareContacts']
            };
        }

        const enterpriseId = enterpriseRef.id;
        const enterpriseDoc = await enterpriseRef.get();
        
        if (!enterpriseDoc.exists) {
            return { allowed: false, reason: 'Enterprise not found' };
        }

        // Find user's role in the enterprise
        let userRole = null;
        let userDepartmentId = null;

        // Check all departments for this user
        const departmentsSnapshot = await enterpriseRef.collection('departments').get();
        
        for (const deptDoc of departmentsSnapshot.docs) {
            const employeesSnapshot = await deptDoc.ref.collection('employees')
                .where('userId', '==', db.doc(`users/${userId}`))
                .get();
            
            if (!employeesSnapshot.empty) {
                const employeeData = employeesSnapshot.docs[0].data();
                userRole = employeeData.role;
                userDepartmentId = deptDoc.id;
                break;
            }
        }

        if (!userRole) {
            // User has enterpriseRef but is not an employee - treat as individual user
            console.log(`📝 [ContactPermissions] User has enterprise association but is not an employee - treating as individual user`);
            if (targetUserId && targetUserId !== userId) {
                return { 
                    allowed: false, 
                    reason: 'Non-employee enterprise users can only access their own contacts' 
                };
            }
            return { 
                allowed: true, 
                accessLevel: 'own', 
                userRole: 'individual',
                ownUserId: userId,
                effectivePermissions: ['viewContacts', 'deleteContacts', 'shareContacts']
            };
        }

        // Get user's individual permissions (if they exist)
        let individualPermissions = { removed: [], added: [] };
        try {
            const enterpriseUserRef = enterpriseRef.collection('users').doc(userId);
            const enterpriseUserDoc = await enterpriseUserRef.get();
            if (enterpriseUserDoc.exists) {
                individualPermissions = enterpriseUserDoc.data().individualPermissions || { removed: [], added: [] };
            }
        } catch (permError) {
            console.log('No individual permissions found for user, using defaults');
        }

        // Define contact permissions by role (from analysis document)
        const basePermissions = {
            'admin': ['viewContacts', 'deleteContacts', 'manageAllContacts', 'exportContacts', 'shareContacts'],
            'manager': ['viewContacts', 'deleteContacts', 'manageAllContacts', 'exportContacts', 'shareContacts'],
            'employee': ['viewContacts', 'deleteContacts', 'shareContacts']
        };

        let effectivePermissions = [...(basePermissions[userRole] || [])];

        // Apply individual permission overrides
        if (individualPermissions.removed) {
            effectivePermissions = effectivePermissions.filter(p => !individualPermissions.removed.includes(p));
        }
        if (individualPermissions.added) {
            effectivePermissions = [...effectivePermissions, ...individualPermissions.added];
        }

        // Check if user has the required permission for this action
        const requiredPermission = getRequiredPermission(action);
        if (!effectivePermissions.includes(requiredPermission)) {
            return { allowed: false, reason: `Access denied: ${requiredPermission} permission required` };
        }

        // For Phase 1: Employee-only implementation
        // Only handle 'employee' role with 'own' access level
        if (userRole === 'employee') {
            // Employees can only access their own contacts
            if (targetUserId && targetUserId !== userId) {
                return { 
                    allowed: false, 
                    reason: 'Employees can only access their own contacts' 
                };
            }
            return { 
                allowed: true, 
                accessLevel: 'own', 
                userRole, 
                userDepartmentId, 
                effectivePermissions,
                ownUserId: userId
            };
        }

        // For now, deny access to admin/manager roles until Phase 2
        return { 
            allowed: false, 
            reason: `Contact permissions for role '${userRole}' not yet implemented. Currently supporting employees only.` 
        };

    } catch (error) {
        console.error('Error checking contact permissions:', error);
        return { allowed: false, reason: 'Error checking permissions' };
    }
};

/**
 * Map actions to required permissions
 */
const getRequiredPermission = (action) => {
    const actionMap = {
        'view': 'viewContacts',
        'delete': 'deleteContacts',
        'export': 'exportContacts',
        'share': 'shareContacts',
        'manage': 'manageAllContacts'
    };
    return actionMap[action] || 'viewContacts';
};

/**
 * Test scenarios
 */
async function runTests() {
    console.log('🧪 Starting Employee Contact Permissions Tests...\n');

    // Test data - you'll need to replace with actual user IDs from your database
    const testUsers = {
        employee1: 'yy9prnU8sMWsjoQVaHiZSQrwKFJ2',
        employee2: 'jHKXOoB9aiTMdOiTmuRckYdQFIL2',
        individualUser: 'EccyMCv7uiS1eYHB3ZMu6zRR1DG2' // User without enterprise
    };

    const tests = [
        {
            name: 'Employee can view own contacts',
            userId: testUsers.employee1,
            action: 'view',
            targetUserId: testUsers.employee1,
            expectedResult: true
        },
        {
            name: 'Employee cannot view other employee contacts',
            userId: testUsers.employee1,
            action: 'view',
            targetUserId: testUsers.employee2,
            expectedResult: false
        },
        {
            name: 'Employee can delete own contacts',
            userId: testUsers.employee1,
            action: 'delete',
            targetUserId: testUsers.employee1,
            expectedResult: true
        },
        {
            name: 'Employee cannot delete other employee contacts',
            userId: testUsers.employee1,
            action: 'delete',
            targetUserId: testUsers.employee2,
            expectedResult: false
        },
        {
            name: 'Individual user can view own contacts',
            userId: testUsers.individualUser,
            action: 'view',
            targetUserId: testUsers.individualUser,
            expectedResult: true
        },
        {
            name: 'Individual user cannot view other user contacts',
            userId: testUsers.individualUser,
            action: 'view',
            targetUserId: testUsers.employee1,
            expectedResult: false
        }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
        try {
            console.log(`📋 Testing: ${test.name}`);
            const result = await checkContactPermissions(test.userId, test.action, test.targetUserId);
            
            const passed = result.allowed === test.expectedResult;
            
            if (passed) {
                console.log(`✅ PASS - ${test.name}`);
                console.log(`   Result: ${result.allowed} (${result.reason || 'Access granted'})`);
                passedTests++;
            } else {
                console.log(`❌ FAIL - ${test.name}`);
                console.log(`   Expected: ${test.expectedResult}, Got: ${result.allowed}`);
                console.log(`   Reason: ${result.reason}`);
            }
            console.log('');
        } catch (error) {
            console.log(`💥 ERROR - ${test.name}: ${error.message}\n`);
        }
    }

    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Employee contact permissions are working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please check the implementation.');
    }
}

// Instructions for running the test
console.log(`
🔧 SETUP INSTRUCTIONS:
1. Replace the test user IDs in testUsers object with actual user IDs from your database
2. Ensure you have:
   - At least 2 employee users in the same or different enterprises
   - At least 1 individual user (not associated with any enterprise)
3. Run with: node test-employee-contact-permissions.js

📝 NOTE: This is a basic test. For production, consider using a proper testing framework like Jest.
`);

// Uncomment the line below to run tests (after setting up test user IDs)
runTests().catch(console.error);

module.exports = {
    runTests,
    checkContactPermissions
};


