const { db } = require('../firebase.js');

async function testContactConsistency() {
    try {
        console.log('🔍 Testing Contact Consistency...');
        
        // Test 1: Check all contacts in database
        console.log('\n📊 Test 1: All Contacts in Database');
        const contactsSnapshot = await db.collection('contacts').get();
        console.log(`Total contact documents: ${contactsSnapshot.size}`);
        
        for (const doc of contactsSnapshot.docs) {
            const data = doc.data();
            const contactList = data.contactList || [];
            console.log(`User ${doc.id}: ${contactList.length} contacts`);
            
            contactList.forEach((contact, index) => {
                console.log(`  - ${index}: ${contact.name} ${contact.surname} (${contact.company || 'no company'})`);
            });
        }
        
        // Test 2: Check enterprise aggregation
        console.log('\n📊 Test 2: Enterprise Contact Aggregation');
        const enterpriseId = 'x-spark-test';
        
        // Get all employees
        const employeesSnapshot = await db.collection('enterprise')
            .doc(enterpriseId)
            .collection('departments')
            .doc('hr')
            .collection('employees')
            .get();
            
        console.log(`Total employees in HR department: ${employeesSnapshot.size}`);
        
        for (const empDoc of employeesSnapshot.docs) {
            const employeeData = empDoc.data();
            const userId = employeeData.userId ? employeeData.userId.id : null;
            
            console.log(`\nEmployee: ${employeeData.name} ${employeeData.surname} (${userId})`);
            
            if (userId) {
                const contactDoc = await db.collection('contacts').doc(userId).get();
                if (contactDoc.exists) {
                    const contactList = contactDoc.data().contactList || [];
                    console.log(`  ✅ Has contact list: ${contactList.length} contacts`);
                    contactList.forEach((contact, index) => {
                        console.log(`    - ${index}: ${contact.name} ${contact.surname} (${contact.company || 'no company'})`);
                    });
                } else {
                    console.log(`  ❌ No contact list found`);
                }
            } else {
                console.log(`  ⚠️ No user ID`);
            }
        }
        
        // Test 3: Check for orphaned contacts
        console.log('\n📊 Test 3: Checking for Orphaned Contacts');
        const allUsersSnapshot = await db.collection('users').get();
        console.log(`Total users in database: ${allUsersSnapshot.size}`);
        
        for (const userDoc of allUsersSnapshot.docs) {
            const userId = userDoc.id;
            const contactDoc = await db.collection('contacts').doc(userId).get();
            
            if (contactDoc.exists) {
                const contactList = contactDoc.data().contactList || [];
                if (contactList.length > 0) {
                    console.log(`User ${userId}: ${contactList.length} contacts`);
                }
            }
        }
        
        console.log('\n✅ Contact consistency test completed!');
        
    } catch (error) {
        console.error('❌ Error testing contact consistency:', error);
    }
}

// Run the test
testContactConsistency()
    .then(() => {
        console.log('✅ Test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }); 