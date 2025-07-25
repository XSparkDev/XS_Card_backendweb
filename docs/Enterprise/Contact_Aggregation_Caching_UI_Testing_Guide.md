# Contact Aggregation & Caching System - UI Testing Guide

## Overview
This document provides comprehensive guidance for UI developers to test the Contact Aggregation & Caching System endpoints during end-to-end testing. This system provides high-performance contact data aggregation with intelligent caching mechanisms for enterprise and department-level contact management.

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
  success: boolean,
  message?: string,
  data?: object,
  cached?: boolean,
  error?: string
}
```

### Caching System Features
- **In-Memory Cache**: Fast access to frequently requested data
- **TTL Management**: Configurable time-to-live for different data types
- **Smart Invalidation**: Automatic cache invalidation on data changes
- **Performance Metrics**: Hit/miss rates and access analytics
- **Cache Warming**: Pre-loading data for better performance

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

## 2. Contact Aggregation Endpoints

### 2.1 Get Enterprise Contacts Summary
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

**Usage:**
```javascript
const summary = await getEnterpriseContactsSummary(token, 'x-spark-test');
```

**Expected Response:**
```javascript
{
  success: true,
  data: {
    enterpriseId: "x-spark-test",
    enterpriseName: "x-spark-test",
    totalContacts: 10,
    totalEmployees: 1,
    employeesWithCards: 1,
    departments: {
      "testdep": {
        departmentId: "testdep",
        departmentName: "testDep",
        totalContacts: 10,
        totalEmployees: 1,
        employeesWithCards: 1
      }
    },
    lastUpdated: "2025-01-XX..."
  }
}
```

### 2.2 Get Department Contacts Summary
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

**Usage:**
```javascript
const deptSummary = await getDepartmentContactsSummary(token, 'x-spark-test', 'testdep');
```

**Expected Response:**
```javascript
{
  success: true,
  data: {
    departmentId: "testdep",
    departmentName: "testDep",
    totalContacts: 10,
    totalEmployees: 1,
    employeesWithCards: 1,
    employees: {
      "employee123": {
        employeeId: "employee123",
        name: "John Doe",
        email: "john@example.com",
        contactCount: 10,
        hasCard: true
      }
    },
    lastUpdated: "2025-01-XX..."
  }
}
```

### 2.3 Get Enterprise Contacts with Details
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

**Usage:**
```javascript
const details = await getEnterpriseContactsWithDetails(token, 'x-spark-test');
```

**Expected Response:**
```javascript
{
  success: true,
  cached: true, // Indicates if data came from cache
  data: {
    enterpriseId: "x-spark-test",
    enterpriseName: "x-spark-test",
    totalContacts: 10,
    totalDepartments: 1,
    departments: {
      "testdep": {
        departmentId: "testdep",
        departmentName: "testDep",
        totalContacts: 10,
        employees: {
          "employee123": {
            employeeId: "employee123",
            name: "John Doe",
            email: "john@example.com",
            contacts: [
              {
                contactId: "contact1",
                name: "Contact 1",
                email: "contact1@example.com",
                phone: "+1234567890",
                company: "Company A",
                lastInteraction: "2025-01-XX..."
              }
              // ... more contacts
            ]
          }
        }
      }
    },
    lastUpdated: "2025-01-XX..."
  }
}
```

### 2.4 Get Department Contacts with Details
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

**Usage:**
```javascript
const deptDetails = await getDepartmentContactsWithDetails(token, 'x-spark-test', 'testdep');
```

**Expected Response:**
```javascript
{
  success: true,
  cached: false, // Indicates if data was calculated fresh
  data: {
    enterpriseId: "x-spark-test",
    enterpriseName: "x-spark-test",
    departmentId: "testdep",
    departmentName: "testDep",
    totalContacts: 10,
    employees: {
      "employee123": {
        employeeId: "employee123",
        name: "John Doe",
        email: "john@example.com",
        contacts: [
          {
            contactId: "contact1",
            name: "Contact 1",
            email: "contact1@example.com",
            phone: "+1234567890",
            company: "Company A",
            lastInteraction: "2025-01-XX..."
          }
          // ... more contacts
        ]
      }
    },
    lastUpdated: "2025-01-XX..."
  }
}
```

---

## 3. Cache Management Endpoints

### 3.1 Get Cache Statistics
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

**Expected Response:**
```javascript
{
  success: true,
  cache: {
    totalEntries: 4,
    warmingFlags: 0,
    maxCacheSize: 1000,
    hitCount: 3,
    missCount: 6,
    hitRate: "33.33%",
    memoryUsage: "2.5 MB",
    lastCleanup: "2025-01-XX...",
    ttlSettings: {
      enterprise: 3600000,      // 1 hour
      department: 1800000,      // 30 minutes
      highActivity: 900000,     // 15 minutes
      lowActivity: 7200000      // 2 hours
    }
  }
}
```

### 3.2 Get Cache Configuration
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
    return result.config;
  } catch (error) {
    console.error('Failed to get cache config:', error);
  }
};
```

