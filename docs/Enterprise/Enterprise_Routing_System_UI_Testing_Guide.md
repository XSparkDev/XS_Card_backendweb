# Enterprise Routing System - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Enterprise Routing System endpoints during end-to-end testing. This system provides a complete set of enterprise management, billing, contact aggregation, and caching endpoints with proper authentication and error handling.

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

### Enterprise Routing System Features
- **Core Enterprise Management**: CRUD operations for enterprises
- **Enterprise Billing**: Invoice management and billing operations
- **Contact Aggregation**: High-performance contact data aggregation with caching
- **Cache Management**: Advanced cache control and configuration
- **Demo & Inquiry System**: Enterprise demo requests and inquiries
- **Activity Logging**: Comprehensive audit trail for all operations

---

## 1. Authentication Setup

### Get Firebase ID Token
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

## 2. Core Enterprise Management Endpoints

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
      industry: "Technology",
      website: "https://example.com",
      logoUrl: "",
      colorScheme: "",
      companySize: "",
      address: {},
      createdAt: "2025-01-XX...",
      updatedAt: "2025-01-XX..."
    }
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
  name: "New Test Enterprise",
  description: "A new test enterprise",
  industry: "Technology",
  website: "https://newenterprise.com",
  companySize: "50-100"
});
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

### 2.6 Get Enterprise Statistics
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
      lastActivity: "2025-01-XX..."
    }
  }
}
```

---

## 3. Enterprise Billing Endpoints

### 3.1 Get Enterprise Invoices
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
    console.error('Failed to get enterprise invoices:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  data: [
    {
      id: "invoice123",
      waveAppsInvoiceId: "WA_INV_001",
      number: "INV-2025-001",
      date: "2025-01-01",
      dueDate: "2025-01-31",
      amount: 12000.00,
      currency: "ZAR",
      status: "paid",
      downloadUrl: "/api/billing/invoices/invoice123/download",
      lineItems: [
        {
          description: "XSCard Enterprise License - January 2025",
          quantity: 1,
          rate: 12000.00,
          amount: 12000.00
        }
      ]
    }
  ]
}
```

### 3.2 Download Invoice
```javascript
const downloadInvoice = async (token, invoiceId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/invoices/${invoiceId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Invoice Download:', result);
    return result;
  } catch (error) {
    console.error('Failed to download invoice:', error);
  }
};
```

### 3.3 Submit Demo Request
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
    return result.data;
  } catch (error) {
    console.error('Failed to submit demo request:', error);
  }
};
```

**Usage:**
```javascript
const demoResult = await submitDemoRequest(token, {
  companyName: "Test Company",
  contactPersonName: "John Doe",
  email: "john@testcompany.com",
  phone: "+1234567890",
  companySize: "50-100",
  industry: "Technology",
  estimatedUsers: 75,
  specificRequirements: "Need enterprise features",
  preferredContactTime: "Afternoon"
});
```

**Expected Response:**
```javascript
{
  status: true,
  message: "Demo request submitted successfully",
  data: {
    inquiryId: "demo_abc123",
    expectedResponse: "within 24 hours"
  }
}
```

### 3.4 Submit Enterprise Inquiry
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
    return result.data;
  } catch (error) {
    console.error('Failed to submit enterprise inquiry:', error);
  }
};
```

**Usage:**
```javascript
const inquiryResult = await submitEnterpriseInquiry(token, {
  companyName: "Test Company",
  contactPersonName: "Jane Doe",
  email: "jane@testcompany.com",
  inquiryType: "pricing"
});
```

**Expected Response:**
```javascript
{
  status: true,
  message: "Enterprise inquiry submitted successfully",
  data: {
    inquiryId: "inquiry_xyz789",
    expectedResponse: "within 2 business days"
  }
}
```

### 3.5 Create Sample Invoices (Development Only)
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
    return result.data;
  } catch (error) {
    console.error('Failed to create sample invoices:', error);
  }
};
```

**Expected Response:**
```javascript
{
  status: true,
  message: "Sample invoices created successfully",
  data: {
    invoicesCreated: 2,
    enterpriseId: "x-spark-test"
  }
}
```

---

## 4. Contact Aggregation Endpoints

### 4.1 Get Enterprise Contacts Summary
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
    console.error('Failed to get enterprise contacts summary:', error);
  }
};
```

