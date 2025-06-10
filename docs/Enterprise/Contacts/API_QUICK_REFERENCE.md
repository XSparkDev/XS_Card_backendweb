# Enterprise Contact Aggregation API - Quick Reference

## 🚀 Core Endpoints

### Contact Aggregation
```http
# Enterprise-wide contact summary (500x faster with cache)
GET /enterprise/{enterpriseId}/contacts/summary
Authorization: Bearer {token}

Response: {
  "success": true,
  "data": {
    "enterpriseId": "string",
    "enterpriseName": "string", 
    "totalContacts": 1247,
    "totalEmployees": 156,
    "totalDepartments": 8,
    "departments": [...]
  },
  "cached": true,
  "responseTime": "0.012s"
}
```

```http
# Department-level contact summary
GET /enterprise/{enterpriseId}/departments/{departmentId}/contacts/summary
Authorization: Bearer {token}

Response: {
  "success": true,
  "data": {
    "departmentId": "string",
    "departmentName": "string",
    "totalContacts": 89,
    "totalEmployees": 12,
    "employees": [...]
  },
  "cached": true,
  "responseTime": "0.008s"
}
```

## 📊 Cache Management

### Basic Operations
```http
# Get cache performance metrics
GET /cache/stats
Authorization: Bearer {token}

Response: {
  "success": true,
  "cache": {
    "totalEntries": 47,
    "hitCount": 234,
    "missCount": 12,
    "hitRate": "95.1%",
    "memoryUsage": "12.4MB"
  }
}
```

```http
# Clear all cache (admin)
DELETE /cache/clear
Authorization: Bearer {token}

Response: {
  "success": true,
  "message": "Cleared 47 cache entries"
}
```

### Advanced Management
```http
# Warm cache for multiple enterprises
POST /cache/warm
Authorization: Bearer {token}
Content-Type: application/json

Body: {
  "enterpriseIds": ["ent1", "ent2", "ent3"]
}

Response: {
  "success": true,
  "results": [
    {"enterpriseId": "ent1", "status": "warmed", "duration": 1245},
    {"enterpriseId": "ent2", "status": "already_cached", "duration": 0}
  ]
}
```

```http
# Clear department caches
DELETE /cache/departments/clear
Authorization: Bearer {token}

Response: {
  "success": true,
  "message": "Invalidated 23 department cache entries"
}
```

## ⚙️ Configuration

### Cache Settings
```http
# Get current configuration
GET /cache/config
Authorization: Bearer {token}

Response: {
  "success": true,
  "configuration": {
    "ttlSettings": {
      "enterprise": 3600000,
      "department": 1800000,
      "default": 3600000
    },
    "maxCacheSize": 1000
  }
}
```

```http
# Update TTL settings (runtime)
PUT /cache/config
Authorization: Bearer {token}
Content-Type: application/json

Body: {
  "ttlSettings": {
    "enterprise": 7200000,    // 2 hours
    "department": 3600000,    // 1 hour  
    "default": 1800000        // 30 minutes
  }
}
```

## 📈 Analytics

### Advanced Metrics
```http
# Detailed cache analytics
GET /cache/analytics
Authorization: Bearer {token}

Response: {
  "success": true,
  "analytics": {
    "totalEntries": 47,
    "hitRate": "95.1%",
    "mostAccessedEntries": [...],
    "ttlDistribution": {
      "expiringSoon": 3,
      "expiring1Hour": 12,
      "expiringLater": 32
    },
    "avgAccessCount": 5.2
  }
}
```

## 🔄 Automatic Cache Invalidation

Cache is automatically invalidated when:

### Contact Changes
```http
# Adding contacts triggers enterprise cache invalidation
POST /AddContact
POST /saveContact
```

### Employee Lifecycle
```http
# Employee changes trigger enterprise cache invalidation  
POST   /enterprise/{id}/departments/{id}/employees
PUT    /enterprise/{id}/departments/{id}/employees/{id}
DELETE /enterprise/{id}/departments/{id}/employees/{id}
```

## ⚡ Performance Expectations

| Scenario | Response Time | Cache Status |
|----------|---------------|--------------|
| **Cache Hit** | 0.01-0.1 seconds | ✅ Optimal |
| **Cache Miss** | 5-10 seconds | 🔄 Expected |
| **Concurrent Requests** | Protected | 🛡️ Safe |

## 🏷️ Response Headers

```http
X-Cache-Status: HIT | MISS | WARMING
X-Response-Time: 0.012s
X-Cache-TTL: 3540 (seconds remaining)
```

## 🚨 Error Codes

| Code | Description | Action |
|------|-------------|--------|
| **200** | Success | Continue |
| **400** | Invalid request | Check parameters |
| **401** | Unauthorized | Verify token |
| **404** | Enterprise/Department not found | Check IDs |
| **500** | Server error | Check logs, retry |

## 💡 Best Practices

1. **Cache Warming**: Preload busy enterprises during off-peak hours
2. **TTL Tuning**: Adjust based on data change frequency
3. **Monitoring**: Watch hit rates and response times
4. **Cleanup**: Let automatic cleanup handle memory management

## 🔍 Quick Debugging

```bash
# Check cache status
curl -H "Authorization: Bearer $TOKEN" localhost:8383/cache/stats

# Force cache refresh
curl -X DELETE -H "Authorization: Bearer $TOKEN" localhost:8383/cache/clear

# Test performance
time curl -H "Authorization: Bearer $TOKEN" \
     localhost:8383/enterprise/ENT123/contacts/summary
```

---
**Performance**: 500x improvement • **Memory**: <100MB • **Hit Rate**: >95%
