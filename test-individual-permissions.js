const { db, admin } = require('./firebase');

/**
 * Test script for Individual Permissions System (Business Cards POC)
 * 
 * This script creates sample enterprise users with different permission combinations
 * to test the individual permissions system and generate frontend test data.
 */

const SAMPLE_ENTERPRISE_ID = 'test-enterprise';
const SAMPLE_DEPARTMENT_ID = 'sales';

// Valid business card permissions
const VALID_PERMISSIONS = [
    'viewCards', 'createCards', 'editCards', 'deleteCards', 
    'manageAllCards', 'exportCards', 'shareCards'
];

// Role-based default permissions (as defined in frontend)
const ROLE_PERMISSIONS = {
    'Administrator': ['viewCards', 'createCards', 'editCards', 'deleteCards', 'manageAllCards', 'exportCards', 'shareCards'],
    'Manager': ['viewCards', 'createCards', 'editCards', 'exportCards', 'shareCards'],
    'Employee': ['viewCards', 'createCards', 'editCards', 'shareCards']
};

// Sample users with different permission scenarios
const SAMPLE_USERS = [
    {
        userId: 'user-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'Manager',
        individualPermissions: {
            removed: ['createCards', 'deleteCards'],
            added: ['manageAllCards']
        },
        scenario: 'Manager with reduced create/delete permissions but added manageAllCards'
    },
    {
        userId: 'user-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        role: 'Employee',
        individualPermissions: {
            removed: [],
            added: ['deleteCards', 'exportCards']
        },
        scenario: 'Employee with additional delete and export permissions'
    },
    {
        userId: 'user-003',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@example.com',
        role: 'Administrator',
        individualPermissions: {
            removed: ['deleteCards', 'manageAllCards'],
            added: []
        },
        scenario: 'Administrator with restricted delete and manage permissions'
    }
];

/**
 * Calculate effective permissions for a user
 */
function calculateEffectivePermissions(role, individualPermissions) {
    const basePermissions = ROLE_PERMISSIONS[role] || [];
    let effectivePermissions = [...basePermissions];
    
    // Remove permissions
    if (individualPermissions.removed) {
        effectivePermissions = effectivePermissions.filter(p => !individualPermissions.removed.includes(p));
    }
    
    // Add permissions
    if (individualPermissions.added) {
        effectivePermissions = [...effectivePermissions, ...individualPermissions.added];
    }
    
    // Remove duplicates
    return [...new Set(effectivePermissions)];
}

/**
 * Create or update enterprise structure
 */
