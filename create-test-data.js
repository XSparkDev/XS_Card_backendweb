const { db, admin } = require('./firebase');

async function createTestData() {
  try {
    console.log('🏗️ Creating test data for security alerts testing...');

    // Create test enterprise
    const enterpriseData = {
      name: 'Test Enterprise',
      description: 'Test enterprise for security alerts testing',
      industry: 'Technology',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('enterprise').doc('test-enterprise').set(enterpriseData);
    console.log('✅ Created test enterprise: test-enterprise');

    // Create test users
    const users = [
      {
        id: 'test-user-123',
        name: 'Test',
        surname: 'User',
        email: 'test.user@testenterprise.com',
        role: 'user',
        plan: 'premium',
        enterpriseRef: db.doc('enterprise/test-enterprise'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'admin-user-456',
        name: 'Tshehlap',
        surname: 'Admin',
        email: 'tshehlap@gmail.com',
        role: 'admin',
        plan: 'premium',
        enterpriseRef: db.doc('enterprise/test-enterprise'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'test-user-789',
        name: 'Another',
        surname: 'User',
        email: 'another.user@testenterprise.com',
        role: 'user',
        plan: 'premium',
        enterpriseRef: db.doc('enterprise/test-enterprise'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    for (const user of users) {
      await db.collection('users').doc(user.id).set(user);
      console.log(`✅ Created test user: ${user.id} (${user.role})`);
    }

    // Create some test activity logs that should trigger alerts
    const testLogs = [
      // Failed login attempts (should trigger alert)
      {
        action: 'error',
        resource: 'user',
        userId: 'test-user-123',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          operation: 'login',
          error: 'Invalid credentials',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser'
        }
      },
      {
        action: 'error',
        resource: 'user',
        userId: 'test-user-123',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          operation: 'login',
          error: 'Invalid credentials',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser'
        }
      },
      {
        action: 'error',
        resource: 'user',
        userId: 'test-user-123',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          operation: 'login',
          error: 'Invalid credentials',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser'
        }
      },
      {
        action: 'error',
        resource: 'user',
        userId: 'test-user-123',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          operation: 'login',
          error: 'Invalid credentials',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Test Browser'
        }
      },

      // Admin account creation (should trigger critical alert)
      {
        action: 'create',
        resource: 'user',
        userId: 'admin-user-456',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          role: 'admin',
          name: 'Admin User',
          email: 'admin.user@testenterprise.com',
          ipAddress: '10.0.0.50',
          operation: 'create_user'
        }
      },

      // Unusual login time (weekend)
      {
        action: 'login',
        resource: 'user',
        userId: 'test-user-789',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          ipAddress: '203.0.113.1',
          userAgent: 'Chrome/96.0',
          loginTime: new Date().toISOString()
        }
      },

      // System errors (should trigger system error alert when >5)
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      },
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      },
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      },
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      },
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      },
      {
        action: 'error',
        resource: 'system',
        userId: 'system',
        status: 'error',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          error: 'Database connection timeout',
          operation: 'query_execution'
        }
      }
    ];

    // Add test logs to activity logs collection
    for (let i = 0; i < testLogs.length; i++) {
      await db.collection('activityLogs').add(testLogs[i]);
      console.log(`✅ Created test activity log ${i + 1}/${testLogs.length}`);
    }

    console.log('');
    console.log('🎯 Test data creation complete!');
    console.log('');
    console.log('📊 Created:');
    console.log('  - 1 test enterprise (test-enterprise)');
    console.log('  - 3 test users (1 admin, 2 regular users)');
    console.log('  - 11 test activity logs (4 failed logins, 1 admin creation, 1 login, 6 system errors)');
    console.log('');
    console.log('⏱️ Wait 5-10 minutes for alert detection to process these logs');
    console.log('');
    console.log('🧪 Expected alerts:');
    console.log('  - Failed login attempts (HIGH severity)');
    console.log('  - Admin account created (CRITICAL severity)');
    console.log('  - System errors (HIGH severity)');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

// Run the function
createTestData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});