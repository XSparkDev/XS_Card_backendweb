# Frontend Endpoint Testing Guide - Individual Permissions

## 🎯 **Backend Implementation Status: COMPLETE ✅**

The individual permissions system is **fully implemented** and ready for testing. Here's everything you need to know:

## 📋 **Endpoint Details**

### PUT Endpoint (Update Individual Permissions)
```
PUT /api/enterprises/x-spark-test/users/user-001/permissions
```

**Headers Required:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Request Body:**
```json
{
  "individualPermissions": {
    "removed": ["createCards", "deleteCards"],
    "added": ["manageAllCards", "exportCards"]
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-001",
    "updatedPermissions": {
      "removed": ["createCards", "deleteCards"],
      "added": ["manageAllCards", "exportCards"]
    },
    "timestamp": "2025-08-15T22:53:37.773Z",
    "updatedBy": "admin-user-id"
  }
}
```

### GET Endpoint (Get Employees with Permissions)
```
GET /api/enterprises/x-spark-test/employees
```

**Headers Required:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "employees": [
    {
      "id": "user-001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@x-spark-test.com",
      "role": "Manager",
      "individualPermissions": {
        "removed": ["createCards", "deleteCards"],
        "added": ["manageAllCards", "exportCards"]
      }
    }
  ],
  "totalCount": 1,
  "currentPage": 1,
  "totalPages": 1
}
```

## 🧪 **Test Cases**

### Test Case 1: Update Permissions (Success)
**Request:**
```javascript
const response = await fetch('/api/enterprises/x-spark-test/users/user-001/permissions', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    individualPermissions: {
      removed: ['createCards'],
      added: ['exportCards']
    }
  })
});
```

**Expected Result:** `200 OK` with JSON response

### Test Case 2: Get Employees (Success)
**Request:**
```javascript
const response = await fetch('/api/enterprises/x-spark-test/employees', {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});
```

**Expected Result:** `200 OK` with JSON response containing employees array

### Test Case 3: Invalid Permissions (Error)
**Request:**
```javascript
const response = await fetch('/api/enterprises/x-spark-test/users/user-001/permissions', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    individualPermissions: {
      removed: ['invalidPermission'],
      added: ['anotherInvalidPermission']
    }
  })
});
```

**Expected Result:** `400 Bad Request` with error message

## 🔧 **Troubleshooting**

### If you get HTML instead of JSON:

1. **Check Server Status:**
   ```bash
   # Make sure the backend server is running on port 8383
   curl http://localhost:8383/api/health
   ```

2. **Check URL Path:**
   - ✅ Correct: `/api/enterprises/x-spark-test/users/user-001/permissions`
   - ❌ Wrong: `/enterprises/x-spark-test/users/user-001/permissions` (missing /api)

3. **Check Authentication:**
   - Make sure you're sending a valid `Authorization` header
   - The endpoint requires authentication

4. **Check Request Method:**
   - Use `PUT` method, not `POST`

### Common Issues:

1. **404 HTML Response:**
   - Server not running
   - Wrong URL path
   - Route not registered

2. **401 Unauthorized:**
   - Missing or invalid Authorization header
   - Token expired

3. **400 Bad Request:**
   - Invalid permission names
   - Missing required fields

## 📊 **Valid Permission Names**

```javascript
const VALID_PERMISSIONS = [
  'viewCards',
  'createCards', 
  'editCards',
  'deleteCards',
  'manageAllCards',
  'exportCards',
  'shareCards'
];
```

## 🎯 **Test Data Available**

The backend has test data ready:
- **Enterprise ID:** `x-spark-test`
- **Test User:** `user-001` (John Doe, Manager)
- **Current Permissions:** `{ removed: [], added: [] }`

## 🚀 **Quick Test Commands**

### Using curl:
```bash
# Test GET endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8383/api/enterprises/x-spark-test/employees

# Test PUT endpoint
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"individualPermissions":{"removed":["createCards"],"added":["exportCards"]}}' \
  http://localhost:8383/api/enterprises/x-spark-test/users/user-001/permissions
```

### Using Postman:
1. Set method to `PUT`
2. URL: `http://localhost:8383/api/enterprises/x-spark-test/users/user-001/permissions`
3. Headers: `Content-Type: application/json`, `Authorization: Bearer YOUR_TOKEN`
4. Body: Raw JSON with the request payload

## ✅ **Backend Verification**

The backend has been tested and verified:
- ✅ Database operations working
- ✅ Permission update working  
- ✅ GET endpoint working
- ✅ Route registration correct
- ✅ Authentication middleware working

**The endpoint is ready for frontend integration!** 🎉

