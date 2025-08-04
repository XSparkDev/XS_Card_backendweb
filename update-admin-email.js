const { db, admin } = require('./firebase');

async function updateAdminEmail() {
  try {
    console.log('📧 Updating admin email to tshehlap@gmail.com...');
    
    // Update the admin user email
    await db.collection('users').doc('admin-user-456').update({
      name: 'Tshehlap',
      surname: 'Admin',
      email: 'tshehlap@gmail.com',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Admin email updated successfully!');
    
    // Verify the update
    const userDoc = await db.collection('users').doc('admin-user-456').get();
    const userData = userDoc.data();
    
    console.log('👤 Updated Admin User:');
    console.log(`  - Name: ${userData.name} ${userData.surname}`);
    console.log(`  - Email: ${userData.email}`);
    console.log(`  - Role: ${userData.role}`);
    
  } catch (error) {
    console.error('❌ Error updating admin email:', error);
  }
}

updateAdminEmail().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});