### 4.2 Get Department Contacts Summary
```javascript
const getDepartmentContactsSummary = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/contacts/summary`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Contacts Summary:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get department contacts summary:', error);
  }
};
```

### 4.3 Get Enterprise Contacts with Details
```javascript
const getEnterpriseContactsWithDetails = async (token, enterpriseId) => {
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
    console.error('Failed to get enterprise contacts details:', error);
  }
};
```

### 4.4 Get Department Contacts with Details
```javascript
const getDepartmentContactsWithDetails = async (token, enterpriseId, departmentId) => {
  try {
    const response = await fetch(`http://localhost:8383/enterprise/${enterpriseId}/departments/${departmentId}/contacts/details`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Contacts Details:', result);
    return result.data;
  } catch (error) {
    console.error('Failed to get department contacts details:', error);
  }
};
```

---

## 5. Cache Management Endpoints

### 5.1 Get Cache Statistics
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
    return result.cache;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
  }
};
```

### 5.2 Clear All Cache
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

### 5.3 Invalidate Department Caches
```javascript
const invalidateDepartmentCaches = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/cache/departments/clear', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Department Caches Invalidated:', result);
    return result;
  } catch (error) {
    console.error('Failed to invalidate department caches:', error);
  }
};
```

### 5.4 Warm Cache for Enterprises
```javascript
const warmCacheForEnterprises = async (token, enterpriseIds) => {
  try {
    const response = await fetch('http://localhost:8383/cache/warm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enterpriseIds })
    });
    
    const result = await response.json();
    console.log('Cache Warming Results:', result);
    return result.results;
  } catch (error) {
    console.error('Failed to warm cache:', error);
  }
};
```

### 5.5 Get Cache Configuration
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
    return result.configuration;
  } catch (error) {
    console.error('Failed to get cache config:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  configuration: {
    ttlSettings: {},
    maxCacheSize: 1000,
    defaultTTL: 3600000
  },
  timestamp: "2025-07-24T20:55:03.658Z"
}
```

### 5.6 Update Cache Configuration
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
    return result.configuration;
  } catch (error) {
    console.error('Failed to update cache config:', error);
  }
};
```

**Usage:**
```javascript
const newConfig = await updateCacheConfig(token, {
  defaultTTL: 7200000, // 2 hours
  maxCacheSize: 2000,
  ttlSettings: {
    enterprise: 7200000,
    department: 3600000,
    highActivity: 1800000,
    lowActivity: 14400000
  }
});
```

### 5.7 Get Cache Analytics
```javascript
const getCacheAnalytics = async (token) => {
  try {
    const response = await fetch('http://localhost:8383/cache/analytics', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Cache Analytics:', result);
    return result.analytics;
  } catch (error) {
    console.error('Failed to get cache analytics:', error);
  }
};
```

---

## 6. Complete UI Testing Workflow

