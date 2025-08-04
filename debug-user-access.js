const { db, admin } = require('./firebase');

async function debugUserAccess() {
  try {
    console.log('🔍 Debugging user access to enterprise...');

    // Check the admin user
    const adminUserId = 'admin-user-456';
    const userDoc = await db.collection('users').doc(adminUserId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Admin user not found in database');
      return;
    }

    const userData = userDoc.data();
    console.log('👤 Admin User Data:');
    console.log('  - ID:', adminUserId);
    console.log('  - Name:', userData.name, userData.surname);
    console.log('  - Email:', userData.email);
    console.log('  - Role:', userData.role);
    console.log('  - Enterprise Ref:', userData.enterpriseRef);
    
    if (userData.enterpriseRef) {
      console.log('  - Enterprise ID:', userData.enterpriseRef.id);
    } else {
      console.log('  - ❌ No enterprise reference found!');
    }

    // Check the test enterprise
    const enterpriseDoc = await db.collection('enterprise').doc('test-enterprise').get();
    if (enterpriseDoc.exists) {
      console.log('\n🏢 Test Enterprise Data:');
      const enterpriseData = enterpriseDoc.data();
      console.log('  - Name:', enterpriseData.name);
      console.log('  - ID: test-enterprise');
    } else {
      console.log('\n❌ Test enterprise not found!');
    }

    // Get all users in the test enterprise
    const enterpriseUsersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc('enterprise/test-enterprise'))
      .get();

    console.log(`\n👥 Users in test-enterprise (${enterpriseUsersSnapshot.size} found):`);
    enterpriseUsersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.name} ${data.surname} (${data.role}) - ${data.email}`);
    });

    // Test the authentication check logic
    console.log('\n🔐 Testing authentication logic:');
    const userEnterpriseId = userData.enterpriseRef?.id;
    const targetEnterpriseId = 'test-enterprise';
    
    console.log('  - User Enterprise ID:', userEnterpriseId);
    console.log('  - Target Enterprise ID:', targetEnterpriseId);
    console.log('  - Access Check:', userEnterpriseId === targetEnterpriseId ? '✅ ALLOWED' : '❌ DENIED');

  } catch (error) {
    console.error('❌ Error debugging user access:', error);
  }
}

debugUserAccess().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});