const { db } = require('./firebase');

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    const users = await db.collection('users').get();
    console.log(`\n📊 Found ${users.size} users:\n`);
    
    users.forEach(doc => {
      const data = doc.data();
      console.log(`👤 User ID: ${doc.id}`);
      console.log(`   Name: ${data.name} ${data.surname}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role || 'user'}`);
      console.log(`   Enterprise: ${data.enterpriseRef?.id || 'None'}`);
      console.log(`   Active: ${data.active !== false ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Check enterprises
    console.log('🏢 Checking enterprises...');
    const enterprises = await db.collection('enterprise').get();
    console.log(`\n📊 Found ${enterprises.size} enterprises:\n`);
    
    enterprises.forEach(doc => {
      const data = doc.data();
      console.log(`🏢 Enterprise ID: ${doc.id}`);
      console.log(`   Name: ${data.name || 'N/A'}`);
      console.log(`   Status: ${data.status || 'active'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
}

checkUsers().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 