### 6.1 Setup Function
```javascript
const setupEnterpriseRoutingTesting = async () => {
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

### 6.2 Core Enterprise Management Testing
```javascript
const testCoreEnterpriseManagement = async (token, enterpriseId) => {
  console.log('🧪 Testing Core Enterprise Management...');
  
  // 1. Get all enterprises
  const allEnterprises = await getAllEnterprises(token);
  console.log('✅ All enterprises retrieved:', allEnterprises.length, 'enterprises');
  
  // 2. Get enterprise by ID
  const enterprise = await getEnterpriseById(token, enterpriseId);
  console.log('✅ Enterprise details retrieved:', enterprise.name);
  
  // 3. Get enterprise stats
  const stats = await getEnterpriseStats(token, enterpriseId);
  console.log('✅ Enterprise stats retrieved');
  
  // 4. Update enterprise
  const updatedEnterprise = await updateEnterprise(token, enterpriseId, {
    description: "Updated description via routing test"
  });
  console.log('✅ Enterprise updated');
  
  return {
    allEnterprises,
    enterprise,
    stats,
    updatedEnterprise
  };
};
```

### 6.3 Enterprise Billing Testing
```javascript
const testEnterpriseBilling = async (token, enterpriseId) => {
  console.log('🧪 Testing Enterprise Billing...');
  
  // 1. Submit demo request
  const demoResult = await submitDemoRequest(token, {
    companyName: "Routing Test Company",
    contactPersonName: "Test User",
    email: "test@routingtest.com",
    inquiryType: "demo"
  });
  console.log('✅ Demo request submitted:', demoResult.inquiryId);
  
  // 2. Submit enterprise inquiry
  const inquiryResult = await submitEnterpriseInquiry(token, {
    companyName: "Routing Test Company",
    contactPersonName: "Test User",
    email: "test@routingtest.com",
    inquiryType: "pricing"
  });
  console.log('✅ Enterprise inquiry submitted:', inquiryResult.inquiryId);
  
  // 3. Create sample invoices (development only)
  const sampleInvoices = await createSampleInvoices(token, enterpriseId);
  console.log('✅ Sample invoices created:', sampleInvoices.invoicesCreated, 'invoices');
  
  // 4. Get enterprise invoices
  const invoices = await getEnterpriseInvoices(token);
  console.log('✅ Enterprise invoices retrieved:', invoices.length, 'invoices');
  
  return {
    demoResult,
    inquiryResult,
    sampleInvoices,
    invoices
  };
};
```

### 6.4 Contact Aggregation Testing
```javascript
const testContactAggregation = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Contact Aggregation...');
  
  // 1. Get enterprise contacts summary
  const enterpriseSummary = await getEnterpriseContactsSummary(token, enterpriseId);
  console.log('✅ Enterprise contacts summary retrieved');
  
  // 2. Get department contacts summary
  const departmentSummary = await getDepartmentContactsSummary(token, enterpriseId, departmentId);
  console.log('✅ Department contacts summary retrieved');
  
  // 3. Get enterprise contacts with details
  const enterpriseDetails = await getEnterpriseContactsWithDetails(token, enterpriseId);
  console.log('✅ Enterprise contacts details retrieved');
  
  // 4. Get department contacts with details
  const departmentDetails = await getDepartmentContactsWithDetails(token, enterpriseId, departmentId);
  console.log('✅ Department contacts details retrieved');
  
  return {
    enterpriseSummary,
    departmentSummary,
    enterpriseDetails,
    departmentDetails
  };
};
```

### 6.5 Cache Management Testing
```javascript
const testCacheManagement = async (token, enterpriseId) => {
  console.log('🧪 Testing Cache Management...');
  
  // 1. Get cache stats
  const cacheStats = await getCacheStats(token);
  console.log('✅ Cache stats retrieved');
  
  // 2. Get cache config
  const cacheConfig = await getCacheConfig(token);
  console.log('✅ Cache config retrieved');
  
  // 3. Update cache config
  const updatedConfig = await updateCacheConfig(token, {
    defaultTTL: 7200000,
    maxCacheSize: 2000
  });
  console.log('✅ Cache config updated');
  
  // 4. Warm cache for enterprises
  const warmingResults = await warmCacheForEnterprises(token, [enterpriseId]);
  console.log('✅ Cache warmed for enterprises');
  
  // 5. Get cache analytics
  const cacheAnalytics = await getCacheAnalytics(token);
  console.log('✅ Cache analytics retrieved');
  
  // 6. Invalidate department caches
  const invalidationResult = await invalidateDepartmentCaches(token);
  console.log('✅ Department caches invalidated');
  
  // 7. Clear all cache
  const clearResult = await clearAllCache(token);
  console.log('✅ All cache cleared');
  
  return {
    cacheStats,
    cacheConfig,
    updatedConfig,
    warmingResults,
    cacheAnalytics,
    invalidationResult,
    clearResult
  };
};
```

### 6.6 Complete Test Suite
```javascript
const runCompleteEnterpriseRoutingTest = async () => {
  console.log('🚀 Starting Complete Enterprise Routing System Test Suite...');
  
  try {
    // Setup
    const token = await setupEnterpriseRoutingTesting();
    if (!token) return;
    
    const enterpriseId = 'x-spark-test';
    const departmentId = 'testdep';
    
    // Run all test suites
    const coreResults = await testCoreEnterpriseManagement(token, enterpriseId);
    const billingResults = await testEnterpriseBilling(token, enterpriseId);
    const aggregationResults = await testContactAggregation(token, enterpriseId, departmentId);
    const cacheResults = await testCacheManagement(token, enterpriseId);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      core: coreResults,
      billing: billingResults,
      aggregation: aggregationResults,
      cache: cacheResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 7. Error Handling Examples

### 7.1 Enterprise Not Found
```javascript
const handleEnterpriseNotFound = (error) => {
  if (error.status === 404) {
    console.error('Enterprise not found');
    // Show appropriate UI message
  }
};
```

### 7.2 Authentication Error
```javascript
const handleAuthenticationError = (error) => {
  if (error.status === 401) {
    console.error('Authentication required');
    // Redirect to login or show login modal
  }
};
```

### 7.3 Validation Error
```javascript
const handleValidationError = (error) => {
  if (error.status === 400) {
    console.error('Validation failed:', error.message);
    // Show validation errors in UI
  }
};
```

### 7.4 Cache Configuration Error
```javascript
const handleCacheConfigError = (error) => {
  if (error.status === 400) {
    console.error('Invalid cache configuration:', error.message);
    // Show configuration error in UI
  }
};
```

---

## 8. UI Integration Notes

### 8.1 Enterprise Dashboard
```javascript
const EnterpriseDashboard = ({ token, enterpriseId }) => {
  const [enterprise, setEnterprise] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadEnterpriseData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [enterpriseData, statsData] = await Promise.all([
        getEnterpriseById(token, enterpriseId),
        getEnterpriseStats(token, enterpriseId)
      ]);
      
      setEnterprise(enterpriseData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadEnterpriseData();
  }, [enterpriseId]);
  
  return (
    <div className="enterprise-dashboard">
      <div className="dashboard-header">
        <h2>Enterprise Dashboard</h2>
        {loading && <span>Loading...</span>}
        {error && <span className="error">Error: {error}</span>}
      </div>
      
      {enterprise && (
        <div className="enterprise-info">
          <h3>{enterprise.name}</h3>
          <p>{enterprise.description}</p>
          <div className="enterprise-stats">
            <span>Industry: {enterprise.industry}</span>
            <span>Size: {enterprise.companySize}</span>
          </div>
        </div>
      )}
      
      {stats && (
        <div className="stats-section">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Total Users:</span>
              <span className="value">{stats.totalUsers}</span>
            </div>
            <div className="stat">
              <span className="label">Active Users:</span>
              <span className="value">{stats.activeUsers}</span>
            </div>
            <div className="stat">
              <span className="label">Departments:</span>
              <span className="value">{stats.departments}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 8.2 Billing Management UI
```javascript
const BillingManagement = ({ token }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const invoiceData = await getEnterpriseInvoices(token);
      setInvoices(invoiceData);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDemoRequest = async (demoData) => {
    try {
      const result = await submitDemoRequest(token, demoData);
      console.log('Demo request submitted:', result);
      // Show success message
    } catch (error) {
      console.error('Failed to submit demo request:', error);
      // Show error message
    }
  };
  
  return (
    <div className="billing-management">
      <h3>Billing Management</h3>
      
      <div className="invoices-section">
        <h4>Invoices</h4>
        {loading ? (
          <p>Loading invoices...</p>
        ) : (
          <div className="invoice-list">
            {invoices.map(invoice => (
              <div key={invoice.id} className="invoice-item">
                <span>{invoice.number}</span>
                <span>{invoice.amount} {invoice.currency}</span>
                <span className={`status ${invoice.status}`}>{invoice.status}</span>
                <button onClick={() => downloadInvoice(token, invoice.id)}>
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="demo-request-section">
        <h4>Request Demo</h4>
        <button onClick={() => handleDemoRequest({
          companyName: "My Company",
          contactPersonName: "John Doe",
          email: "john@mycompany.com"
        })}>
          Request Demo
        </button>
      </div>
    </div>
  );
};
```

### 8.3 Cache Management UI
```javascript
const CacheManagement = ({ token }) => {
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheConfig, setCacheConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const loadCacheData = async () => {
    setLoading(true);
    try {
      const [stats, config] = await Promise.all([
        getCacheStats(token),
        getCacheConfig(token)
      ]);
      setCacheStats(stats);
      setCacheConfig(config);
    } catch (error) {
      console.error('Failed to load cache data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearCache = async () => {
    try {
      await clearAllCache(token);
      await loadCacheData(); // Refresh data
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };
  
  useEffect(() => {
    loadCacheData();
  }, []);
  
  return (
    <div className="cache-management">
      <h3>Cache Management</h3>
      
      {loading ? (
        <p>Loading cache data...</p>
      ) : (
        <>
          {cacheStats && (
            <div className="cache-stats">
              <h4>Cache Statistics</h4>
              <p>Total Entries: {cacheStats.totalEntries}</p>
              <p>Hit Rate: {cacheStats.hitRate}</p>
              <p>Memory Usage: {cacheStats.memoryUsage}</p>
            </div>
          )}
          
          {cacheConfig && (
            <div className="cache-config">
              <h4>Cache Configuration</h4>
              <p>Max Cache Size: {cacheConfig.maxCacheSize}</p>
              <p>Default TTL: {cacheConfig.defaultTTL}ms</p>
            </div>
          )}
          
          <div className="cache-actions">
            <button onClick={handleClearCache}>Clear All Cache</button>
            <button onClick={loadCacheData}>Refresh Cache Data</button>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## 9. Testing Checklist

### ✅ Pre-Testing Setup
- [ ] Server running on localhost:8383
- [ ] Firebase authentication configured
- [ ] Test user credentials available
- [ ] Enterprise ID available (x-spark-test)
- [ ] Department ID available (testdep)
- [ ] Network connectivity confirmed

### ✅ Authentication Testing
- [ ] Sign-in endpoint working
- [ ] Token retrieval successful
- [ ] Token validation working

### ✅ Core Enterprise Management Testing
- [ ] Get all enterprises
- [ ] Get enterprise by ID
- [ ] Create enterprise
- [ ] Update enterprise
- [ ] Delete enterprise
- [ ] Get enterprise statistics

### ✅ Enterprise Billing Testing
- [ ] Get enterprise invoices
- [ ] Download invoice
- [ ] Submit demo request
- [ ] Submit enterprise inquiry
- [ ] Create sample invoices (development)

### ✅ Contact Aggregation Testing
- [ ] Get enterprise contacts summary
- [ ] Get department contacts summary
- [ ] Get enterprise contacts with details
- [ ] Get department contacts with details

### ✅ Cache Management Testing
- [ ] Get cache statistics
- [ ] Clear all cache
- [ ] Invalidate department caches
- [ ] Warm cache for enterprises
- [ ] Get cache configuration
- [ ] Update cache configuration
- [ ] Get cache analytics

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Enterprise not found
- [ ] Department not found
- [ ] Validation errors
- [ ] Cache configuration errors
- [ ] Network errors

### ✅ UI Integration Testing
- [ ] Enterprise dashboard
- [ ] Billing management UI
- [ ] Cache management UI
- [ ] Loading states
- [ ] Error states
- [ ] Real-time updates

---

## 10. Best Practices

### 10.1 Route Organization
```javascript
// Organize routes by functionality
const enterpriseRoutes = {
  core: {
    getAll: '/enterprise',
    getById: '/enterprise/:enterpriseId',
    create: '/enterprise',
    update: '/enterprise/:enterpriseId',
    delete: '/enterprise/:enterpriseId',
    stats: '/enterprise/:enterpriseId/stats'
  },
  billing: {
    invoices: '/enterprise/invoices',
    downloadInvoice: '/enterprise/invoices/:invoiceId/download',
    demo: '/enterprise/demo',
    inquiry: '/enterprise/inquiry',
    sampleInvoices: '/enterprise/:enterpriseId/create-sample-invoices'
  },
  contacts: {
    enterpriseSummary: '/enterprise/:enterpriseId/contacts/summary',
    departmentSummary: '/enterprise/:enterpriseId/departments/:departmentId/contacts/summary',
    enterpriseDetails: '/enterprise/:enterpriseId/contacts/details',
    departmentDetails: '/enterprise/:enterpriseId/departments/:departmentId/contacts/details'
  },
  cache: {
    stats: '/cache/stats',
    clear: '/cache/clear',
    departmentsClear: '/cache/departments/clear',
    warm: '/cache/warm',
    config: '/cache/config',
    analytics: '/cache/analytics'
  }
};
```

### 10.2 Error Handling Patterns
```javascript
const handleEnterpriseOperation = async (operation, ...args) => {
  try {
    const result = await operation(...args);
    return { success: true, data: result };
  } catch (error) {
    console.error('Enterprise operation failed:', error);
    return { 
      success: false, 
      error: error.message,
      status: error.status 
    };
  }
};
```

### 10.3 Performance Optimization
```javascript
// Use Promise.all for parallel requests
const loadEnterpriseData = async (token, enterpriseId) => {
  const [enterprise, stats, contacts] = await Promise.all([
    getEnterpriseById(token, enterpriseId),
    getEnterpriseStats(token, enterpriseId),
    getEnterpriseContactsSummary(token, enterpriseId)
  ]);
  
  return { enterprise, stats, contacts };
};
```

---

This guide provides comprehensive coverage for testing all Enterprise Routing System endpoints. The system offers a complete enterprise management solution with billing, contact aggregation, and advanced caching capabilities, making it ideal for large-scale enterprise applications. 