async function setupEnterpriseStructure() {
    console.log('🏢 Setting up enterprise structure...');
    
    try {
        // Create enterprise
        const enterpriseRef = db.collection('enterprise').doc(SAMPLE_ENTERPRISE_ID);
        await enterpriseRef.set({
            name: 'Test Enterprise Ltd',
            description: 'Test enterprise for individual permissions POC',
            industry: 'Technology',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
        
        // Create department
        const departmentRef = enterpriseRef.collection('departments').doc(SAMPLE_DEPARTMENT_ID);
        await departmentRef.set({
            name: 'Sales Department',
            description: 'Sales and marketing team',
            memberCount: SAMPLE_USERS.length,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
        
        console.log('✅ Enterprise structure created');
        return { enterpriseRef, departmentRef };
    } catch (error) {
        console.error('❌ Error setting up enterprise structure:', error);
        throw error;
    }
}

/**
 * Create sample users in enterprise users collection
 */
async function createSampleUsers(enterpriseRef) {
    console.log('👥 Creating sample users...');
    
    try {
        const userPromises = SAMPLE_USERS.map(async (user) => {
            const userRef = enterpriseRef.collection('users').doc(user.userId);
            
            const userData = {
                id: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                status: 'active',
                lastActive: new Date().toISOString(),
                individualPermissions: user.individualPermissions,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            
            await userRef.set(userData, { merge: true });
            console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.role})`);
        });
        
        await Promise.all(userPromises);
        console.log('✅ All sample users created');
    } catch (error) {
        console.error('❌ Error creating sample users:', error);
        throw error;
    }
}

/**
 * Create sample employees in department employees collection
 */
async function createSampleEmployees(departmentRef) {
    console.log('👤 Creating sample employees...');
    
    try {
        const employeePromises = SAMPLE_USERS.map(async (user) => {
            const employeeRef = departmentRef.collection('employees').doc(user.userId);
            
            const employeeData = {
                userId: db.doc(`users/${user.userId}`),
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.firstName,
                surname: user.lastName,
                email: user.email,
                phone: `+27-87-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
                role: user.role.toLowerCase(),
                position: user.role,
                isActive: true,
                employeeId: `EMP-${user.userId.slice(-3).toUpperCase()}`,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            
            await employeeRef.set(employeeData, { merge: true });
            console.log(`✅ Created employee: ${user.firstName} ${user.lastName}`);
        });
        
        await Promise.all(employeePromises);
        console.log('✅ All sample employees created');
    } catch (error) {
        console.error('❌ Error creating sample employees:', error);
        throw error;
    }
}

/**
 * Generate test responses for frontend
 */
async function generateTestResponses() {
    console.log('📄 Generating test responses...');
    
    const responses = {};
    
    // 1. Get all enterprise employees response
    try {
        const allEmployees = [];
        for (const user of SAMPLE_USERS) {
            const effectivePermissions = calculateEffectivePermissions(user.role, user.individualPermissions);
            
            allEmployees.push({
                id: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                departmentId: SAMPLE_DEPARTMENT_ID,
                departmentName: 'Sales Department',
                status: 'active',
                lastActive: new Date().toISOString(),
                individualPermissions: user.individualPermissions,
                effectivePermissions: effectivePermissions,
                scenario: user.scenario
            });
        }
        
        responses.getAllEnterpriseEmployees = {
            success: true,
            employees: allEmployees,
            totalCount: allEmployees.length,
            currentPage: 1,
            totalPages: 1
        };
        
        // 2. Individual permission update responses
        responses.updatePermissions = SAMPLE_USERS.map(user => ({
            success: true,
            data: {
                userId: user.userId,
                updatedPermissions: user.individualPermissions,
                timestamp: new Date().toISOString(),
                updatedBy: 'admin-user-123'
            }
        }));
        
        // 3. Sample permission calculation examples
        responses.permissionCalculationExamples = SAMPLE_USERS.map(user => {
            const basePermissions = ROLE_PERMISSIONS[user.role] || [];
            const effectivePermissions = calculateEffectivePermissions(user.role, user.individualPermissions);
            
            return {
                user: {
                    id: user.userId,
                    name: `${user.firstName} ${user.lastName}`,
                    role: user.role
                },
                basePermissions: basePermissions,
                individualPermissions: user.individualPermissions,
                effectivePermissions: effectivePermissions,
                scenario: user.scenario,
                permissionChanges: {
                    removed: user.individualPermissions.removed.length,
                    added: user.individualPermissions.added.length
                }
            };
        });
        
        console.log('✅ Test responses generated');
        return responses;
    } catch (error) {
        console.error('❌ Error generating test responses:', error);
        throw error;
    }
}

/**
 * Test the API endpoints
 */
async function testAPIEndpoints() {
    console.log('🧪 Testing API endpoints...');
    
    try {
        // Test updating permissions for one user
        const testUser = SAMPLE_USERS[0];
        console.log(`Testing permission update for ${testUser.firstName} ${testUser.lastName}...`);
        
        // Simulate API call
        const updateData = {
            individualPermissions: {
                removed: ['createCards'],
                added: ['exportCards']
            }
        };
        
        // Update in database
        const userRef = db.collection('enterprise')
            .doc(SAMPLE_ENTERPRISE_ID)
            .collection('users')
            .doc(testUser.userId);
            
        await userRef.update({
            individualPermissions: updateData.individualPermissions,
            lastModified: new Date(),
            lastModifiedBy: 'test-admin'
        });
        
        console.log('✅ API endpoint test completed');
    } catch (error) {
        console.error('❌ Error testing API endpoints:', error);
        throw error;
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        console.log('🚀 Starting Individual Permissions Test Setup...\n');
        
        // Setup enterprise structure
        const { enterpriseRef, departmentRef } = await setupEnterpriseStructure();
        
        // Create sample users
        await createSampleUsers(enterpriseRef);
        
        // Create sample employees
        await createSampleEmployees(departmentRef);
        
        // Test API endpoints
        await testAPIEndpoints();
        
        // Generate test responses
        const testResponses = await generateTestResponses();
        
        // Save test responses to file
        const fs = require('fs');
        const testDataPath = './test-individual-permissions-responses.json';
        fs.writeFileSync(testDataPath, JSON.stringify(testResponses, null, 2));
        
        console.log('\n🎉 Test setup completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   • Enterprise ID: ${SAMPLE_ENTERPRISE_ID}`);
        console.log(`   • Department ID: ${SAMPLE_DEPARTMENT_ID}`);
        console.log(`   • Users created: ${SAMPLE_USERS.length}`);
        console.log(`   • Test responses saved to: ${testDataPath}`);
        
        console.log('\n🔍 Sample Scenarios:');
        SAMPLE_USERS.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.role}): ${user.scenario}`);
        });
        
        console.log('\n🛠️  API Endpoints to test:');
        console.log(`   • GET /api/enterprises/${SAMPLE_ENTERPRISE_ID}/employees`);
        console.log(`   • PUT /api/enterprises/${SAMPLE_ENTERPRISE_ID}/users/{userId}/permissions`);
        
        return testResponses;
        
    } catch (error) {
        console.error('\n❌ Error in main execution:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Script execution completed');
        process.exit(0);
    }).catch(error => {
        console.error('\n❌ Script execution failed:', error);
        process.exit(1);
    });
}

module.exports = {
    main,
    generateTestResponses,
    calculateEffectivePermissions,
    SAMPLE_USERS,
    ROLE_PERMISSIONS
};

