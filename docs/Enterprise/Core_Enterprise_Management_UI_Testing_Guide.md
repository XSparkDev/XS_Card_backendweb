# Core Enterprise Management - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Core Enterprise Management endpoints during end-to-end testing. All endpoints require Firebase authentication and return standardized JSON responses.

## Base Configuration

### Server URL
```
Base URL: http://localhost:8383
```

### Authentication
All endpoints require Firebase ID token in the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${firebaseIdToken}`,
  'Content-Type': 'application/json'
}
```

### Response Format
All endpoints return standardized responses:
```javascript
{
  status: boolean,
  message?: string,
  data?: object,
  error?: string
}
```

---

## 1. Authentication Setup

### Get Firebase ID Token
Before testing any endpoints, the UI must authenticate the user and get a Firebase ID token.

```javascript
// Using Firebase Auth
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(
  auth, 
  'testehakke@gufum.com', 
  '123456'
);

const idToken = await userCredential.user.getIdToken();
```

### Test Authentication
```javascript
const testAuth = async () => {
  try {
    const response = await fetch('http://localhost:8383/SignIn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testehakke@gufum.com',
        password: '123456'
      })
    });
    
    const result = await response.json();
    console.log('Auth Result:', result);
    return result.token;
  } catch (error) {
    console.error('Authentication failed:', error);
  }
};
```

---

## 2. Enterprise CRUD Operations

### 2.1 Get All Enterprises
```javascript
const getAllEnterprises = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/enterprise', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('All Enterprises:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get enterprises:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  data: [
    {
      id: "x-spark-test",
      name: "x-spark-test",
      description: "Test enterprise",
      industry: "Tech",
      website: "https://x-spark.com",
      logoUrl: "",
      colorScheme: "#000000",
      companySize: "10-50",
      address: { city: "Test City" },
      createdAt: { _seconds: 1753365960, _nanoseconds: 912000000 },
      updatedAt: { _seconds: 1753365960, _nanoseconds: 912000000 }
    }
    // ... more enterprises
  ]
}
```

### 2.2 Get Enterprise by ID
```javascript
const getEnterpriseById = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Details:', result);
    return result.data.enterprise;
  } catch (error) {
    console.error('Failed to get enterprise:', error);
  }
};
```

**Usage:**
```javascript
const enterprise = await getEnterpriseById(token, 'x-spark-test');
```

### 2.3 Create Enterprise
```javascript
const createEnterprise = async (token, enterpriseData) => {
  try {
    const response = await fetch('http://localhost:8383/enterprise', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(enterpriseData)
    });
    
    const result = await response.json();
    console.log('Enterprise Created:', result);
    return result.data.enterprise;
  } catch (error) {
    console.error('Failed to create enterprise:', error);
  }
};
```

**Usage:**
```javascript
const newEnterprise = await createEnterprise(token, {
  name: "UI Test Enterprise",
  description: "Enterprise created via UI testing",
  industry: "Technology",
  website: "https://ui-test.com",
  companySize: "1-10",
  colorScheme: "#1B2B5B",
  address: {
    street: "123 Test Street",
    city: "Test City",
    country: "Test Country"
  }
});
```

**Expected Response:**
```javascript
{
  status: true,
  message: "Enterprise created successfully",
  data: {
    enterprise: {
      id: "ui-test-enterprise",
      name: "UI Test Enterprise",
      // ... other fields
    }
  }
}
```

### 2.4 Update Enterprise
```javascript
const updateEnterprise = async (token, enterpriseId, updateData) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    console.log('Enterprise Updated:', result);
    return result.data.enterprise;
  } catch (error) {
    console.error('Failed to update enterprise:', error);
  }
};
```

**Usage:**
```javascript
const updatedEnterprise = await updateEnterprise(token, 'ui-test-enterprise', {
  description: "Updated description via UI",
  industry: "Software Development",
  colorScheme: "#FF5733"
});
```

### 2.5 Delete Enterprise
```javascript
const deleteEnterprise = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Deleted:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete enterprise:', error);
  }
};
```

**Usage:**
```javascript
const deleteResult = await deleteEnterprise(token, 'ui-test-enterprise');
```

---

## 3. Enterprise Statistics

### 3.1 Get Enterprise Statistics
```javascript
const getEnterpriseStats = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Stats:', result);
    return result.data.stats;
  } catch (error) {
    console.error('Failed to get enterprise stats:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  data: {
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      departments: 0,
      lastActivity: "2025-01-27T10:00:00.000Z"
    }
  }
}
```