**Expected Response:**
```javascript
{
  success: true,
  config: {
    defaultTTL: 3600000,        // 1 hour
    maxCacheSize: 1000,
    cleanupInterval: 600000,    // 10 minutes
    memoryCheckInterval: 300000, // 5 minutes
    ttlSettings: {
      enterprise: 3600000,
      department: 1800000,
      highActivity: 900000,
      lowActivity: 7200000
    }
  }
}
```

### 3.3 Update Cache Configuration
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
    return result.config;
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

### 3.4 Get Cache Analytics
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

**Expected Response:**
```javascript
{
  success: true,
  analytics: {
    totalEntries: 4,
    hitRate: "33.33%",
    mostAccessedEntries: [
      {
        key: "enterprise:x-spark-test:contacts",
        accessCount: 5,
        lastAccessed: "2025-01-XX..."
      }
    ],
    ttlDistribution: {
      "1 hour": 2,
      "30 minutes": 1,
      "15 minutes": 1
    },
    avgAccessTime: "2.3ms",
    memoryEfficiency: "85%"
  }
}
```

---

## 4. Cache Control Endpoints

### 4.1 Clear All Cache
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

**Expected Response:**
```javascript
{
  success: true,
  message: "All cache entries cleared successfully",
  clearedEntries: 4,
  timestamp: "2025-01-XX..."
}
```

### 4.2 Invalidate Department Caches
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

**Expected Response:**
```javascript
{
  success: true,
  message: "All department cache entries invalidated",
  invalidatedEntries: 2,
  timestamp: "2025-01-XX..."
}
```

### 4.3 Warm Cache for Enterprises
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

**Usage:**
```javascript
const warmingResults = await warmCacheForEnterprises(token, ['x-spark-test', 'another-enterprise']);
```

**Expected Response:**
```javascript
{
  success: true,
  message: "Cache warming completed for 1 enterprises",
  results: [
    {
      enterpriseId: "x-spark-test",
      status: "warmed",
      duration: "1.2s",
      entriesCreated: 2,
      summary: "Enterprise and department data cached successfully"
    }
  ]
}
```

---

## 5. Complete UI Testing Workflow

