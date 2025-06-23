# **🚨 MISSING ENDPOINTS & PAYLOADS - Grace Period Implementation**

## **📋 Overview**
This document lists all missing endpoints, payloads, and Postman collections needed to implement the grace period functionality according to the implementation plan.

---

## **❌ CRITICAL MISSING ENDPOINTS**

### **1. Scheduled Task Management**
These endpoints are completely missing and need to be created:

#### **Create Scheduled Task**
**Endpoint:** `POST /api/admin/scheduled-tasks`  
**Auth Required:** Admin  
**Description:** Create a new scheduled task

**Request:**
```json
{
  "type": "downgrade_user",
  "userId": "user123",
  "executeAt": "2024-02-15T00:00:00Z",
  "payload": {
    "reason": "Grace period ended",
    "originalPlan": "premium"
  },
  "priority": "normal",
  "retryLimit": 3
}
```

**Response:**
```json
{
  "status": true,
  "message": "Scheduled task created successfully",
  "data": {
    "taskId": "task_abc123",
    "type": "downgrade_user",
    "userId": "user123",
    "executeAt": "2024-02-15T00:00:00Z",
    "status": "pending",
    "createdAt": "2024-01-20T10:30:00Z",
    "nextRetryAt": null,
    "retryCount": 0
  }
}
```

#### **Get Scheduled Tasks**
**Endpoint:** `GET /api/admin/scheduled-tasks`  
**Auth Required:** Admin  
**Query Parameters:**
- `status`: pending|completed|failed|cancelled
- `type`: downgrade_user|send_notification|cleanup_data
- `userId`: filter by user ID
- `limit`: number of results (default: 50)
- `offset`: pagination offset

**Response:**
```json
{
  "status": true,
  "data": {
    "tasks": [
      {
        "taskId": "task_abc123",
        "type": "downgrade_user",
        "userId": "user123",
        "executeAt": "2024-02-15T00:00:00Z",
        "status": "pending",
        "createdAt": "2024-01-20T10:30:00Z",
        "payload": {
          "reason": "Grace period ended"
        },
        "retryCount": 0,
        "lastAttemptAt": null,
        "errorMessage": null
      }
    ],
    "totalCount": 1,
    "hasMore": false
  }
}
```

#### **Execute Scheduled Task (Manual)**
**Endpoint:** `POST /api/admin/scheduled-tasks/:taskId/execute`  
**Auth Required:** Admin  
**Description:** Manually execute a scheduled task

**Response:**
```json
{
  "status": true,
  "message": "Task executed successfully",
  "data": {
    "taskId": "task_abc123",
    "executedAt": "2024-01-20T11:30:00Z",
    "result": "success",
    "details": {
      "userDowngraded": true,
      "planChanged": "premium -> free",
      "accessRevoked": true
    }
  }
}
```

#### **Cancel Scheduled Task**
**Endpoint:** `DELETE /api/admin/scheduled-tasks/:taskId`  
**Auth Required:** Admin  
**Description:** Cancel a pending scheduled task

**Response:**
```json
{
  "status": true,
  "message": "Scheduled task cancelled successfully",
  "data": {
    "taskId": "task_abc123",
    "status": "cancelled",
    "cancelledAt": "2024-01-20T11:30:00Z"
  }
}
```

---

### **2. Grace Period Specific Endpoints**

#### **Reactivate Subscription**
**Endpoint:** `POST /api/subscription/reactivate`  
**Auth Required:** Yes  
**Description:** Reactivate a cancelled subscription during grace period

**Request:**
```json
{
  "planId": "MONTHLY_PLAN",
  "reason": "User decided to continue subscription"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Subscription reactivated successfully",
  "data": {
    "subscriptionCode": "SUB_efgh5678",
    "reactivatedAt": "2024-01-25T10:30:00Z",
    "newStatus": "active",
    "plan": "premium",
    "nextBillingDate": "2024-02-25T00:00:00Z",
    "gracePeriodEnded": true,
    "accessRestoredUntil": null
  }
}
```

#### **Get Grace Period Status**
**Endpoint:** `GET /api/subscription/grace-period-status`  
**Auth Required:** Yes  
**Description:** Get detailed grace period information for current user

**Response:**
```json
{
  "status": true,
  "data": {
    "isInGracePeriod": true,
    "accessExpiresAt": "2024-02-15T00:00:00Z",
    "gracePeriodDays": 25,
    "daysRemaining": 12,
    "canReactivate": true,
    "reactivationDeadline": "2024-02-15T00:00:00Z",
    "originalPlan": "premium",
    "cancellationDate": "2024-01-20T10:30:00Z",
    "cancellationReason": "User requested",
    "scheduledDowngradeTask": {
      "taskId": "task_abc123",
      "executeAt": "2024-02-15T00:00:00Z",
      "status": "pending"
    },
    "notifications": {
      "remindersSent": 1,
      "nextReminderAt": "2024-02-12T00:00:00Z",
      "finalNoticeAt": "2024-02-14T00:00:00Z"
    }
  }
}
```