---

## 4. Enterprise Billing & Sales

### 4.1 Get Enterprise Invoices
```javascript
const getEnterpriseInvoices = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/enterprise/invoices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Invoices:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get invoices:', error);
  }
};
```

**Note:** This endpoint requires the user to be associated with an enterprise.

### 4.2 Submit Demo Request
```javascript
const submitDemoRequest = async (token, demoData) => {
  try {
    const response = await fetch('http://localhost:8383/enterprise/demo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(demoData)
    });
    
    const result = await response.json();
    console.log('Demo Request Submitted:', result);
    return result;
  } catch (error) {
    console.error('Failed to submit demo request:', error);
  }
};
```

**Usage:**
```javascript
const demoResult = await submitDemoRequest(token, {
  companyName: "UI Test Company",
  contactPersonName: "John Doe",
  email: "john@uitest.com",
  phone: "+1234567890",
  companySize: "10-50",
  industry: "Technology",
  estimatedUsers: 25,
  specificRequirements: "Need enterprise features for UI testing",
  preferredContactTime: "morning"
});
```

**Expected Response:**
```javascript
{
  status: true,
  message: "Demo request submitted successfully",
  data: {
    inquiryId: "demo_ABC123",
    expectedResponse: "within 24 hours"
  }
}
```

### 4.3 Submit Enterprise Inquiry
```javascript
const submitEnterpriseInquiry = async (token, inquiryData) => {
  try {
    const response = await fetch('http://localhost:8383/enterprise/inquiry', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inquiryData)
    });
    
    const result = await response.json();
    console.log('Enterprise Inquiry Submitted:', result);
    return result;
  } catch (error) {
    console.error('Failed to submit inquiry:', error);
  }
};
```

**Usage:**
```javascript
const inquiryResult = await submitEnterpriseInquiry(token, {
  companyName: "UI Inquiry Company",
  contactPersonName: "Jane Smith",
  email: "jane@inquiry.com",
  inquiryType: "pricing",
  estimatedUsers: 50,
  budget: "5000-10000",
  timeline: "Q2 2025"
});
```

---

## 5. Contact Aggregation (High-Performance Caching)

### 5.1 Get Enterprise Contacts Summary
```javascript
const getEnterpriseContactsSummary = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/contacts/summary`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Contacts Summary:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get contacts summary:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  data: {
    enterpriseId: "x-spark-test",
    enterpriseName: "x-spark-test",
    totalContacts: 10,
    totalEmployees: 1,
    totalDepartments: 1,
    lastUpdated: "2025-01-27T10:00:00.000Z"
  }
}
```

### 5.2 Get Enterprise Contacts Details
```javascript
const getEnterpriseContactsDetails = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/contacts/details`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Enterprise Contacts Details:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get contacts details:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  success: true,
  cached: false,
  data: {
    enterpriseId: "x-spark-test",
    enterpriseName: "x-spark-test",
    totalContacts: 10,
    totalDepartments: 1,
    departments: [
      {
        departmentId: "dept123",
        departmentName: "Engineering",
        contactCount: 5,
        employeeCount: 1
      }
    ],
    contacts: [
      {
        id: "contact123",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        department: "Engineering"
      }
      // ... more contacts
    ]
  }
}
```

---

## 6. Cache Management (Admin/Debugging)

### 6.1 Get Cache Statistics
```javascript
const getCacheStats = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/cache/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Cache Stats:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
  }
};
```

### 6.2 Get Cache Configuration
```javascript
const getCacheConfig = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/cache/config', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Cache Config:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get cache config:', error);
  }
};
```

### 6.3 Update Cache Configuration
```javascript
const updateCacheConfig = async (token, config) => {
  try {
    const response = await fetch('http://localhost:8383/cache/config', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    const result = await response.json();
    console.log('Cache Config Updated:', result);
    return result;
  } catch (error) {
    console.error('Failed to update cache config:', error);
  }
};
```

**Usage:**
```javascript
const configResult = await updateCacheConfig(token, {
  ttl: 300, // 5 minutes
  maxSize: 1000,
  enableAnalytics: true
});
```

### 6.4 Clear All Cache
```javascript
const clearAllCache = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/cache/clear', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Cache Cleared:', result);
    return result;
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};
```

