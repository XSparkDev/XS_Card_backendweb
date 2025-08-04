const { db } = require('./firebase');

async function testXSparkAccess() {
  try {
    console.log('🔍 Testing access to x-spark-test enterprise...\n');
    
    // List all users in x-spark-test enterprise
    const xSparkUsers = await db.collection('users')
      .where('enterpriseRef', '==', db.doc('enterprise/x-spark-test'))
      .get();
    
    console.log(`📊 Found ${xSparkUsers.size} users in x-spark-test enterprise:\n`);
    
    xSparkUsers.forEach(doc => {
      const data = doc.data();
      console.log(`👤 User ID: ${doc.id}`);
      console.log(`   Name: ${data.name} ${data.surname}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role || 'user'}`);
      console.log(`   Active: ${data.active !== false ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Test API access with different users
    console.log('🧪 Testing API access...\n');
    
    const testUsers = [
      {
        uid: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
        email: 'tshehlap@gmail.com',
        name: 'Tshehlap User'
      },
      {
        uid: 'tpNykUrXytMDFWrv8PxY3TBfr1k2',
        email: 'ricese3211@f5urls.com',
        name: 'Admin User',
        role: 'Admininistrator'
      },
      {
        uid: 'QhegOMZ8F2Sw0Omg19yO',
        email: 'john.doe@test.com',
        name: 'John Doe'
      }
    ];
    
    for (const user of testUsers) {
      console.log(`🔐 Testing with user: ${user.name} (${user.email})`);
      console.log(`   User ID: ${user.uid}`);
      console.log(`   Role: ${user.role || 'user'}`);
      
      // Simulate the access check logic
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const userEnterpriseId = userData.enterpriseRef?.id;
        
        console.log(`   Enterprise: ${userEnterpriseId}`);
        
        if (userEnterpriseId === 'x-spark-test') {
          console.log(`   ✅ ACCESS GRANTED - User belongs to x-spark-test`);
        } else {
          console.log(`   ❌ ACCESS DENIED - User belongs to ${userEnterpriseId || 'None'}`);
        }
      } else {
        console.log(`   ❌ USER NOT FOUND`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error testing access:', error);
  }
}

testXSparkAccess().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 