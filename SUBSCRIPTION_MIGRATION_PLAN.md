# Subscription System Migration Plan

## Phase 1 Status: ✅ COMPLETED
**Date:** Current
**Changes Made:**
- ✅ Added `subscriptionHistory` collection support
- ✅ Created helper functions: `createSubscriptionHistory`, `getUserSubscriptionHistory`, `getUserSubscriptionHistoryCount`
- ✅ Modified `updateCancellationInDatabase` to create history records
- ✅ Modified `handleSubscriptionWebhook` to create history records for webhook cancellations
- ✅ Added new endpoint: `GET /subscription/history`
- ✅ All existing functionality preserved (non-breaking changes)

## Phase 2 Status: ✅ COMPLETED
**Date:** Current
**Changes Made:**
- ✅ Modified subscription creation functions to store only RBAC fields in users collection
- ✅ All subscription details now go to subscriptions collection (single source of truth)
- ✅ Modified `getSubscriptionStatus` to prioritize subscriptions collection data
- ✅ Added automatic user record cleanup in `updateCancellationInDatabase`
- ✅ Added `cleanupUserSubscriptionFields` helper function
- ✅ Added `POST /subscription/cleanup` endpoint for manual cleanup
- ✅ Added automatic cleanup in `getSubscriptionStatus` (gradual cleanup strategy)
- ✅ User records now only contain: `plan`, `subscriptionStatus`, essential RBAC fields

## Current Issues
- `users` collection cluttered with subscription fields
- `subscriptions` collection updates status instead of archiving
- No `subscriptionHistory` collection exists
- Cancellation doesn't clean up user records properly
- Data duplication between users/subscriptions collections

## Goals
- **Separate subscription data from user data** (users collection should be lean)
- **Move cancelled subscriptions to subscriptionHistory** (not update in place)
- **Clean user records on cancellation** (remove subscription clutter)
- **Each cancellation = new history record** (linked by userId)
- **Keep business data permanently** in separate collection

---

## Migration Plan (Non-Intrusive)

### Phase 1: Add History Collection (No Breaking Changes)
- **Create `subscriptionHistory` collection** alongside existing structure
- **Modify cancellation flow** to also create history record (additive)
- **Keep existing structure working** for now

### Phase 2: Clean Up User Records (Gradual)
- **Stop writing new subscription fields** to users collection
- **Read from subscriptions collection** instead of users for subscription data
- **Clean existing user records** during normal operations

