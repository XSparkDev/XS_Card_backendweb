# 📊 Enterprise Activity Logs API - Frontend Integration Guide

## 🎯 **Overview**

This document provides everything the frontend team needs to integrate the **Enterprise Activity Logs API**. This endpoint provides comprehensive access to all activity logs for a specific enterprise with powerful filtering, search, and pagination capabilities.

---

## 🌐 **API Endpoint**

### **Base URL**
```
GET /enterprise/:enterpriseId/security/logs
```

### **Authentication**
```javascript
const headers = {
  'Authorization': `Bearer ${userToken}`,
  'Content-Type': 'application/json'
};
```

---

## 📋 **Request Parameters**

### **Path Parameters**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `enterpriseId` | string | ✅ | Enterprise identifier | `x-spark-test` |

### **Query Parameters**
| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `timeframe` | string | `24h` | Time range filter | `24h`, `7d`, `30d` |
| `limit` | number | `100` | Maximum logs to return | `50`, `200` |
| `userId` | string | `null` | Filter by specific user | `DW1QbgLTiCgFxOBbvPKdjlLvIgo1` |
| `action` | string | `null` | Filter by action type | `login`, `create`, `update` |
| `resource` | string | `null` | Filter by resource type | `user`, `card`, `system` |
| `search` | string | `null` | Search in log details | `failed`, `error`, `login` |
| `success` | boolean | `null` | Filter by success status | `true`, `false` |
| `startAfter` | string | `null` | Pagination cursor | Document ID |

---

## 📊 **Response Format**

### **Success Response (200)**
```javascript
{
  "status": true,
  "data": {
    "logs": [
      {
        "id": "log-123",
        "action": "login",
        "resource": "user",
        "userId": "DW1QbgLTiCgFxOBbvPKdjlLvIgo1",
        "status": "error",
        "timestamp": "2025-01-20T10:30:00Z",
        "details": {
          "operation": "login",
          "error": "Invalid credentials",
          "ipAddress": "192.168.1.100",
          "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "attemptNumber": 3,
          "location": "Unknown"
        },
        "enterpriseId": "x-spark-test"
      }
    ],
    "totalCount": 150,
    "hasMore": true,
    "lastTimestamp": "2025-01-20T10:30:00Z",
    "filters": {
      "timeframe": "7d",
      "userId": null,
      "action": null,
      "resource": null,
      "search": null,
      "success": null
    },
    "meta": {
      "enterpriseUserCount": 5,
      "timeRange": {
        "start": "2025-01-13T10:30:00Z",
        "end": "2025-01-20T10:30:00Z"
      }
    }
  }
}
```

### **Error Response (403/404/500)**
```javascript
{
  "status": false,
  "message": "Access denied to enterprise security logs",
  "error": "Detailed error message"
}
```

---

## 🔧 **Frontend Integration Examples**

### **1. Basic Log Retrieval**
```javascript
const fetchEnterpriseLogs = async (enterpriseId, options = {}) => {
  const params = new URLSearchParams();
  
  // Add filters
  if (options.timeframe) params.append('timeframe', options.timeframe);
  if (options.limit) params.append('limit', options.limit);
  if (options.userId) params.append('userId', options.userId);
  if (options.action) params.append('action', options.action);
  if (options.resource) params.append('resource', options.resource);
  if (options.search) params.append('search', options.search);
  if (options.success !== undefined) params.append('success', options.success);
  if (options.startAfter) params.append('startAfter', options.startAfter);

  const response = await fetch(
    `/enterprise/${enterpriseId}/security/logs?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const logs = await fetchEnterpriseLogs('x-spark-test', {
  timeframe: '7d',
  limit: 50
});
```

### **2. React Hook for Logs**
```javascript
import { useState, useEffect } from 'react';

