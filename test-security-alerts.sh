#!/bin/bash

# Security Alerts System Test Script
# This script tests all security endpoints and generates test data

BASE_URL="http://localhost:8383"
ENTERPRISE_ID="test-enterprise"
USER_ID="test-user-123"

echo "🔒 Security Alerts System Test Suite"
echo "=================================="
echo "Base URL: $BASE_URL"
echo "Enterprise ID: $ENTERPRISE_ID"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make curl requests and show results
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${BLUE}Testing: $description${NC}"
    echo "Method: $method"
    echo "Endpoint: $endpoint"
    
    if [ -n "$data" ]; then
        echo "Data: $data"
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test-token" \
            -d "$data")
    else
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test-token")
    fi
    
    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    echo "---"
    echo ""
}

# Generate test activity logs first
echo -e "${YELLOW}📊 Step 1: Generating Test Activity Logs${NC}"
echo ""

# Simulate failed login attempts
for i in {1..5}; do
    test_endpoint "POST" "/api/logs" '{
        "action": "error",
        "resource": "user",
        "userId": "test-user-123",
        "details": {
            "operation": "login",
            "error": "Invalid credentials",
            "ipAddress": "192.168.1.100",
            "userAgent": "Mozilla/5.0 Test Browser"
        }
    }' "Failed Login Attempt #$i"
done

# Simulate admin account creation
test_endpoint "POST" "/api/logs" '{
    "action": "create",
    "resource": "user",
    "userId": "admin-user-456",
    "details": {
        "role": "admin",
        "name": "Test Admin",
        "email": "admin@test.com",
        "ipAddress": "10.0.0.50"
    }
}' "Admin Account Creation"

# Simulate unusual login time (weekend)
test_endpoint "POST" "/api/logs" '{
    "action": "login",
    "resource": "user",
    "userId": "test-user-789",
    "details": {
        "ipAddress": "203.0.113.1",
        "userAgent": "Chrome/96.0",
        "timestamp": "'$(date -d "last Saturday 23:30" +%s)'"
    }
}' "Weekend Login"

# Simulate system errors
for i in {1..8}; do
    test_endpoint "POST" "/api/logs" '{
        "action": "error",
        "resource": "system",
        "userId": "system",
        "status": "error",
        "details": {
            "error": "Database connection timeout",
            "operation": "query_execution"
        }
    }' "System Error #$i"
done

echo -e "${YELLOW}📊 Step 2: Wait for Alert Processing (15 seconds)${NC}"
echo "Waiting for alert detection service to process logs..."
sleep 15

echo -e "${YELLOW}🔍 Step 3: Testing Security Alerts Endpoints${NC}"
echo ""

# Test getting security alerts
test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/alerts" "" "Get All Security Alerts"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/alerts?severity=high" "" "Get High Severity Alerts"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/alerts?type=failed_login_attempts" "" "Get Failed Login Alerts"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/alerts?status=active" "" "Get Active Alerts"

echo -e "${YELLOW}📋 Step 4: Testing Security Logs Endpoints${NC}"
echo ""

# Test security logs
test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs" "" "Get Security Logs"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs?timeframe=24h" "" "Get 24h Security Logs"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs?action=error" "" "Get Error Logs"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs?search=login" "" "Search Logs for 'login'"

test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs/stats" "" "Get Security Log Statistics"

echo -e "${YELLOW}🛡️ Step 5: Testing Security Actions${NC}"
echo ""

# Test force password reset
test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/actions/force-password-reset" '{
    "userId": "test-user-123",
    "reason": "Multiple failed login attempts detected"
}' "Force Password Reset"

# Test temporary account lock
test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/actions/temp-lock-account" '{
    "userId": "test-user-123",
    "reason": "Suspicious activity detected",
    "duration": 2
}' "Temporary Account Lock (2 hours)"

# Test send security alert
test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/actions/send-security-alert" '{
    "title": "Security Test Alert",
    "message": "This is a test security alert to verify the system is working.",
    "severity": "medium",
    "recipients": "admins"
}' "Send Security Alert to Admins"

# Test create incident report
test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/actions/create-incident" '{
    "title": "Test Security Incident",
    "description": "This is a test incident report to verify incident creation.",
    "severity": "high",
    "affectedSystems": ["authentication", "user_management"]
}' "Create Incident Report"

echo -e "${YELLOW}📤 Step 6: Testing Export Functionality${NC}"
echo ""

# Test export security logs
test_endpoint "GET" "/enterprise/$ENTERPRISE_ID/security/logs/export?format=json&timeframe=7d" "" "Export Security Logs (JSON)"

echo -e "${YELLOW}🔍 Step 7: Testing Alert Management${NC}"
echo ""

# Get alerts to find one to acknowledge
echo "Getting alert ID for acknowledgment test..."
alert_response=$(curl -s -X GET "$BASE_URL/enterprise/$ENTERPRISE_ID/security/alerts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token")

alert_id=$(echo "$alert_response" | jq -r '.data.alerts[0].id // empty' 2>/dev/null)

if [ -n "$alert_id" ] && [ "$alert_id" != "null" ]; then
    echo "Found alert ID: $alert_id"
    
    # Test acknowledge alert
    test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/alerts/$alert_id/acknowledge" '{
        "notes": "Alert reviewed and acknowledged during testing"
    }' "Acknowledge Security Alert"
    
    # Test resolve alert
    test_endpoint "POST" "/enterprise/$ENTERPRISE_ID/security/alerts/$alert_id/resolve" '{
        "resolution": "Test resolution",
        "notes": "Alert resolved during system testing"
    }' "Resolve Security Alert"
else
    echo -e "${RED}No alert ID found for acknowledgment test${NC}"
fi

echo -e "${GREEN}✅ Security Alerts System Test Complete!${NC}"
echo ""
echo -e "${BLUE}Test Summary:${NC}"
echo "• Generated test activity logs (failed logins, admin changes, system errors)"
echo "• Tested all security alert endpoints"
echo "• Tested security log viewing and filtering"
echo "• Tested security actions (password reset, account lock, alerts)"
echo "• Tested alert acknowledgment and resolution"
echo "• Tested export functionality"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Check server logs for alert detection processing"
echo "2. Verify alerts were created in the database"
echo "3. Test real-time alert generation"
echo "4. Verify email notifications (if configured)"
echo ""