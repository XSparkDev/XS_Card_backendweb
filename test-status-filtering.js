const { db } = require('./firebase');

async function testStatusFiltering() {
  try {
    console.log('🧪 Testing status filtering for x-spark-test enterprise...\n');
    
    // Test different status filters
    const testCases = [
      { status: 'active', description: 'Active alerts only' },
      { status: 'acknowledged', description: 'Acknowledged alerts only' },
      { status: 'resolved', description: 'Resolved alerts only' },
      { status: null, description: 'All alerts (no filter)' }
    ];
    
    for (const testCase of testCases) {
      console.log(`📊 Testing: ${testCase.description}`);
      
      // Get alerts with status filter
      let query = db.collection('securityAlerts')
        .where('enterpriseId', '==', 'x-spark-test');
      
      if (testCase.status) {
        query = query.where('status', '==', testCase.status);
      }
      
      const snapshot = await query.get();
      
      console.log(`   Found ${snapshot.size} alerts with status: ${testCase.status || 'all'}`);
      
      // Show first few alerts
      snapshot.docs.slice(0, 3).forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ${data.title} (${data.status})`);
      });
      console.log('');
    }
    
    // Test the actual API endpoint
    console.log('🌐 Testing API endpoint with different status filters...\n');
    
    const http = require('http');
    
    function testAPIEndpoint(status) {
      return new Promise((resolve, reject) => {
        const path = status ? 
          `/enterprise/x-spark-test/security/alerts?status=${status}` :
          '/enterprise/x-spark-test/security/alerts';
          
        const options = {
          hostname: 'localhost',
          port: 8383,
          path: path,
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
    
    const apiTestCases = [
      { status: 'active', description: 'Active alerts' },
      { status: 'acknowledged', description: 'Acknowledged alerts' },
      { status: 'resolved', description: 'Resolved alerts' },
      { status: null, description: 'All alerts' }
    ];
    
    for (const testCase of apiTestCases) {
      console.log(`🔍 Testing API: ${testCase.description}`);
      const result = await testAPIEndpoint(testCase.status);
      
      if (result.status === 200 && result.data.status === true) {
        const alerts = result.data.data.alerts;
        console.log(`   ✅ API returned ${alerts.length} alerts`);
        
        // Verify all returned alerts have the correct status
        if (testCase.status) {
          const correctStatus = alerts.every(alert => alert.status === testCase.status);
          console.log(`   ${correctStatus ? '✅' : '❌'} All alerts have correct status: ${testCase.status}`);
        }
        
        // Show first few alerts
        alerts.slice(0, 2).forEach((alert, index) => {
          console.log(`   ${index + 1}. ${alert.title} (${alert.status})`);
        });
      } else {
        console.log(`   ❌ API failed: ${result.status}`);
        console.log(`   Error: ${JSON.stringify(result.data)}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStatusFiltering().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 