---

### **3. Notification Management Endpoints**

#### **Queue Notification**
**Endpoint:** `POST /api/notifications/queue`  
**Auth Required:** Admin/System  
**Description:** Queue a notification for sending

**Request:**
```json
{
  "userId": "user123",
  "type": "grace_period_reminder",
  "scheduledFor": "2024-02-12T09:00:00Z",
  "templateData": {
    "userName": "John Doe",
    "daysRemaining": 3,
    "accessExpiresAt": "2024-02-15T00:00:00Z",
    "reactivationUrl": "https://app.xscard.co/billing?reactivate=true"
  },
  "priority": "normal",
  "channel": "email"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Notification queued successfully",
  "data": {
    "notificationId": "notif_xyz789",
    "userId": "user123",
    "type": "grace_period_reminder",
    "scheduledFor": "2024-02-12T09:00:00Z",
    "status": "queued",
    "createdAt": "2024-01-20T10:30:00Z"
  }
}
```

#### **Get Notification Queue**
**Endpoint:** `GET /api/notifications/queue`  
**Auth Required:** Admin  
**Query Parameters:**
- `status`: queued|sent|failed|cancelled
- `type`: grace_period_reminder|cancellation_confirmation|downgrade_notice
- `userId`: filter by user ID
- `limit`: number of results (default: 50)

**Response:**
```json
{
  "status": true,
  "data": {
    "notifications": [
      {
        "notificationId": "notif_xyz789",
        "userId": "user123",
        "type": "grace_period_reminder",
        "scheduledFor": "2024-02-12T09:00:00Z",
        "status": "queued",
        "createdAt": "2024-01-20T10:30:00Z",
        "sentAt": null,
        "errorMessage": null,
        "retryCount": 0
      }
    ],
    "totalCount": 1
  }
}
```

---

## **⚠️ ENDPOINTS REQUIRING UPDATES**

### **1. Enhanced Cancel Subscription**
**Current Endpoint:** `POST /api/subscription/cancel`  
**Required Updates:** Add grace period fields to response

**Updated Response:**
```json
{
  "status": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "subscriptionCode": "SUB_efgh5678",
    "cancellationDate": "2025-01-20T00:00:00Z",
    "effectiveDate": "2025-07-01T00:00:00Z",
    // NEW GRACE PERIOD FIELDS:
    "isInGracePeriod": true,
    "accessExpiresAt": "2025-07-01T00:00:00Z",
    "gracePeriodDays": 25,
    "canReactivate": true,
    "reactivationDeadline": "2025-07-01T00:00:00Z",
    "scheduledTaskId": "task_abc123",
    "nextReminderDate": "2025-01-27T00:00:00Z"
  }
}
```

### **2. Enhanced Subscription Status**
**Current Endpoint:** `GET /api/subscription/status`  
**Required Updates:** Add grace period fields to response

**Updated Response:**
```json
{
  "status": true,
  "data": {
    // ... existing fields ...
    "subscriptionStatus": "cancelled",
    "plan": "premium", // IMPORTANT: Stays premium during grace period
    "isActive": false,
    // NEW GRACE PERIOD FIELDS:
    "isInGracePeriod": true,
    "accessExpiresAt": "2025-07-01T00:00:00Z",
    "gracePeriodEndsAt": "2025-07-01T00:00:00Z",
    "downgradedAt": null,
    "canReactivate": true,
    "daysUntilDowngrade": 12,
    "scheduledDowngradeTaskId": "task_abc123"
  }
}
```

### **3. Enhanced Feature Access Endpoints**
**Current Endpoints:** Various feature check endpoints  
**Required Updates:** Check `plan` field instead of `subscriptionStatus`

**Example - Contact Creation:**
```json
// Before: Check subscriptionStatus
if (user.subscriptionStatus !== 'active') {
  // Deny access
}

// After: Check plan field and grace period
if (user.plan !== 'premium' && !user.isInGracePeriod) {
  // Deny access
}
```

---

## **🆕 ADMIN MONITORING ENDPOINTS**

### **1. Grace Period Analytics**
**Endpoint:** `GET /api/admin/analytics/grace-periods`  
**Auth Required:** Admin  
**Description:** Get analytics on grace period usage

**Response:**
```json
{
  "status": true,
  "data": {
    "summary": {
      "totalUsersInGracePeriod": 45,
      "averageGracePeriodDays": 18.5,
      "reactivationRate": 23.5,
      "topCancellationReasons": [
        { "reason": "Cost concerns", "count": 12 },
        { "reason": "Feature limitations", "count": 8 }
      ]
    },
    "trends": {
      "thisMonth": {
        "cancellations": 67,
        "reactivations": 15,
        "gracePeriodExpiries": 23
      },
      "lastMonth": {
        "cancellations": 82,
        "reactivations": 12,
        "gracePeriodExpiries": 31
      }
    }
  }
}
```

