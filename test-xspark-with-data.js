const { db, admin } = require('./firebase');

async function testXSparkWithData() {
  try {
    console.log('🧪 Testing x-spark-test with test data...\n');
    
    // Create some test alerts for x-spark-test
    console.log('📝 Creating test alerts...');
    
    const testAlerts = [
      {
        enterpriseId: 'x-spark-test',
        title: 'Test Failed Login Attempts',
        description: 'User test-user-123 has 5 failed login attempts',
        type: 'failed_login_attempts',
        severity: 'high',
        status: 'active',
        userId: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          attemptCount: 5,
          timeWindow: '5 minutes'
        }
      },
      {
        enterpriseId: 'x-spark-test',
        title: 'Test Admin Account Created',
        description: 'New admin account created outside normal hours',
        type: 'admin_account_created',
        severity: 'critical',
        status: 'active',
        userId: 'tpNykUrXytMDFWrv8PxY3TBfr1k2',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          ipAddress: '203.0.113.99',
          userAgent: 'curl/7.68.0',
          createdBy: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
          operation: 'create_user'
        }
      },
      {
        enterpriseId: 'x-spark-test',
        title: 'Test Unusual Login Time',
        description: 'Login activity during weekend/night hours',
        type: 'unusual_login_time',
        severity: 'medium',
        status: 'acknowledged',
        userId: 'QhegOMZ8F2Sw0Omg19yO',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          ipAddress: '10.0.0.50',
          userAgent: 'Chrome/120.0.0.0',
          loginTime: new Date().toISOString(),
          location: 'Unknown Location'
        }
      }
    ];
    
    // Add test alerts
    for (const alertData of testAlerts) {
      await db.collection('securityAlerts').add(alertData);
      console.log(`✅ Created alert: ${alertData.title}`);
    }
    
    console.log('\n📊 Test alerts created successfully!');
    console.log('🔍 Now testing API access...\n');
    
    // Test the API
    const http = require('http');
    
    function testAPI() {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 8383,
          path: '/enterprise/x-spark-test/security/alerts',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test_token_admin',
            'Content-Type': 'application/json'
          }
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve({ status: res.statusCode, data: result });
            } catch (e) {
              resolve({ status: res.statusCode, data: data });
            }
          });
        });

        req.on('error', reject);
        req.end();
      });
    }
    
    const result = await testAPI();
    
    console.log(`📊 Response Status: ${result.status}`);
    console.log('📋 Response Data:');
    console.log(JSON.stringify(result.data, null, 2));
    
    if (result.status === 200 && result.data.status === true) {
      console.log('\n✅ SUCCESS! API working with data');
      console.log(`📊 Found ${result.data.data.alerts.length} alerts`);
      console.log(`📊 Total count: ${result.data.data.totalCount}`);
      console.log(`📊 Unacknowledged: ${result.data.data.unacknowledgedCount}`);
      console.log(`📊 Critical: ${result.data.data.criticalCount}`);
    } else {
      console.log('\n❌ FAILED! Check the error message above');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testXSparkWithData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 