---

## 7. Development/Testing Endpoints

### 7.1 Create Sample Invoices
```javascript
const createSampleInvoices = async (token, enterpriseId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/create-sample-invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Sample Invoices Created:', result);
    return result;
  } catch (error) {
    console.error('Failed to create sample invoices:', error);
  }
};
```

**Note:** This endpoint is only available in non-production environments.

---

## 8. Complete UI Testing Workflow

### 8.1 Setup Function
```javascript
const setupEnterpriseTesting = async () => {
  // 1. Authenticate
  const token = await testAuth();
  if (!token) {
    console.error('Authentication failed');
    return null;
  }
  
  console.log('✅ Authentication successful');
  return token;
};
```

### 8.2 CRUD Testing Workflow
```javascript
const testEnterpriseCRUD = async (token) => {
  console.log('🧪 Testing Enterprise CRUD Operations...');
  
  // 1. Get all enterprises
  const enterprises = await getAllEnterprises(token);
  console.log('📋 Found', enterprises.length, 'enterprises');
  
  // 2. Create new enterprise
  const newEnterprise = await createEnterprise(token, {
    name: "UI CRUD Test Enterprise",
    description: "Testing CRUD operations",
    industry: "Technology",
    website: "https://crud-test.com"
  });
  console.log('✅ Created enterprise:', newEnterprise.id);
  
  // 3. Get enterprise by ID
  const retrievedEnterprise = await getEnterpriseById(token, newEnterprise.id);
  console.log('✅ Retrieved enterprise:', retrievedEnterprise.name);
  
  // 4. Update enterprise
  const updatedEnterprise = await updateEnterprise(token, newEnterprise.id, {
    description: "Updated via CRUD test",
    colorScheme: "#FF5733"
  });
  console.log('✅ Updated enterprise');
  
  // 5. Get enterprise stats
  const stats = await getEnterpriseStats(token, newEnterprise.id);
  console.log('✅ Retrieved enterprise stats');
  
  // 6. Delete enterprise
  const deleteResult = await deleteEnterprise(token, newEnterprise.id);
  console.log('✅ Deleted enterprise');
  
  return {
    created: newEnterprise.id,
    deleted: deleteResult.data.id
  };
};
```

### 8.3 Contact Aggregation Testing
```javascript
const testContactAggregation = async (token) => {
  console.log('🧪 Testing Contact Aggregation...');
  
  const enterpriseId = 'x-spark-test';
  
  // 1. Get contacts summary
  const summary = await getEnterpriseContactsSummary(token, enterpriseId);
  console.log('✅ Contacts summary:', summary.totalContacts, 'contacts');
  
  // 2. Get contacts details
  const details = await getEnterpriseContactsDetails(token, enterpriseId);
  console.log('✅ Contacts details retrieved, cached:', details.cached);
  
  // 3. Test cache performance (second request should be cached)
  const details2 = await getEnterpriseContactsDetails(token, enterpriseId);
  console.log('✅ Second request cached:', details2.cached);
  
  return { summary, details };
};
```

### 8.4 Billing & Sales Testing
```javascript
const testBillingAndSales = async (token) => {
  console.log('🧪 Testing Billing & Sales...');
  
  // 1. Submit demo request
  const demoResult = await submitDemoRequest(token, {
    companyName: "UI Demo Test Company",
    contactPersonName: "Demo User",
    email: "demo@uitest.com",
    companySize: "10-50",
    industry: "Technology"
  });
  console.log('✅ Demo request submitted:', demoResult.data.inquiryId);
  
  // 2. Submit enterprise inquiry
  const inquiryResult = await submitEnterpriseInquiry(token, {
    companyName: "UI Inquiry Test Company",
    contactPersonName: "Inquiry User",
    email: "inquiry@uitest.com",
    inquiryType: "pricing"
  });
  console.log('✅ Inquiry submitted:', inquiryResult.data.inquiryId);
  
  return { demoResult, inquiryResult };
};
```

### 8.5 Cache Management Testing
```javascript
const testCacheManagement = async (token) => {
  console.log('🧪 Testing Cache Management...');
  
  // 1. Get cache stats
  const stats = await getCacheStats(token);
  console.log('✅ Cache stats retrieved');
  
  // 2. Get cache config
  const config = await getCacheConfig(token);
  console.log('✅ Cache config retrieved');
  
  // 3. Update cache config
  const updateResult = await updateCacheConfig(token, {
    ttl: 600, // 10 minutes
    maxSize: 2000
  });
  console.log('✅ Cache config updated');
  
  // 4. Clear cache
  const clearResult = await clearAllCache(token);
  console.log('✅ Cache cleared');
  
  return { stats, config, updateResult, clearResult };
};
```

