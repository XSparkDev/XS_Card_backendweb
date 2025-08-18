# Backend Implementation: Individual Permission Overrides (Business Cards POC)

## Overview
This document outlines the **minimal backend changes** needed to support individual permission overrides for the **Business Cards POC**. The frontend already handles most permission logic - the backend only needs to store and retrieve individual permission overrides.

## Scope
- **Business Cards Page**: For testing the POC
- **Security Page**: For managing individual permissions
- **Other app features**: Will follow later

## Frontend Handles Everything
The frontend already handles:
✅ **Role → Permission Mapping** (in `permissions.ts`)  
✅ **Effective Permission Calculation** (in `permissions.ts`)  
✅ **Permission Checking** (in `permissions.ts`)  
✅ **UI Logic** (in `BusinessCards.tsx` and `Security.tsx`)  
✅ **Permission Inheritance Logic** (individual overrides)  

## Backend Only Needs to Store/Retrieve Data

### Database Schema (Firebase)

#### `enterprises/{enterpriseId}/users/{userId}`
```json
{
  "id": "user123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "role": "Manager",  // ← Already exists
  "departmentName": "Sales",
  "status": "active",
  "lastActive": "2024-01-15T10:30:00Z",
  "individualPermissions": {  // ← NEW: Just add this field
    "removed": ["createCards", "deleteCards"],
    "added": ["manageAllCards"]
  }
}
```

## API Endpoints

### 1. Update User Individual Permissions
**PUT** `/api/enterprises/{enterpriseId}/users/{userId}/permissions`

**Request Body:**
```json
{
  "individualPermissions": {
    "removed": ["createCards", "deleteCards"],
    "added": ["manageAllCards"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "updatedPermissions": {
      "removed": ["createCards", "deleteCards"],
      "added": ["manageAllCards"]
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "updatedBy": "admin123"
  }
}
```

### 2. Get User Data (Include Individual Permissions)
**GET** `/api/enterprises/{enterpriseId}/employees` (existing endpoint)

**Response:** (just add `individualPermissions` to existing response)
```json
{
  "employees": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@company.com",
      "role": "Manager",
      "departmentName": "Sales",
      "individualPermissions": {  // ← NEW: Add this field
        "removed": ["createCards"],
        "added": []
      }
    }
  ]
}
```

## Backend Implementation

### 1. Update User Document
```javascript
// In your existing user update logic
await db.collection('enterprises').doc(enterpriseId)
  .collection('users').doc(userId)
  .update({
    individualPermissions: {
      removed: req.body.individualPermissions.removed || [],
      added: req.body.individualPermissions.added || []
    },
    lastModified: new Date(),
    lastModifiedBy: req.user.id
  });
```

### 2. Include in User Queries
```javascript
// In your existing employee fetch logic
const userData = doc.data();
return {
  ...userData,
  individualPermissions: userData.individualPermissions || { removed: [], added: [] }
};
```

## Frontend Integration

The frontend already has all the logic in `permissions.ts`:

```typescript
// Frontend calculates effective permissions
const calculateUserPermissions = (user: UserWithPermissions): BusinessCardPermission[] => {
  const userRole = user?.role as UserRole;
  const basePermissions = ROLE_PERMISSIONS[userRole] || [];
  
  let finalPermissions: BusinessCardPermission[] = [...basePermissions];
  
  // Apply individual overrides if they exist
  const individualOverrides = user?.individualPermissions;
  if (individualOverrides) {
    // Remove permissions if specified
    if (individualOverrides.removed) {
      finalPermissions = finalPermissions.filter(p => !individualOverrides.removed!.includes(p));
    }
    
    // Add extra permissions if specified
    if (individualOverrides.added) {
      finalPermissions = [...finalPermissions, ...individualOverrides.added];
    }
  }
  
  return finalPermissions;
};
```

## Summary

**Backend Only Needs To:**
1. ✅ Add `individualPermissions` field to user documents
2. ✅ One endpoint to update individual permissions
3. ✅ Include `individualPermissions` in user data responses

**Frontend Handles:**
1. ✅ Role-based permission mapping
2. ✅ Effective permission calculation
3. ✅ Permission checking and UI logic
4. ✅ Security page permission management UI
5. ✅ Business Cards page permission enforcement

**That's it!** The backend is just a data store - all the permission logic is already in the frontend.
