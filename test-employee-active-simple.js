/**
 * Simple Test: Employee Active Status Updates
 * Tests that employee isActive field syncs with user active status
 */

const { db, admin } = require('./firebase');

async function testEmployeeActiveSync() {
    console.log('🚀 Testing Employee Active Status Sync...\n');
    
    try {
        // Find an enterprise employee
        const usersSnapshot = await db.collection('users')
            .where('enterpriseRef', '!=', null)
            .limit(5)
            .get();
            
        if (usersSnapshot.empty) {
            console.log('❌ No enterprise employees found');
            return false;
        }
        
        let testUser = null;
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (userData.employeeRef) {
                testUser = { id: userDoc.id, data: userData };
                break;
            }
        }
        
        if (!testUser) {
            console.log('❌ No users with employee references found');
            return false;
        }
        
        console.log(`📋 Test user: ${testUser.data.email} (${testUser.id})`);
        
        // Get employee document
        const employeeDoc = await testUser.data.employeeRef.get();
        if (!employeeDoc.exists) {
            console.log('❌ Employee document not found');
            return false;
        }
        
        console.log(`📍 Employee path: ${testUser.data.employeeRef.path}`);
        console.log(`📊 Initial employee isActive: ${employeeDoc.data().isActive}`);
        
        // TEST 1: Deactivate user and employee
        console.log('\n🔄 Testing deactivation...');
        
        await db.collection('users').doc(testUser.id).update({
            active: false,
            deactivatedAt: admin.firestore.Timestamp.now()
        });
        
        await testUser.data.employeeRef.update({
            isActive: false,
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        // Verify deactivation
        const deactivatedUser = await db.collection('users').doc(testUser.id).get();
        const deactivatedEmployee = await testUser.data.employeeRef.get();
        
        const userDeactivated = deactivatedUser.data().active === false;
        const employeeDeactivated = deactivatedEmployee.data().isActive === false;
        
        console.log(`   User active: ${deactivatedUser.data().active} ${userDeactivated ? '✅' : '❌'}`);
        console.log(`   Employee isActive: ${deactivatedEmployee.data().isActive} ${employeeDeactivated ? '✅' : '❌'}`);
        
        // TEST 2: Reactivate user and employee
        console.log('\n🔄 Testing reactivation...');
        
        await db.collection('users').doc(testUser.id).update({
            active: true,
            reactivatedAt: admin.firestore.Timestamp.now(),
            deactivatedAt: admin.firestore.FieldValue.delete()
        });
        
        await testUser.data.employeeRef.update({
            isActive: true,
            updatedAt: admin.firestore.Timestamp.now()
        });
        
        // Verify reactivation
        const reactivatedUser = await db.collection('users').doc(testUser.id).get();
        const reactivatedEmployee = await testUser.data.employeeRef.get();
        
        const userReactivated = reactivatedUser.data().active === true;
        const employeeReactivated = reactivatedEmployee.data().isActive === true;
        
        console.log(`   User active: ${reactivatedUser.data().active} ${userReactivated ? '✅' : '❌'}`);
        console.log(`   Employee isActive: ${reactivatedEmployee.data().isActive} ${employeeReactivated ? '✅' : '❌'}`);
        
        // Results
        const allTestsPassed = userDeactivated && employeeDeactivated && userReactivated && employeeReactivated;
        
        console.log('\n📊 RESULTS:');
        console.log(`   Deactivation sync: ${userDeactivated && employeeDeactivated ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Reactivation sync: ${userReactivated && employeeReactivated ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Overall: ${allTestsPassed ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        if (allTestsPassed) {
            console.log('\n🎉 Employee isActive field properly syncs with user active status!');
        } else {
            console.log('\n⚠️  Employee isActive sync may have issues. Check implementation.');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run test
if (require.main === module) {
    testEmployeeActiveSync()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = testEmployeeActiveSync;