### 8.6 Complete Test Suite
```javascript
const runCompleteEnterpriseTest = async () => {
  console.log('🚀 Starting Complete Enterprise Management Test Suite...');
  
  try {
    // Setup
    const token = await setupEnterpriseTesting();
    if (!token) return;
    
    // Run all test suites
    const crudResults = await testEnterpriseCRUD(token);
    const aggregationResults = await testContactAggregation(token);
    const billingResults = await testBillingAndSales(token);
    const cacheResults = await testCacheManagement(token);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      crud: crudResults,
      aggregation: aggregationResults,
      billing: billingResults,
      cache: cacheResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 9. Error Handling Examples

### 9.1 Authentication Error
```javascript
const handleAuthError = (error) => {
  if (error.status === 401) {
    console.error('Authentication failed - please login again');
    // Redirect to login page
  }
};
```

### 9.2 Enterprise Not Found
```javascript
const handleEnterpriseNotFound = (error) => {
  if (error.status === 404) {
    console.error('Enterprise not found');
    // Show appropriate UI message
  }
};
```

### 9.3 Validation Error
```javascript
const handleValidationError = (error) => {
  if (error.status === 400) {
    console.error('Validation failed:', error.message);
    // Show validation errors in UI
  }
};
```

---

## 10. Performance Testing

### 10.1 Contact Aggregation Performance
```javascript
const testContactAggregationPerformance = async (token, enterpriseId) => {
  console.log('⚡ Testing Contact Aggregation Performance...');
  
  const iterations = 10;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await getEnterpriseContactsSummary(token, enterpriseId);
    const end = performance.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`📊 Average response time: ${avgTime.toFixed(2)}ms`);
  console.log(`📊 Fastest: ${Math.min(...times).toFixed(2)}ms`);
  console.log(`📊 Slowest: ${Math.max(...times).toFixed(2)}ms`);
  
  return { times, avgTime };
};
```

---

## 11. UI Integration Notes

### 11.1 Loading States
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchEnterprises = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const enterprises = await getAllEnterprises(token);
    setEnterprises(enterprises);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 11.2 Real-time Updates
```javascript
// Refresh data after CRUD operations
const refreshData = async () => {
  const enterprises = await getAllEnterprises(token);
  setEnterprises(enterprises);
};

// After creating/updating/deleting
await createEnterprise(token, data);
await refreshData(); // Refresh the list
```

### 11.3 Error Boundaries
```javascript
const EnterpriseErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <div>Something went wrong with enterprise operations.</div>;
  }
  
  return children;
};
```

---

## 12. Testing Checklist

### ✅ Pre-Testing Setup
- [ ] Server running on localhost:8383
- [ ] Firebase authentication configured
- [ ] Test user credentials available
- [ ] Network connectivity confirmed

### ✅ Authentication Testing
- [ ] Sign-in endpoint working
- [ ] Token retrieval successful
- [ ] Token validation working

### ✅ CRUD Operations Testing
- [ ] Get all enterprises
- [ ] Get enterprise by ID
- [ ] Create enterprise
- [ ] Update enterprise
- [ ] Delete enterprise
- [ ] Get enterprise statistics

### ✅ Billing & Sales Testing
- [ ] Submit demo request
- [ ] Submit enterprise inquiry
- [ ] Get enterprise invoices (if applicable)

### ✅ Contact Aggregation Testing
- [ ] Get contacts summary
- [ ] Get contacts details
- [ ] Verify caching behavior
- [ ] Test performance

### ✅ Cache Management Testing
- [ ] Get cache statistics
- [ ] Get cache configuration
- [ ] Update cache configuration
- [ ] Clear cache

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Enterprise not found
- [ ] Validation errors
- [ ] Network errors

### ✅ Performance Testing
- [ ] Response time measurements
- [ ] Cache hit/miss ratios
- [ ] Concurrent request handling

---

This guide provides comprehensive coverage for testing all Core Enterprise Management endpoints. Use the provided code examples and workflows to ensure thorough end-to-end testing of the enterprise system. 