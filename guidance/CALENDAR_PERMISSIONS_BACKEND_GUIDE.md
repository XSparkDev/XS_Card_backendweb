# Calendar Permissions Backend Implementation Guide

## 📋 Overview

The frontend is **100% ready** for calendar permissions implementation. This document outlines what the backend needs to implement based on the existing contacts and business card permissions patterns.

## 🎯 Frontend Readiness Status

### ✅ **Already Implemented:**
- Calendar permissions UI in Security Settings
- Permission checks throughout Calendar component
- Mock system for testing (currently active)
- Scalable permission routing system
- Mixed permission type handling
- Production-ready UI components

### 🔄 **Currently Mocked:**
- Calendar permissions are stored in-memory for testing
- No actual backend calls for calendar permissions
- Permission modals disabled for testing

## 📡 API Endpoints Required

### 1. **Calendar Permissions Endpoint**

**Endpoint:** `PUT /enterprise/:enterpriseId/users/:userId/calendar-permissions`

**Headers:**
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "individualPermissions": {
    "added": ["viewCalendar", "createMeetings"],
    "removed": ["manageAllMeetings"]
  }
}
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Calendar permissions updated successfully",
  "data": {
    "userId": "X8zi8avT5OdPH0lbCq7q482fYOu1",
    "updatedPermissions": {
      "added": ["viewCalendar", "createMeetings"],
      "removed": ["manageAllMeetings"]
    }
  }
}
```

**Expected Response (Error):**
```json
{
  "success": false,
  "message": "Invalid permissions: invalidPermission. Valid permissions are: viewCalendar, createMeetings, manageAllMeetings"
}
```

## 🔐 Valid Calendar Permissions

### **Permission Types:**
1. **`viewCalendar`** - Can view calendar and events
2. **`createMeetings`** - Can create new meetings/events
3. **`manageAllMeetings`** - Can manage all meetings (edit/delete any meeting)

### **Permission Validation:**
- Backend should validate against these exact permission names
- Case-sensitive validation
- Return 400 Bad Request for invalid permissions

## 🏗️ Database Schema Requirements

### **User Permissions Table Enhancement:**
```sql
-- Add calendar permissions to existing permissions structure
-- Example schema (adapt to your existing structure):

ALTER TABLE user_permissions ADD COLUMN calendar_permissions JSON;

-- Or if using a separate table:
CREATE TABLE calendar_permissions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  enterprise_id VARCHAR(255) NOT NULL,
  added_permissions TEXT[],
  removed_permissions TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Permission Inheritance:**
- Calendar permissions should inherit from user roles (Admin, Manager, Employee)
- Individual overrides should take precedence over role defaults
- Support for both adding and removing permissions

## 🔄 Integration with Existing System

### **Permission Routing:**
The frontend uses a scalable routing system that automatically detects permission types:

```typescript
// Frontend automatically routes calendar permissions to:
// /enterprise/:enterpriseId/users/:userId/calendar-permissions

// While business cards go to:
// /api/enterprise/:enterpriseId/users/:userId/permissions

// And contacts go to:
// /enterprise/:enterpriseId/users/:userId/contact-permissions
```

### **Mixed Permission Updates:**
Frontend may send mixed permission types in a single request. Backend should:
1. Detect calendar permissions in the request
2. Route them to the calendar permissions endpoint
3. Handle other permission types separately

## 🧪 Testing Requirements

### **Test Cases:**
1. **Valid Permissions:**
   - `viewCalendar` only
   - `viewCalendar` + `createMeetings`
   - All three permissions
   - Empty arrays (no changes)

2. **Invalid Permissions:**
   - Unknown permission names
   - Malformed permission arrays
   - Missing required fields

3. **Authentication:**
   - Valid Firebase token
   - Invalid/expired token
   - Missing token

4. **Authorization:**
   - User exists in enterprise
   - User doesn't exist
   - Enterprise doesn't exist

## 📊 Expected Frontend Behavior

### **When Backend is Ready:**

1. **Security Settings:**
   - Calendar permissions appear in user permission modal
   - Toggle switches work for each permission
   - Changes save to backend immediately

2. **Calendar Component:**
   - `viewCalendar` = false → Permission error modal
   - `createMeetings` = false → Add Event button disabled
   - `manageAllMeetings` = false → Can only manage own meetings

3. **Permission Inheritance:**
   - Role defaults apply automatically
   - Individual overrides take precedence
   - Changes reflect immediately in UI

## 🔧 Backend Implementation Steps

### **Phase 1: Basic Endpoint**
1. Create calendar permissions endpoint
2. Implement permission validation
3. Add database storage
4. Test with frontend

### **Phase 2: Integration**
1. Integrate with existing permission system
2. Add role-based defaults
3. Implement permission inheritance
4. Add audit logging

### **Phase 3: Testing**
1. Test all permission combinations
2. Test mixed permission updates
3. Test error scenarios
4. Performance testing

## 🚀 Frontend Integration Points

### **To Enable Real Backend Integration:**

1. **In `api.ts`:**
   ```typescript
   // Uncomment this line:
   case 'CALENDAR':
     return await updateUserCalendarPermissions(userId, individualPermissions, enterpriseId);
   ```

2. **In `CalendarMain.tsx`:**
   ```typescript
   // Re-enable permission modals:
   setShowPermissionModal(true); // DISABLED FOR TESTING
   ```

3. **Test the full flow:**
   - Security Settings → User Permissions → Calendar permissions
   - Toggle permissions and verify Calendar UI updates

## 📝 Error Handling

### **Expected Error Responses:**
```json
// 400 Bad Request - Invalid permissions
{
  "success": false,
  "message": "Invalid permissions: invalidPerm. Valid permissions are: viewCalendar, createMeetings, manageAllMeetings"
}

// 401 Unauthorized - Invalid token
{
  "success": false,
  "message": "Authentication required"
}

// 403 Forbidden - No permission to modify user
{
  "success": false,
  "message": "Access denied - You cannot modify this user's permissions"
}

// 404 Not Found - User/Enterprise not found
{
  "success": false,
  "message": "User not found in enterprise"
}
```

## 🎯 Success Criteria

### **Backend is Ready When:**
- ✅ Calendar permissions endpoint responds correctly
- ✅ Permission validation works
- ✅ Database storage/retrieval works
- ✅ Error handling is comprehensive
- ✅ Integration with existing permission system works
- ✅ Performance is acceptable (< 500ms response time)

### **Frontend Integration Complete When:**
- ✅ Security settings can modify calendar permissions
- ✅ Calendar component respects permissions
- ✅ Permission changes reflect immediately
- ✅ Error states are handled gracefully
- ✅ No console errors or warnings

## 📞 Support

For questions about the frontend implementation or integration, refer to:
- `frontend/src/utils/api.ts` - API integration
- `frontend/src/utils/permissions.ts` - Permission definitions
- `frontend/src/components/Dashboard/CalendarMain.tsx` - Calendar component
- `frontend/src/components/Dashboard/Security.tsx` - Security settings

---

**Status:** Frontend Ready ✅ | Backend Implementation Required 🔄
