# Individual Permissions System - Frontend E2E Test Responses

## Implementation Summary

✅ **Backend Implementation Completed**
- Added `PUT /api/enterprises/{enterpriseId}/users/{userId}/permissions` endpoint
- Updated `GET /api/enterprises/{enterpriseId}/employees` to include `individualPermissions`
- Created test enterprise with sample users having different permission scenarios

## Test Setup Details

- **Enterprise ID**: `test-enterprise`
- **Department ID**: `sales`
- **Sample Users Created**: 3 users with different role and permission combinations

## 3 Sample API Responses for Frontend E2E Testing

### 1. GET Enterprise Employees Response (with Individual Permissions)

**Endpoint**: `GET /api/enterprises/test-enterprise/employees`

```json
{
  "success": true,
  "employees": [
    {
      "id": "user-001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "Manager",
      "departmentId": "sales",
      "departmentName": "Sales Department",
      "status": "active",
      "lastActive": "2025-08-15T21:57:35.103Z",
      "individualPermissions": {
        "removed": ["createCards", "deleteCards"],
        "added": ["manageAllCards"]
      }
    },
    {
      "id": "user-002",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com",
      "role": "Employee",
      "departmentId": "sales",
      "departmentName": "Sales Department",
      "status": "active",
      "lastActive": "2025-08-15T21:57:35.103Z",
      "individualPermissions": {
        "removed": [],
        "added": ["deleteCards", "exportCards"]
      }
    },
    {
      "id": "user-003",
      "firstName": "Bob",
      "lastName": "Wilson",
      "email": "bob.wilson@example.com",
      "role": "Administrator",
      "departmentId": "sales",
      "departmentName": "Sales Department",
      "status": "active",
      "lastActive": "2025-08-15T21:57:35.103Z",
      "individualPermissions": {
        "removed": ["deleteCards", "manageAllCards"],
        "added": []
      }
    }
  ],
  "totalCount": 3,
  "currentPage": 1,
  "totalPages": 1
}
```

### 2. Update Individual Permissions Success Response

**Endpoint**: `PUT /api/enterprises/test-enterprise/users/user-001/permissions`

**Request Body**:
```json
{
  "individualPermissions": {
    "removed": ["createCards", "deleteCards"],
    "added": ["manageAllCards"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-001",
    "updatedPermissions": {
      "removed": ["createCards", "deleteCards"],
      "added": ["manageAllCards"]
    },
    "timestamp": "2025-08-15T21:57:35.103Z",
    "updatedBy": "admin-user-123"
  }
}
```

### 3. Update Individual Permissions Error Response (Invalid Permission)

**Endpoint**: `PUT /api/enterprises/test-enterprise/users/user-002/permissions`

**Request Body**:
```json
{
  "individualPermissions": {
    "removed": ["invalidPermission"],
    "added": ["anotherInvalidPermission"]
  }
}
```

**Response**:
```json
{
  "status": false,
  "message": "Invalid permissions: invalidPermission, anotherInvalidPermission. Valid permissions are: viewCards, createCards, editCards, deleteCards, manageAllCards, exportCards, shareCards"
}
```

## Permission Calculation Examples

The frontend can use these examples to test permission calculation logic:

### John Doe (Manager)
- **Base Role Permissions**: `["viewCards", "createCards", "editCards", "exportCards", "shareCards"]`
- **Individual Overrides**: Remove `["createCards", "deleteCards"]`, Add `["manageAllCards"]`
- **Effective Permissions**: `["viewCards", "editCards", "exportCards", "shareCards", "manageAllCards"]`

### Jane Smith (Employee)
- **Base Role Permissions**: `["viewCards", "createCards", "editCards", "shareCards"]`
- **Individual Overrides**: Remove `[]`, Add `["deleteCards", "exportCards"]`
- **Effective Permissions**: `["viewCards", "createCards", "editCards", "shareCards", "deleteCards", "exportCards"]`

### Bob Wilson (Administrator)
- **Base Role Permissions**: `["viewCards", "createCards", "editCards", "deleteCards", "manageAllCards", "exportCards", "shareCards"]`
- **Individual Overrides**: Remove `["deleteCards", "manageAllCards"]`, Add `[]`
- **Effective Permissions**: `["viewCards", "createCards", "editCards", "exportCards", "shareCards"]`

## Available Business Card Permissions

```javascript
const VALID_PERMISSIONS = [
  'viewCards',      // Can view business cards
  'createCards',    // Can create new business cards
  'editCards',      // Can edit existing business cards
  'deleteCards',    // Can delete business cards
  'manageAllCards', // Can manage all cards in enterprise
  'exportCards',    // Can export business card data
  'shareCards'      // Can share business cards
];
```

## Frontend Permission Calculation Logic

The frontend should implement this logic (as mentioned in the document):

```javascript
const calculateUserPermissions = (user) => {
  const userRole = user?.role;
  const basePermissions = ROLE_PERMISSIONS[userRole] || [];
  
  let finalPermissions = [...basePermissions];
  
  // Apply individual overrides if they exist
  const individualOverrides = user?.individualPermissions;
  if (individualOverrides) {
    // Remove permissions if specified
    if (individualOverrides.removed) {
      finalPermissions = finalPermissions.filter(p => !individualOverrides.removed.includes(p));
    }
    
    // Add extra permissions if specified
    if (individualOverrides.added) {
      finalPermissions = [...finalPermissions, ...individualOverrides.added];
    }
  }
  
  return finalPermissions;
};
```

## Test Data Access

To use the test data for development/testing:

1. **Enterprise ID**: `test-enterprise`
2. **Available User IDs**: `user-001`, `user-002`, `user-003`
3. **API Endpoints**:
   - `GET /api/enterprises/test-enterprise/employees`
   - `PUT /api/enterprises/test-enterprise/users/{userId}/permissions`

## Testing Scenarios

1. **Manager with Restrictions**: John Doe - Test removing permissions from a higher role
2. **Employee with Additional Rights**: Jane Smith - Test adding permissions to a lower role  
3. **Administrator with Constraints**: Bob Wilson - Test removing permissions from the highest role

These 3 scenarios cover the main use cases for individual permission overrides in the Business Cards POC.

