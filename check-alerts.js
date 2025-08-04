const { db, admin } = require('./firebase');

async function checkAlerts() {
  try {
    console.log('🔍 Checking for generated security alerts...');
    console.log('');

    // Check activity logs
    const logsSnapshot = await db.collection('activityLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000)))
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    console.log(`📊 Recent Activity Logs (${logsSnapshot.size} found):`);
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.action} on ${data.resource} by ${data.userId} (${data.status || 'success'})`);
      if (data.details?.error) {
        console.log(`    Error: ${data.details.error}`);
      }
    });

    console.log('');

    // Check security alerts
    const alertsSnapshot = await db.collection('securityAlerts')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log(`🚨 Security Alerts Generated (${alertsSnapshot.size} found):`);
    if (alertsSnapshot.empty) {
      console.log('  No security alerts found yet.');
      console.log('  This is expected if:');
      console.log('  - Alert detection hasn\'t run yet (runs every 5 minutes)');
      console.log('  - Test data doesn\'t meet alert thresholds');
      console.log('  - There are errors in alert detection logic');
    } else {
      alertsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  🔴 ${data.severity.toUpperCase()}: ${data.title}`);
        console.log(`     Type: ${data.type}`);
        console.log(`     Enterprise: ${data.enterpriseId}`);
        console.log(`     User: ${data.userId || 'N/A'}`);
        console.log(`     Status: ${data.status}`);
        console.log(`     Time: ${data.timestamp.toDate().toISOString()}`);
        console.log('');
      });
    }

    // Check for enterprise users
    const usersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.doc('enterprise/test-enterprise'))
      .get();

    console.log(`👥 Enterprise Users (${usersSnapshot.size} found):`);
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.name} ${data.surname} (${data.role}) - ${data.email}`);
    });

    console.log('');

    // Manually trigger alert detection to test
    console.log('🔄 Manually triggering alert detection...');
    const { processActivityLogsForAlerts } = require('./controllers/enterprise/alertDetectionService');
    await processActivityLogsForAlerts();

    // Check alerts again after manual trigger
    const newAlertsSnapshot = await db.collection('securityAlerts')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log(`🚨 Security Alerts After Manual Detection (${newAlertsSnapshot.size} found):`);
    if (newAlertsSnapshot.empty) {
      console.log('  Still no security alerts found.');
      console.log('  Possible issues:');
      console.log('  - Alert detection logic has bugs');
      console.log('  - Test data doesn\'t match expected patterns');
      console.log('  - Database query issues');
    } else {
      newAlertsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  🔴 ${data.severity.toUpperCase()}: ${data.title}`);
        console.log(`     Type: ${data.type}`);
        console.log(`     Enterprise: ${data.enterpriseId}`);
        console.log(`     Status: ${data.status}`);
        console.log('');
      });
    }

    console.log('✅ Alert check complete!');

  } catch (error) {
    console.error('❌ Error checking alerts:', error);
  }
}

checkAlerts().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});