### Phase 3: Remove Redundancy (Final Cleanup)
- **Remove subscription fields** from users collection entirely
- **Delete cancelled records** from subscriptions collection (they're in history)
- **Update all queries** to use new structure

---

## Test Request List

### Setup Data First
```bash
# 1. Create a test user account
POST /api/AddUser - Done ✅
{
  "name": "Test",
  "surname": "User", 
  "email": "testuser@example.com",
  "password": "TestPassword123",
  "occupation": "Tester",
  "company": "Test Corp"
}

# 2. Sign in to get auth token
POST /api/SignIn - Done ✅
{
  "email": "testuser@example.com",
  "password": "TestPassword123"
}
```

### Test Subscription Activation
```bash
# 3. Get available plans
GET /api/subscription/plans - Done ✅
Authorization: Bearer <token>

# 4. Initialize trial subscription
POST /api/subscription/trial/initialize
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}

# 5. Check subscription status after trial setup
GET /api/subscription/status - Done ✅
Authorization: Bearer <token>

# 6. Initialize regular subscription (different user)
POST /api/subscription/initialize  - Done ✅
Authorization: Bearer <token>
{
  "planId": "ANNUAL_PLAN"
}
```

### Test Cancellation Flow
```bash
# 7. Cancel subscription
POST /api/subscription/cancel - Done ✅
Authorization: Bearer <token>
{
  "code": "<subscription_code_from_status>",
  "reason": "Testing cancellation",
  "feedback": "Just testing the flow"
}

# 7a. DEBUG: Check subscription history immediately after cancellation
GET /api/subscription/history - Done ✅
Authorization: Bearer <token>

# 8. Check status after cancellation
GET /api/subscription/status - Done ✅
Authorization: Bearer <token>

# 9. Check user profile (should be downgraded)
GET /api/Users/<user_id> - Done ✅
Authorization: Bearer <token>
```

### Test Edge Cases

#### Multiple Subscribe/Cancel Cycles
```bash
# 10. Subscribe again (same user)
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}

# 11. Cancel again
POST /api/subscription/cancel - Done ✅
Authorization: Bearer <token>
{
  "code": "<new_subscription_code>",
  "reason": "Testing multiple cancellations"
}

# 12. Subscribe third time with different plan
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "ANNUAL_PLAN"
}

# 13. Cancel third time
POST /api/subscription/cancel - Done ✅
Authorization: Bearer <token>
{
  "code": "<third_subscription_code>",
  "reason": "Testing frequent cancellation pattern"
}
```

#### Plan Changes
```bash
# 14. Subscribe monthly
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}

# 15. Update to annual plan
PUT /api/subscription/plan
Authorization: Bearer <token>
{
  "planId": "ANNUAL_PLAN",
  "reason": "Testing plan upgrade"
}

# 16. Check status after plan change
GET /api/subscription/status - Done ✅
Authorization: Bearer <token>
```

#### Rapid Cancel/Resubscribe
```bash
# 17. Subscribe
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}

# 18. Cancel immediately
POST /api/subscription/cancel - Done ✅
Authorization: Bearer <token>
{
  "code": "<subscription_code>",
  "reason": "Immediate cancellation test"
}

# 19. Subscribe again within minutes
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}
```

### Test Data Integrity
```bash
# 20. Get subscription logs
GET /api/subscription/logs?limit=50 - Done ✅
Authorization: Bearer <token>

# 21. Check user data consistency
GET /api/Users/<user_id> - Done ✅
Authorization: Bearer <token>

# 22. Verify subscription status
GET /api/subscription/status - Done ✅
Authorization: Bearer <token>

# 23. Check subscription history (Phase 1 - New endpoint)
GET /api/subscription/history?limit=10 - Done ✅
Authorization: Bearer <token>

# 24. Test user record cleanup (Phase 2 - New endpoint)
POST /api/subscription/cleanup - Done ✅
Authorization: Bearer <token>
```

### Test Webhook Simulation - Skipped
```bash
# 25. Simulate webhook cancellation (if you have webhook endpoint accessible)
POST /api/subscription/webhook
{
  "event": "subscription.disable",
  "data": {
    "customer": {
      "email": "testuser@example.com"
    },
    "subscription": {
      "subscription_code": "<active_subscription_code>"
    }
  }
}
```

### Test Phase 2 Data Separation
```bash
# 26. Subscribe and verify data separation
POST /api/subscription/trial/initialize - Done ✅
Authorization: Bearer <token>
{
  "planId": "MONTHLY_PLAN"
}

# 27. Check that user record is clean (only RBAC fields)
GET /api/Users/<user_id> - Done ✅
Authorization: Bearer <token>

# 28. Verify subscription details are in subscriptions collection
GET /api/subscription/status - Done ✅
Authorization: Bearer <token>

# 29. Test automatic cleanup during status check
GET /api/subscription/status - Skipped
Authorization: Bearer <token>

# 30. Verify user record was auto-cleaned (check logs for cleanup message)
GET /api/Users/<user_id> - Skipped
Authorization: Bearer <token>
```

---

## What to Look For During Testing

### 1. Data Duplication Issues
- [ ] Check if subscription data appears in both `users` and `subscriptions` collections
- [ ] Verify same data isn't stored redundantly
- [ ] Look for inconsistencies between collections

### 2. Cleanup on Cancellation
- [ ] User `plan` field changes to 'free' after cancellation
- [ ] User subscription fields are removed/nullified
- [ ] Active subscription record is properly handled
- [ ] History record is created with complete data

### 3. History Creation (Phase 1)
- [ ] Cancelled subscriptions create records in `subscriptionHistory` collection
- [ ] History records contain all necessary business data
- [ ] Records are properly linked by `userId`
- [ ] Sequential numbering works (`subscriptionNumber`)
- [ ] New `/subscription/history` endpoint returns user's history
- [ ] Both user-initiated and webhook cancellations create history

### 4. User Record Cleanup (Phase 2)
- [ ] New subscriptions only store RBAC fields in users collection (`plan`, `subscriptionStatus`)
- [ ] All subscription details go to subscriptions collection
- [ ] User records are automatically cleaned during `getSubscriptionStatus` calls
- [ ] Manual cleanup endpoint `/subscription/cleanup` works
- [ ] Cancellation removes subscription fields from user records
- [ ] User records contain no subscription-specific fields after cleanup

### 5. Data Separation (Phase 2)
- [ ] `getSubscriptionStatus` prioritizes subscriptions collection data
- [ ] Users collection only contains essential RBAC fields
- [ ] Subscriptions collection is the single source of truth for subscription details
- [ ] Plan details are stored in subscriptions collection for easy access
- [ ] Backward compatibility maintained for existing data

### 6. Multiple Cancellations
- [ ] Each cancellation creates separate history record
- [ ] All records have same `userId` but different document IDs
- [ ] `subscriptionNumber` increments correctly
- [ ] No data is overwritten in history

### 7. Query Performance
- [ ] Active subscription queries are fast (small collection)
- [ ] History queries work efficiently with `userId` filter
- [ ] No unnecessary data fetching

### 8. Data Consistency
- [ ] User `plan` matches actual subscription status
- [ ] `subscriptionStatus` reflects current state
- [ ] No orphaned data in any collection
- [ ] Payment data is preserved where needed

### 9. Edge Case Handling
- [ ] Rapid cancel/resubscribe doesn't break system
- [ ] Plan changes are properly recorded
- [ ] Short-duration subscriptions are handled
- [ ] Webhook events update correct records

### 10. Business Intelligence
- [ ] Can query user's complete subscription history
- [ ] Can identify frequent cancellers
- [ ] Revenue data is preserved
- [ ] Cancellation reasons are tracked