### 5.1 Setup Function
```javascript
const setupContactAggregationTesting = async () => {
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

### 5.2 Contact Aggregation Testing Workflow
```javascript
const testContactAggregation = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Contact Aggregation...');
  
  // 1. Get enterprise contacts summary
  const enterpriseSummary = await getEnterpriseContactsSummary(token, enterpriseId);
  console.log('✅ Enterprise summary retrieved:', enterpriseSummary.totalContacts, 'contacts');
  
  // 2. Get department contacts summary
  const departmentSummary = await getDepartmentContactsSummary(token, enterpriseId, departmentId);
  console.log('✅ Department summary retrieved:', departmentSummary.totalContacts, 'contacts');
  
  // 3. Get enterprise contacts with details
  const enterpriseDetails = await getEnterpriseContactsWithDetails(token, enterpriseId);
  console.log('✅ Enterprise details retrieved (cached:', enterpriseDetails.cached, ')');
  
  // 4. Get department contacts with details
  const departmentDetails = await getDepartmentContactsWithDetails(token, enterpriseId, departmentId);
  console.log('✅ Department details retrieved (cached:', departmentDetails.cached, ')');
  
  return {
    enterpriseSummary,
    departmentSummary,
    enterpriseDetails,
    departmentDetails
  };
};
```

### 5.3 Cache Management Testing Workflow
```javascript
const testCacheManagement = async (token) => {
  console.log('🧪 Testing Cache Management...');
  
  // 1. Get cache stats
  const cacheStats = await getCacheStats(token);
  console.log('✅ Cache stats retrieved:', cacheStats.totalEntries, 'entries');
  
  // 2. Get cache config
  const cacheConfig = await getCacheConfig(token);
  console.log('✅ Cache config retrieved');
  
  // 3. Get cache analytics
  const cacheAnalytics = await getCacheAnalytics(token);
  console.log('✅ Cache analytics retrieved, hit rate:', cacheAnalytics.hitRate);
  
  // 4. Update cache config
  const updatedConfig = await updateCacheConfig(token, {
    defaultTTL: 7200000, // 2 hours
    maxCacheSize: 2000
  });
  console.log('✅ Cache config updated');
  
  // 5. Warm cache for enterprises
  const warmingResults = await warmCacheForEnterprises(token, ['x-spark-test']);
  console.log('✅ Cache warmed for', warmingResults.length, 'enterprises');
  
  // 6. Invalidate department caches
  const invalidationResult = await invalidateDepartmentCaches(token);
  console.log('✅ Department caches invalidated');
  
  // 7. Clear all cache
  const clearResult = await clearAllCache(token);
  console.log('✅ All cache cleared');
  
  return {
    cacheStats,
    cacheConfig,
    cacheAnalytics,
    updatedConfig,
    warmingResults,
    invalidationResult,
    clearResult
  };
};
```

### 5.4 Performance Testing Workflow
```javascript
const testContactAggregationPerformance = async (token, enterpriseId, departmentId) => {
  console.log('⚡ Testing Contact Aggregation Performance...');
  
  const iterations = 5;
  const times = {
    enterpriseSummary: [],
    departmentSummary: [],
    enterpriseDetails: [],
    departmentDetails: []
  };
  
  for (let i = 0; i < iterations; i++) {
    // Test enterprise summary
    const start1 = performance.now();
    await getEnterpriseContactsSummary(token, enterpriseId);
    const end1 = performance.now();
    times.enterpriseSummary.push(end1 - start1);
    
    // Test department summary
    const start2 = performance.now();
    await getDepartmentContactsSummary(token, enterpriseId, departmentId);
    const end2 = performance.now();
    times.departmentSummary.push(end2 - start2);
    
    // Test enterprise details
    const start3 = performance.now();
    await getEnterpriseContactsWithDetails(token, enterpriseId);
    const end3 = performance.now();
    times.enterpriseDetails.push(end3 - start3);
    
    // Test department details
    const start4 = performance.now();
    await getDepartmentContactsWithDetails(token, enterpriseId, departmentId);
    const end4 = performance.now();
    times.departmentDetails.push(end4 - start4);
  }
  
  // Calculate averages
  const avgEnterpriseSummary = times.enterpriseSummary.reduce((a, b) => a + b, 0) / times.enterpriseSummary.length;
  const avgDepartmentSummary = times.departmentSummary.reduce((a, b) => a + b, 0) / times.departmentSummary.length;
  const avgEnterpriseDetails = times.enterpriseDetails.reduce((a, b) => a + b, 0) / times.enterpriseDetails.length;
  const avgDepartmentDetails = times.departmentDetails.reduce((a, b) => a + b, 0) / times.departmentDetails.length;
  
  console.log(`📊 Performance Results:`);
  console.log(`📊 Enterprise Summary: ${avgEnterpriseSummary.toFixed(2)}ms average`);
  console.log(`📊 Department Summary: ${avgDepartmentSummary.toFixed(2)}ms average`);
  console.log(`📊 Enterprise Details: ${avgEnterpriseDetails.toFixed(2)}ms average`);
  console.log(`📊 Department Details: ${avgDepartmentDetails.toFixed(2)}ms average`);
  
  return { avgEnterpriseSummary, avgDepartmentSummary, avgEnterpriseDetails, avgDepartmentDetails };
};
```

### 5.5 Cache Hit/Miss Testing Workflow
```javascript
const testCacheHitMiss = async (token, enterpriseId, departmentId) => {
  console.log('🧪 Testing Cache Hit/Miss Patterns...');
  
  // 1. Clear cache first
  await clearAllCache(token);
  console.log('✅ Cache cleared');
  
  // 2. First request (should miss)
  const start1 = performance.now();
  const result1 = await getEnterpriseContactsSummary(token, enterpriseId);
  const end1 = performance.now();
  console.log('✅ First request (miss):', (end1 - start1).toFixed(2), 'ms');
  
  // 3. Second request (should hit)
  const start2 = performance.now();
  const result2 = await getEnterpriseContactsSummary(token, enterpriseId);
  const end2 = performance.now();
  console.log('✅ Second request (hit):', (end2 - start2).toFixed(2), 'ms');
  
  // 4. Check cache stats
  const cacheStats = await getCacheStats(token);
  console.log('✅ Cache stats - Hit rate:', cacheStats.hitRate);
  
  return {
    firstRequest: { time: end1 - start1, cached: false },
    secondRequest: { time: end2 - start2, cached: true },
    cacheStats
  };
};
```

### 5.6 Complete Test Suite
```javascript
const runCompleteContactAggregationTest = async () => {
  console.log('🚀 Starting Complete Contact Aggregation & Caching Test Suite...');
  
  try {
    // Setup
    const token = await setupContactAggregationTesting();
    if (!token) return;
    
    const enterpriseId = 'x-spark-test';
    const departmentId = 'testdep';
    
    // Run all test suites
    const aggregationResults = await testContactAggregation(token, enterpriseId, departmentId);
    const cacheResults = await testCacheManagement(token);
    const performanceResults = await testContactAggregationPerformance(token, enterpriseId, departmentId);
    const hitMissResults = await testCacheHitMiss(token, enterpriseId, departmentId);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Test Results:', {
      aggregation: aggregationResults,
      cache: cacheResults,
      performance: performanceResults,
      hitMiss: hitMissResults
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};
```

---

## 6. Error Handling Examples

### 6.1 Enterprise Not Found
```javascript
const handleEnterpriseNotFound = (error) => {
  if (error.status === 404) {
    console.error('Enterprise not found');
    // Show appropriate UI message
  }
};
```

### 6.2 Department Not Found
```javascript
const handleDepartmentNotFound = (error) => {
  if (error.status === 404) {
    console.error('Department not found');
    // Show appropriate UI message
  }
};
```

### 6.3 Cache Configuration Error
```javascript
const handleCacheConfigError = (error) => {
  if (error.status === 400) {
    console.error('Invalid cache configuration:', error.message);
    // Show validation errors in UI
  }
};
```

### 6.4 Cache Warming Error
```javascript
const handleCacheWarmingError = (error) => {
  if (error.status === 500) {
    console.error('Cache warming failed:', error.message);
    // Show error message in UI
  }
};
```

---

## 7. UI Integration Notes

### 7.1 Loading States with Cache Indicators
```javascript
const [loading, setLoading] = useState(false);
const [cached, setCached] = useState(false);
const [error, setError] = useState(null);

const fetchEnterpriseContacts = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const result = await getEnterpriseContactsSummary(token, enterpriseId);
    setContacts(result);
    setCached(result.cached || false);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 7.2 Cache Status Display
```javascript
const CacheStatusIndicator = ({ cached, loading }) => {
  if (loading) {
    return <span className="cache-status loading">🔄 Loading...</span>;
  }
  
  return cached ? (
    <span className="cache-status cached">⚡ Cached</span>
  ) : (
    <span className="cache-status fresh">🆕 Fresh Data</span>
  );
};
```

### 7.3 Performance Monitoring
```javascript
const PerformanceMonitor = ({ responseTime, cacheHit }) => {
  return (
    <div className="performance-monitor">
      <span className="response-time">
        ⏱️ {responseTime.toFixed(2)}ms
      </span>
      <span className="cache-indicator">
        {cacheHit ? '⚡ Cache Hit' : '🔄 Cache Miss'}
      </span>
    </div>
  );
};
```

### 7.4 Cache Management UI
```javascript
const CacheManagementPanel = ({ token }) => {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const refreshStats = async () => {
    setLoading(true);
    try {
      const stats = await getCacheStats(token);
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearCache = async () => {
    try {
      await clearAllCache(token);
      await refreshStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };
  
  const handleWarmCache = async () => {
    try {
      await warmCacheForEnterprises(token, ['x-spark-test']);
      await refreshStats();
    } catch (error) {
      console.error('Failed to warm cache:', error);
    }
  };
  
  return (
    <div className="cache-management">
      <h3>Cache Management</h3>
      {cacheStats && (
        <div className="cache-stats">
          <p>Total Entries: {cacheStats.totalEntries}</p>
          <p>Hit Rate: {cacheStats.hitRate}</p>
          <p>Memory Usage: {cacheStats.memoryUsage}</p>
        </div>
      )}
      <div className="cache-actions">
        <button onClick={refreshStats} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Stats'}
        </button>
        <button onClick={handleClearCache}>Clear All Cache</button>
        <button onClick={handleWarmCache}>Warm Cache</button>
      </div>
    </div>
  );
};
```

### 7.5 Contact Aggregation Dashboard
```javascript
const ContactAggregationDashboard = ({ token, enterpriseId, departmentId }) => {
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  
  const loadSummary = async () => {
    setLoading(true);
    try {
      const result = await getEnterpriseContactsSummary(token, enterpriseId);
      setSummary(result);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadDetails = async () => {
    setLoading(true);
    try {
      const result = await getEnterpriseContactsWithDetails(token, enterpriseId);
      setDetails(result);
      setCached(result.cached || false);
    } catch (error) {
      console.error('Failed to load details:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadSummary();
  }, [enterpriseId]);
  
  return (
    <div className="contact-dashboard">
      <div className="dashboard-header">
        <h2>Contact Aggregation Dashboard</h2>
        <CacheStatusIndicator cached={cached} loading={loading} />
      </div>
      
      {summary && (
        <div className="summary-section">
          <h3>Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="label">Total Contacts:</span>
              <span className="value">{summary.totalContacts}</span>
            </div>
            <div className="stat">
              <span className="label">Total Employees:</span>
              <span className="value">{summary.totalEmployees}</span>
            </div>
            <div className="stat">
              <span className="label">Employees with Cards:</span>
              <span className="value">{summary.employeesWithCards}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="dashboard-actions">
        <button onClick={loadSummary} disabled={loading}>
          Refresh Summary
        </button>
        <button onClick={loadDetails} disabled={loading}>
          Load Details
        </button>
      </div>
      
      {details && (
        <div className="details-section">
          <h3>Detailed Contact Information</h3>
          {/* Render detailed contact information */}
        </div>
      )}
    </div>
  );
};
```

---

## 8. Performance Optimization Tips

### 8.1 Cache Warming Strategies
```javascript
// Warm cache on app startup
const warmCacheOnStartup = async (token, enterpriseIds) => {
  console.log('🔥 Warming cache on startup...');
  try {
    await warmCacheForEnterprises(token, enterpriseIds);
    console.log('✅ Cache warmed successfully');
  } catch (error) {
    console.warn('⚠️ Cache warming failed:', error);
  }
};

// Warm cache before user actions
const warmCacheBeforeAction = async (token, enterpriseId) => {
  // Warm cache before user navigates to contact details
  await warmCacheForEnterprises(token, [enterpriseId]);
};
```

### 8.2 Smart Cache Invalidation
```javascript
// Invalidate cache when data changes
const invalidateCacheOnDataChange = async (token, enterpriseId, departmentId) => {
  // After creating/updating/deleting contacts
  await invalidateDepartmentCaches(token);
  console.log('🔄 Cache invalidated after data change');
};
```

### 8.3 Performance Monitoring
```javascript
const monitorPerformance = (operation, startTime) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`📊 ${operation} completed in ${duration.toFixed(2)}ms`);
  
  // Send to analytics if duration is too high
  if (duration > 1000) {
    console.warn(`⚠️ Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
  }
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