const useEnterpriseLogs = (enterpriseId, filters = {}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState(null);

  const fetchLogs = async (startAfter = null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add all filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, value);
        }
      });
      
      if (startAfter) params.append('startAfter', startAfter);

      const response = await fetch(
        `/enterprise/${enterpriseId}/security/logs?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.status) {
        if (startAfter) {
          setLogs(prev => [...prev, ...data.data.logs]);
        } else {
          setLogs(data.data.logs);
        }
        setHasMore(data.data.hasMore);
        setLastTimestamp(data.data.lastTimestamp);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [enterpriseId, JSON.stringify(filters)]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchLogs(lastTimestamp);
    }
  };

  return { logs, loading, error, hasMore, loadMore, refetch: () => fetchLogs() };
};

// Usage in component
const LogsViewer = ({ enterpriseId }) => {
  const [filters, setFilters] = useState({
    timeframe: '7d',
    limit: 50,
    action: null,
    resource: null,
    search: null,
    success: null
  });

  const { logs, loading, error, hasMore, loadMore } = useEnterpriseLogs(enterpriseId, filters);

  return (
    <div className="logs-viewer">
      <LogFilters filters={filters} onFiltersChange={setFilters} />
      <LogTable logs={logs} loading={loading} />
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
};
```

### **3. Advanced Filtering Component**
```javascript
const LogFilters = ({ filters, onFiltersChange }) => {
  const handleFilterChange = (key, value) => {
    onFiltersChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="log-filters">
      {/* Time Range Filter */}
      <select 
        value={filters.timeframe} 
        onChange={(e) => handleFilterChange('timeframe', e.target.value)}
      >
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
      </select>

      {/* Action Filter */}
      <select 
        value={filters.action || ''} 
        onChange={(e) => handleFilterChange('action', e.target.value || null)}
      >
        <option value="">All Actions</option>
        <option value="login">Login</option>
        <option value="create">Create</option>
        <option value="update">Update</option>
        <option value="delete">Delete</option>
        <option value="export">Export</option>
      </select>

      {/* Resource Filter */}
      <select 
        value={filters.resource || ''} 
        onChange={(e) => handleFilterChange('resource', e.target.value || null)}
      >
        <option value="">All Resources</option>
        <option value="user">User</option>
        <option value="card">Card</option>
        <option value="contact">Contact</option>
        <option value="system">System</option>
      </select>

      {/* Success Status Filter */}
      <select 
        value={filters.success === null ? '' : filters.success} 
        onChange={(e) => handleFilterChange('success', e.target.value === '' ? null : e.target.value === 'true')}
      >
        <option value="">All Status</option>
        <option value="true">Success</option>
        <option value="false">Error</option>
      </select>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search logs..."
        value={filters.search || ''}
        onChange={(e) => handleFilterChange('search', e.target.value || null)}
      />
    </div>
  );
};
```

### **4. Log Table Component**
```javascript
const LogTable = ({ logs, loading }) => {
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    return status === 'success' ? 'green' : 'red';
  };

  const getActionIcon = (action) => {
    const icons = {
      login: '🔐',
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      export: '📤',
      error: '❌'
    };
    return icons[action] || '📋';
  };

  if (loading) return <div>Loading logs...</div>;

  return (
    <table className="logs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Resource</th>
          <th>User</th>
          <th>Status</th>
          <th>Timestamp</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>
              <span className="action-icon">{getActionIcon(log.action)}</span>
              {log.action}
            </td>
            <td>{log.resource}</td>
            <td>{log.userId}</td>
            <td>
              <span className={`status-${getStatusColor(log.status)}`}>
                {log.status}
              </span>
            </td>
            <td>{formatTimestamp(log.timestamp)}</td>
            <td>
              <details>
                <summary>View Details</summary>
                <pre>{JSON.stringify(log.details, null, 2)}</pre>
              </details>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## 🎨 **CSS Styling**

```css
/* Log Filters */
.log-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.log-filters select,
.log-filters input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

/* Log Table */
.logs-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.logs-table th,
.logs-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.logs-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.action-icon {
  margin-right: 0.5rem;
}

.status-success {
  color: #16a34a;
  font-weight: 600;
}

.status-error {
  color: #dc2626;
  font-weight: 600;
}

/* Log Details */
.logs-table details {
  cursor: pointer;
}

.logs-table pre {
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 12px;
  max-width: 300px;
  overflow-x: auto;
}
```

---

## 🔍 **Filtering Examples**

### **1. Get All Login Attempts**
```javascript
const loginLogs = await fetchEnterpriseLogs('x-spark-test', {
  action: 'login',
  timeframe: '7d'
});
```

### **2. Get Failed Login Attempts**
```javascript
const failedLogins = await fetchEnterpriseLogs('x-spark-test', {
  action: 'login',
  success: false,
  timeframe: '24h'
});
```

### **3. Get User-Specific Activity**
```javascript
const userActivity = await fetchEnterpriseLogs('x-spark-test', {
  userId: 'DW1QbgLTiCgFxOBbvPKdjlLvIgo1',
  timeframe: '30d'
});
```

### **4. Search for Specific Events**
```javascript
const searchResults = await fetchEnterpriseLogs('x-spark-test', {
  search: 'failed',
  timeframe: '7d'
});
```

### **5. Get System Errors**
```javascript
const systemErrors = await fetchEnterpriseLogs('x-spark-test', {
  resource: 'system',
  success: false,
  timeframe: '24h'
});
```

---

## 📊 **Available Actions & Resources**

### **Actions**
- `login` - User login attempts
- `logout` - User logout events
- `create` - Resource creation
- `read` - Resource access
- `update` - Resource modifications
- `delete` - Resource deletion
- `export` - Data exports
- `send` - Email/notification sending
- `verify` - Verification processes
- `apply` - Application processes
- `initialize` - System initialization
- `cancel` - Cancelled operations
- `error` - Error events
- `generate` - Generated content

### **Resources**
- `user` - User management
- `card` - Card operations
- `template` - Template management
- `department` - Department operations
- `team` - Team management
- `employee` - Employee operations
- `contact` - Contact management
- `meeting` - Meeting operations
- `subscription` - Subscription management
- `payment` - Payment processing
- `email` - Email operations
- `system` - System operations
- `wallet_pass` - Wallet pass operations
- `qr_code` - QR code operations

---

## ⚡ **Performance Tips**

### **1. Efficient Polling**
```javascript
// Use appropriate timeframes for different use cases
const pollingIntervals = {
  realtime: '24h',    // For active monitoring
  daily: '7d',        // For daily reports
  weekly: '30d'       // For weekly analysis
};
```

### **2. Pagination for Large Datasets**
```javascript
const loadAllLogs = async (enterpriseId, filters) => {
  let allLogs = [];
  let hasMore = true;
  let startAfter = null;

  while (hasMore) {
    const response = await fetchEnterpriseLogs(enterpriseId, {
      ...filters,
      limit: 100,
      startAfter
    });

    allLogs = [...allLogs, ...response.data.logs];
    hasMore = response.data.hasMore;
    startAfter = response.data.lastTimestamp;
  }

  return allLogs;
};
```

### **3. Debounced Search**
```javascript
import { useMemo } from 'react';

const useDebouncedSearch = (searchTerm, delay = 300) => {
  const debouncedSearch = useMemo(() => {
    const timeoutId = setTimeout(() => {
      // Trigger search
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, delay]);

  return debouncedSearch;
};
```

---

## 🚨 **Error Handling**

```javascript
const handleLogsError = (error) => {
  if (error.status === 403) {
    showNotification('Access denied to enterprise logs', 'error');
  } else if (error.status === 404) {
    showNotification('Enterprise not found', 'error');
  } else if (error.status === 500) {
    showNotification('Server error while fetching logs', 'error');
  } else {
    showNotification('Failed to fetch logs', 'error');
  }
};

// Usage
try {
  const logs = await fetchEnterpriseLogs('x-spark-test');
} catch (error) {
  handleLogsError(error);
}
```

---

## ✅ **Key Features Summary**

- ✅ **Enterprise Isolation** - Only returns logs for users in the specified enterprise
- ✅ **Comprehensive Filtering** - Filter by user, action, resource, time, success status
- ✅ **Search Functionality** - Search through log details
- ✅ **Pagination Support** - Use `startAfter` for large datasets
- ✅ **Time Range Filtering** - 24h, 7d, 30d options
- ✅ **User Information** - Includes user details for each log
- ✅ **Metadata** - Provides enterprise context and time ranges
- ✅ **Real-time Ready** - Efficient polling for live monitoring
- ✅ **Error Handling** - Comprehensive error responses
- ✅ **Performance Optimized** - Efficient querying and pagination

---

## 🎯 **Quick Start**

```javascript
// 1. Basic implementation
const logs = await fetchEnterpriseLogs('your-enterprise-id');

// 2. With filters
const filteredLogs = await fetchEnterpriseLogs('your-enterprise-id', {
  timeframe: '7d',
  action: 'login',
  success: false
});

// 3. With React hook
const { logs, loading, error, hasMore, loadMore } = useEnterpriseLogs('your-enterprise-id');
```

This endpoint provides **complete access** to enterprise activity logs with powerful filtering capabilities, making it perfect for security monitoring, audit trails, and user activity analysis! 