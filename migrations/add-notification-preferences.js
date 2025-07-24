const { db } = require('../firebase');

/**
 * Migration script to add notification preferences to existing users
 */
const addNotificationPreferences = async () => {
  try {
    console.log('🚀 Starting notification preferences migration...');
    
    const DEFAULT_PREFERENCES = {
      weeklyDigest: true,
      teamUpdates: true,
      securityAlerts: true,
      usageReports: true,
      adminNotifications: true,
      integrationUpdates: true,
      emailNotifications: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users to process`);
    
    if (usersSnapshot.empty) {
      console.log('✅ No users found to migrate');
      return;
    }
    
    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    const users = usersSnapshot.docs;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = db.batch();
      const batchUsers = users.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`);
      
      batchUsers.forEach(doc => {
        const userData = doc.data();
        
        // Only add preferences if they don't already exist
        if (!userData.notificationPreferences) {
          const userRef = db.collection('users').doc(doc.id);
          batch.update(userRef, {
            notificationPreferences: DEFAULT_PREFERENCES
          });
          updated++;
        } else {
          // Check if user has all the new enterprise fields
          const existingPrefs = userData.notificationPreferences;
          const missingFields = {};
          
          // Check for new enterprise fields
          if (existingPrefs.securityAlerts === undefined) {
            missingFields['notificationPreferences.securityAlerts'] = true;
          }
          if (existingPrefs.usageReports === undefined) {
            missingFields['notificationPreferences.usageReports'] = true;
          }
          if (existingPrefs.adminNotifications === undefined) {
            missingFields['notificationPreferences.adminNotifications'] = true;
          }
          if (existingPrefs.integrationUpdates === undefined) {
            missingFields['notificationPreferences.integrationUpdates'] = true;
          }
          if (existingPrefs.updatedAt === undefined) {
            missingFields['notificationPreferences.updatedAt'] = new Date().toISOString();
          }
          
          if (Object.keys(missingFields).length > 0) {
            const userRef = db.collection('users').doc(doc.id);
            batch.update(userRef, missingFields);
            updated++;
          } else {
            skipped++;
          }
        }
        
        processed++;
      });
      
      // Commit the batch
      if (batchUsers.some(doc => !doc.data().notificationPreferences || 
                        Object.keys(doc.data().notificationPreferences).length < 7)) {
        await batch.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} committed successfully`);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • Total users processed: ${processed}`);
    console.log(`   • Users updated: ${updated}`);
    console.log(`   • Users skipped (already had preferences): ${skipped}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Rollback migration (for testing purposes)
 */
const rollbackNotificationPreferences = async () => {
  try {
    console.log('🔄 Rolling back notification preferences migration...');
    
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Found ${usersSnapshot.size} users to rollback`);
    
    if (usersSnapshot.empty) {
      console.log('✅ No users found to rollback');
      return;
    }
    
    const batch = db.batch();
    let processed = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      if (userData.notificationPreferences) {
        const userRef = db.collection('users').doc(doc.id);
        batch.update(userRef, {
          notificationPreferences: db.FieldValue.delete()
        });
        processed++;
      }
    });
    
    if (processed > 0) {
      await batch.commit();
      console.log(`✅ Rollback completed: ${processed} users processed`);
    } else {
      console.log('✅ No users had notification preferences to rollback');
    }
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
};

/**
 * Validate migration results
 */
const validateMigration = async () => {
  try {
    console.log('🔍 Validating migration results...');
    
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    let usersWithPreferences = 0;
    let usersWithCompletePreferences = 0;
    
    const requiredFields = [
      'weeklyDigest',
      'teamUpdates', 
      'securityAlerts',
      'usageReports',
      'adminNotifications',
      'integrationUpdates',
      'emailNotifications'
    ];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      if (userData.notificationPreferences) {
        usersWithPreferences++;
        
        const prefs = userData.notificationPreferences;
        const hasAllFields = requiredFields.every(field => 
          prefs.hasOwnProperty(field) && typeof prefs[field] === 'boolean'
        );
        
        if (hasAllFields) {
          usersWithCompletePreferences++;
        }
      }
    });
    
    console.log('\n📊 Migration Validation Results:');
    console.log(`   • Total users: ${totalUsers}`);
    console.log(`   • Users with preferences: ${usersWithPreferences}`);
    console.log(`   • Users with complete preferences: ${usersWithCompletePreferences}`);
    console.log(`   • Success rate: ${((usersWithCompletePreferences / totalUsers) * 100).toFixed(1)}%`);
    
    if (usersWithCompletePreferences === totalUsers) {
      console.log('✅ Migration validation successful!');
    } else {
      console.log('⚠️  Some users may need manual intervention');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'rollback':
      rollbackNotificationPreferences()
        .then(() => process.exit(0))
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
      break;
    case 'validate':
      validateMigration()
        .then(() => process.exit(0))
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
      break;
    default:
      addNotificationPreferences()
        .then(() => process.exit(0))
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
  }
}

module.exports = { 
  addNotificationPreferences, 
  rollbackNotificationPreferences,
  validateMigration 
}; 