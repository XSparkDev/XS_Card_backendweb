# Quick Security Alerts Tests

## Test 1: Generate Test Activity Logs

```bash
# Create failed login attempts (should trigger alert)
curl -X POST http://localhost:8383/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "error",
    "resource": "user", 
    "userId": "test-user-123",
    "details": {
      "operation": "login",
      "error": "Invalid credentials",
      "ipAddress": "192.168.1.100"
    }
  }'

# Repeat 4 more times to trigger failed login alert (>3 attempts)
curl -X POST http://localhost:8383/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "error",
    "resource": "user",
    "userId": "test-user-123", 
    "details": {
      "operation": "login",
      "error": "Invalid credentials",
      "ipAddress": "192.168.1.100"
    }
  }'

# Admin account creation (should trigger critical alert)
curl -X POST http://localhost:8383/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "resource": "user",
    "userId": "admin-user-456",
    "details": {
      "role": "admin",
      "name": "Test Admin",
      "email": "admin@test.com"
    }
  }'
```

## Test 2: Wait and Check for Alerts

```bash
# Wait 10 seconds for alert processing
sleep 10

# Get security alerts (replace test-enterprise with actual enterprise ID)
curl -X GET "http://localhost:8383/enterprise/test-enterprise/security/alerts" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"

# Get high severity alerts only
curl -X GET "http://localhost:8383/enterprise/test-enterprise/security/alerts?severity=high" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"
```

## Test 3: Security Logs

```bash
# Get security logs
curl -X GET "http://localhost:8383/enterprise/test-enterprise/security/logs" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"

# Get logs with filters
curl -X GET "http://localhost:8383/enterprise/test-enterprise/security/logs?action=error&timeframe=24h" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"

# Get log statistics  
curl -X GET "http://localhost:8383/enterprise/test-enterprise/security/logs/stats" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"
```

## Test 4: Security Actions

```bash
# Force password reset
curl -X POST "http://localhost:8383/enterprise/test-enterprise/security/actions/force-password-reset" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "reason": "Multiple failed login attempts"
  }'

# Temporary account lock
curl -X POST "http://localhost:8383/enterprise/test-enterprise/security/actions/temp-lock-account" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123", 
    "reason": "Suspicious activity",
    "duration": 1
  }'

# Send security alert
curl -X POST "http://localhost:8383/enterprise/test-enterprise/security/actions/send-security-alert" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Security Alert",
    "message": "Testing security alert system",
    "severity": "medium",
    "recipients": "admins"
  }'
```

## Test 5: Alert Management

```bash
# First get an alert ID
ALERT_ID=$(curl -s -X GET "http://localhost:8383/enterprise/test-enterprise/security/alerts" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" | jq -r '.data.alerts[0].id')

# Acknowledge alert
curl -X POST "http://localhost:8383/enterprise/test-enterprise/security/alerts/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Alert reviewed and acknowledged"
  }'

# Resolve alert  
curl -X POST "http://localhost:8383/enterprise/test-enterprise/security/alerts/$ALERT_ID/resolve" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "Issue resolved",
    "notes": "No further action needed"
  }'
```

## Expected Behavior

1. **Failed Login Alerts**: After 3+ failed login attempts, should create a "failed_login_attempts" alert with high severity
2. **Admin Account Alerts**: Creating admin users should trigger "admin_account_created" with critical severity  
3. **System Error Alerts**: 5+ similar errors should create "system_error" alert
4. **Real-time Processing**: Alerts should appear within 5 minutes of log creation
5. **Enterprise Isolation**: Only enterprise members can see their alerts
6. **Action Execution**: Security actions should work and create corresponding logs
7. **Email Notifications**: Critical/high alerts should send emails to admins