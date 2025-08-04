const http = require('http');

function testXSparkAPI() {
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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

async function runTest() {
  try {
    console.log('🧪 Testing x-spark-test API access...');
    console.log('🔐 Using test token with user: DW1QbgLTiCgFxOBbvPKdjlLvIgo1');
    console.log('📧 Email: tshehlap@gmail.com');
    console.log('🏢 Enterprise: x-spark-test');
    console.log('');
    
    const result = await testXSparkAPI();
    
    console.log(`📊 Response Status: ${result.status}`);
    console.log('📋 Response Data:');
    console.log(JSON.stringify(result.data, null, 2));
    
    if (result.status === 200) {
      console.log('\n✅ SUCCESS! API access working correctly');
    } else {
      console.log('\n❌ FAILED! Check the error message above');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 