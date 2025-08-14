const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8383';
const TEST_USER_ID = 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1';
const AUTH_TOKEN = 'test_token_1754676066482_email_signature_test';

// Create axios instance with auth headers
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

async function testRoutes() {
    console.log('🧪 Testing route accessibility...');
    
    const routes = [
        { name: 'Root', path: '/', method: 'GET' },
        { name: 'Signature Templates', path: '/public/signature-templates', method: 'GET' },
        { name: 'User Signature GET', path: `/Users/${TEST_USER_ID}/email-signature`, method: 'GET' },
        { name: 'User Signature PATCH', path: `/Users/${TEST_USER_ID}/email-signature`, method: 'PATCH' },
        { name: 'Signature Preview', path: `/Users/${TEST_USER_ID}/signature-preview`, method: 'POST' },
        { name: 'Test Signature', path: `/Users/${TEST_USER_ID}/test-signature`, method: 'POST' }
    ];
    
    for (const route of routes) {
        try {
            console.log(`\n📋 Testing ${route.name} (${route.method} ${route.path})...`);
            
            let response;
            if (route.method === 'GET') {
                response = await api.get(route.path);
            } else if (route.method === 'POST') {
                response = await api.post(route.path, { test: true });
            } else if (route.method === 'PATCH') {
                response = await api.patch(route.path, { test: true });
            }
            
            console.log(`✅ ${route.name} - Status: ${response.status}`);
            console.log(`📝 Response:`, response.data);
            
        } catch (error) {
            console.log(`❌ ${route.name} - Status: ${error.response?.status || 'No response'}`);
            console.log(`📝 Error:`, error.response?.data || error.message);
        }
    }
}

// Run the test
testRoutes().catch(error => {
    console.error('💥 Test error:', error);
});