### **2. Task Queue Health**
**Endpoint:** `GET /api/admin/tasks/health`  
**Auth Required:** Admin  
**Description:** Monitor scheduled task system health

**Response:**
```json
{
  "status": true,
  "data": {
    "queueHealth": {
      "pendingTasks": 12,
      "failedTasks": 2,
      "successRate": 94.2,
      "averageExecutionTime": "1.2s",
      "lastProcessedAt": "2024-01-20T11:25:00Z"
    },
    "upcomingTasks": [
      {
        "executeAt": "2024-01-20T12:00:00Z",
        "type": "downgrade_user",
        "count": 3
      },
      {
        "executeAt": "2024-01-21T00:00:00Z",
        "type": "send_notification",
        "count": 15
      }
    ],
    "systemResources": {
      "memoryUsage": "45.2MB",
      "cpuUsage": "12%",
      "diskSpace": "2.3GB available"
    }
  }
}
```

---

## **📧 EMAIL NOTIFICATION TYPES**

### **Template Types Needed:**
1. **`cancellation_confirmation`** - Immediate email after cancellation
2. **`grace_period_reminder_7d`** - 7 days before expiry
3. **`grace_period_reminder_3d`** - 3 days before expiry
4. **`grace_period_reminder_1d`** - 1 day before expiry
5. **`access_termination_notice`** - Final notice when access ends
6. **`reactivation_success`** - Confirmation of reactivation
7. **`downgrade_complete`** - Notification that plan was downgraded

### **Email Template Endpoint**
**Endpoint:** `GET /api/admin/email-templates/:templateType`  
**Auth Required:** Admin  

**Response:**
```json
{
  "status": true,
  "data": {
    "templateType": "grace_period_reminder_3d",
    "subject": "Your XSCard access expires in 3 days",
    "htmlContent": "...",
    "textContent": "...",
    "variables": [
      "userName",
      "daysRemaining", 
      "accessExpiresAt",
      "reactivationUrl"
    ]
  }
}
```

---

## **🧪 POSTMAN COLLECTION UPDATES NEEDED**

### **New Collections Required:**
1. **Grace Period Management**
   - Reactivate subscription
   - Check grace period status
   - Cancel during grace period
   - Monitor grace period analytics

2. **Scheduled Tasks Administration**
   - Create task
   - List pending tasks
   - Execute task manually
   - Cancel task
   - Monitor task health

3. **Notification Management**
   - Queue notification
   - Check notification status
   - Retry failed notifications
   - Manage email templates

### **Updated Collections Required:**
1. **Subscription Management** (update existing)
   - Update cancel response format
   - Update status response format
   - Add grace period fields to all responses

2. **Feature Access Testing** (update existing)
   - Test contact creation during grace period
   - Test card creation during grace period
   - Verify access after grace period expires

---

## **🔍 TESTING SCENARIOS FOR POSTMAN**

### **Critical Test Flows:**
1. **Happy Path Grace Period:**
   - Subscribe → Cancel → Grace Period → Reactivate
   - Subscribe → Cancel → Grace Period → Auto-downgrade

2. **Edge Cases:**
   - Cancel subscription with immediate downgrade
   - Reactivate on last day of grace period
   - Multiple cancellation attempts
   - Task execution failures and retries

3. **Admin Monitoring:**
   - View all users in grace period
   - Monitor task queue health
   - Track grace period analytics
   - Manage failed notifications

---

## **📋 IMPLEMENTATION CHECKLIST**

### **Phase 1 - Missing Backend Endpoints:**
- [ ] Create scheduled task management endpoints
- [ ] Create grace period status endpoints
- [ ] Create reactivation endpoint
- [ ] Create notification queue endpoints
- [ ] Update cancel subscription response
- [ ] Update subscription status response

### **Phase 2 - Admin Tools:**
- [ ] Create admin analytics endpoints
- [ ] Create task monitoring endpoints
- [ ] Create notification management UI endpoints
- [ ] Create grace period management dashboard endpoints

### **Phase 3 - Postman Collections:**
- [ ] Create Grace Period Management collection
- [ ] Create Scheduled Tasks Administration collection
- [ ] Create Notification Management collection
- [ ] Update existing Subscription Management collection
- [ ] Create comprehensive test scenarios

### **Phase 4 - Documentation:**
- [ ] Update API documentation with grace period fields
- [ ] Create admin user guide for grace period management
- [ ] Document all new error codes and responses
- [ ] Create troubleshooting guide for grace period issues

---

This comprehensive list ensures no endpoints or payloads are missed in the grace period implementation. All endpoints listed here are essential for the complete functionality described in the implementation plan. 