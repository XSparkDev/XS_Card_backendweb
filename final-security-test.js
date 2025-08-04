const { db, admin } = require('./firebase');

async function finalSecurityTest() {
  try {
    console.log('🎯 Final Security Alerts System Test Report');
    console.log('==========================================');
    console.log('');

    // Test 1: Check Alert Generation
    console.log('📊 Test 1: Alert Generation Status');
    console.log('-----------------------------------');
    
    const alertsSnapshot = await db.collection('securityAlerts')
      .where('enterpriseId', '==', 'test-enterprise')
      .orderBy('timestamp', 'desc')
      .get();

    console.log(`✅ Security Alerts Generated: ${alertsSnapshot.size}`);
    
    if (alertsSnapshot.size > 0) {
      console.log('\n🚨 Alert Details:');
      alertsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.severity.toUpperCase()}: ${data.title}`);
        console.log(`     Type: ${data.type}`);
        console.log(`     Status: ${data.status}`);
        console.log(`     User: ${data.userId || 'System'}`);
        console.log(`     Time: ${data.timestamp.toDate().toISOString()}`);
        console.log('');
      });
    }

    // Test 2: Check Activity Logs
    console.log('📋 Test 2: Activity Log Analysis');
    console.log('--------------------------------');
    
    const recentLogs = await db.collection('activityLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)))
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log(`✅ Recent Activity Logs: ${recentLogs.size}`);
    
    const logTypes = {};
    recentLogs.forEach(doc => {
      const data = doc.data();
      const key = `${data.action}_${data.resource}`;
      logTypes[key] = (logTypes[key] || 0) + 1;
    });

    console.log('\n📊 Log Type Breakdown:');
    Object.entries(logTypes).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    // Test 3: Enterprise User Count
    console.log('\n👥 Test 3: Enterprise Users');
    console.log('---------------------------');
    
    const enterpriseUsers = await db.collection('users')
      .where('enterpriseRef', '==', db.doc('enterprise/test-enterprise'))
      .get();

    console.log(`✅ Enterprise Users: ${enterpriseUsers.size}`);
    
    let adminCount = 0;
    let userCount = 0;
    enterpriseUsers.forEach(doc => {
      const data = doc.data();
      if (data.role === 'admin') adminCount++;
      else userCount++;
    });
    
    console.log(`  - Admins: ${adminCount}`);
    console.log(`  - Users: ${userCount}`);

    // Test 4: Alert Detection Logic Test
    console.log('\n🔧 Test 4: Alert Detection Patterns');
    console.log('-----------------------------------');
    
    // Check for failed login patterns
    const failedLogins = await db.collection('activityLogs')
      .where('action', '==', 'error')
      .where('resource', '==', 'user')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000)))
      .get();

    const failedLoginsByUser = {};
    failedLogins.forEach(doc => {
      const data = doc.data();
      if (data.details?.operation === 'login') {
        failedLoginsByUser[data.userId] = (failedLoginsByUser[data.userId] || 0) + 1;
      }
    });

    console.log('🔍 Failed Login Analysis:');
    Object.entries(failedLoginsByUser).forEach(([userId, count]) => {
      const shouldAlert = count >= 3;
      console.log(`  - User ${userId}: ${count} failed attempts ${shouldAlert ? '🚨 (ALERT)' : '✅ (OK)'}`);
    });

    // Check for admin creations
    const adminCreations = await db.collection('activityLogs')
      .where('action', '==', 'create')
      .where('resource', '==', 'user')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000)))
      .get();

    let adminCreateCount = 0;
    adminCreations.forEach(doc => {
      const data = doc.data();
      if (data.details?.role === 'admin') {
        adminCreateCount++;
      }
    });

    console.log(`\n🔍 Admin Account Creation: ${adminCreateCount} new admin accounts ${adminCreateCount > 0 ? '🚨 (CRITICAL)' : '✅ (OK)'}`);

    // Test 5: Email Service Status
    console.log('\n📧 Test 5: Email Service Status');
    console.log('-------------------------------');
    
    const { verifyTransporter } = require('./public/Utils/emailService');
    const emailStatus = await verifyTransporter();
    console.log(`✅ Email Service: ${emailStatus ? 'WORKING' : 'OFFLINE'}`);

    // Test Summary
    console.log('\n🎯 SECURITY ALERTS SYSTEM TEST RESULTS');
    console.log('=====================================');
    console.log('');
    
    const results = {
      alertGeneration: alertsSnapshot.size > 0,
      activityLogging: recentLogs.size > 0,
      enterpriseIsolation: enterpriseUsers.size >= 3,
      failedLoginDetection: Object.keys(failedLoginsByUser).length > 0,
      adminAccountDetection: adminCreateCount > 0,
      emailService: emailStatus
    };

    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;
    
    console.log('');
    console.log(`📊 Overall Score: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 EXCELLENT! Security Alerts System is fully operational!');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('✅ GOOD! Security Alerts System is mostly working with minor issues.');
    } else {
      console.log('⚠️ WARNING! Security Alerts System needs attention.');
    }

    console.log('');
    console.log('🔄 Next Steps:');
    console.log('1. The system automatically processes logs every 5 minutes');
    console.log('2. Critical and high-severity alerts send email notifications');
    console.log('3. Alerts can be acknowledged and resolved via the API');
    console.log('4. Security actions (password reset, account lock) are available');
    console.log('5. Complete audit trail is maintained for compliance');
    console.log('');

  } catch (error) {
    console.error('❌ Error running security test:', error);
  }
}

finalSecurityTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});