### ✅ Contact Aggregation Testing
- [ ] Get enterprise contacts summary
- [ ] Get department contacts summary
- [ ] Get enterprise contacts with details
- [ ] Get department contacts with details
- [ ] Verify cached vs fresh data responses

### ✅ Cache Management Testing
- [ ] Get cache statistics
- [ ] Get cache configuration
- [ ] Update cache configuration
- [ ] Get cache analytics
- [ ] Clear all cache
- [ ] Invalidate department caches
- [ ] Warm cache for enterprises

### ✅ Performance Testing
- [ ] Response time measurements
- [ ] Cache hit/miss patterns
- [ ] Cache warming performance
- [ ] Large dataset handling
- [ ] Concurrent request handling

### ✅ Error Handling Testing
- [ ] Invalid authentication
- [ ] Enterprise not found
- [ ] Department not found
- [ ] Cache configuration errors
- [ ] Cache warming errors
- [ ] Network errors

### ✅ UI Integration Testing
- [ ] Loading states
- [ ] Cache status indicators
- [ ] Performance monitoring
- [ ] Cache management UI
- [ ] Contact aggregation dashboard
- [ ] Real-time updates

---

## 10. Best Practices

### 10.1 Cache Usage Guidelines
```javascript
// Use summary endpoints for overview data
const loadOverview = async () => {
  const summary = await getEnterpriseContactsSummary(token, enterpriseId);
  // Use for dashboard overviews, quick stats
};

// Use details endpoints for detailed views
const loadDetails = async () => {
  const details = await getEnterpriseContactsWithDetails(token, enterpriseId);
  // Use for detailed contact lists, individual contact views
};
```

### 10.2 Performance Optimization
```javascript
// Implement request debouncing
const debouncedFetch = debounce(async (token, enterpriseId) => {
  return await getEnterpriseContactsSummary(token, enterpriseId);
}, 300);

// Use React Query or similar for caching
const { data, isLoading, error } = useQuery(
  ['enterprise-contacts', enterpriseId],
  () => getEnterpriseContactsSummary(token, enterpriseId),
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000  // 10 minutes
  }
);
```

### 10.3 Error Handling Patterns
```javascript
const handleContactAggregationError = async (operation, ...args) => {
  try {
    const result = await operation(...args);
    return { success: true, data: result };
  } catch (error) {
    console.error('Contact aggregation operation failed:', error);
    return { 
      success: false, 
      error: error.message,
      status: error.status 
    };
  }
};
```

---

This guide provides comprehensive coverage for testing all Contact Aggregation & Caching System endpoints. The system offers high-performance contact data aggregation with intelligent caching mechanisms, making it ideal for enterprise-scale contact management applications. 