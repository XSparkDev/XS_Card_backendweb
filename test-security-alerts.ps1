# Security Alerts System Test Script (PowerShell)
# This script tests all security endpoints and generates test data

param(
    [string]$BaseUrl = "http://localhost:8383",
    [string]$EnterpriseId = "test-enterprise",
    [string]$UserId = "test-user-123"
)

Write-Host "🔒 Security Alerts System Test Suite" -ForegroundColor Cyan
Write-Host "=================================="
Write-Host "Base URL: $BaseUrl"
Write-Host "Enterprise ID: $EnterpriseId"
Write-Host ""

# Function to make HTTP requests and show results
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [string]$Description
    )
    
    Write-Host "Testing: $Description" -ForegroundColor Blue
    Write-Host "Method: $Method"
    Write-Host "Endpoint: $Endpoint"
    
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer test-token"
    }
    
    try {
        if ($Data) {
            Write-Host "Data: $Data"
            $response = Invoke-RestMethod -Uri "$BaseUrl$Endpoint" -Method $Method -Headers $headers -Body $Data
        } else {
            $response = Invoke-RestMethod -Uri "$BaseUrl$Endpoint" -Method $Method -Headers $headers
        }
        
        Write-Host "Response:"
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody"
        }
    }
    
    Write-Host ""
    Write-Host "---"
    Write-Host ""
}

# Generate test activity logs first
Write-Host "📊 Step 1: Generating Test Activity Logs" -ForegroundColor Yellow
Write-Host ""

# Simulate failed login attempts
for ($i = 1; $i -le 5; $i++) {
    $data = @{
        action = "error"
        resource = "user"
        userId = "test-user-123"
        details = @{
            operation = "login"
            error = "Invalid credentials"
            ipAddress = "192.168.1.100"
            userAgent = "Mozilla/5.0 Test Browser"
        }
    } | ConvertTo-Json -Depth 10
    
    Test-Endpoint -Method "POST" -Endpoint "/api/logs" -Data $data -Description "Failed Login Attempt #$i"
}

# Simulate admin account creation
$adminData = @{
    action = "create"
    resource = "user"
    userId = "admin-user-456"
    details = @{
        role = "admin"
        name = "Test Admin"
        email = "admin@test.com"
        ipAddress = "10.0.0.50"
    }
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/api/logs" -Data $adminData -Description "Admin Account Creation"

# Simulate unusual login time (weekend)
$weekendData = @{
    action = "login"
    resource = "user"
    userId = "test-user-789"
    details = @{
        ipAddress = "203.0.113.1"
        userAgent = "Chrome/96.0"
    }
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/api/logs" -Data $weekendData -Description "Weekend Login"

# Simulate system errors
for ($i = 1; $i -le 8; $i++) {
    $errorData = @{
        action = "error"
        resource = "system"
        userId = "system"
        status = "error"
        details = @{
            error = "Database connection timeout"
            operation = "query_execution"
        }
    } | ConvertTo-Json -Depth 10
    
    Test-Endpoint -Method "POST" -Endpoint "/api/logs" -Data $errorData -Description "System Error #$i"
}

Write-Host "📊 Step 2: Wait for Alert Processing (15 seconds)" -ForegroundColor Yellow
Write-Host "Waiting for alert detection service to process logs..."
Start-Sleep -Seconds 15

Write-Host "🔍 Step 3: Testing Security Alerts Endpoints" -ForegroundColor Yellow
Write-Host ""

# Test getting security alerts
Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/alerts" -Description "Get All Security Alerts"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/alerts?severity=high" -Description "Get High Severity Alerts"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/alerts?type=failed_login_attempts" -Description "Get Failed Login Alerts"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/alerts?status=active" -Description "Get Active Alerts"

Write-Host "📋 Step 4: Testing Security Logs Endpoints" -ForegroundColor Yellow
Write-Host ""

# Test security logs
Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs" -Description "Get Security Logs"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs?timeframe=24h" -Description "Get 24h Security Logs"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs?action=error" -Description "Get Error Logs"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs?search=login" -Description "Search Logs for login"

Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs/stats" -Description "Get Security Log Statistics"

Write-Host "🛡️ Step 5: Testing Security Actions" -ForegroundColor Yellow
Write-Host ""

# Test force password reset
$passwordResetData = @{
    userId = "test-user-123"
    reason = "Multiple failed login attempts detected"
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/enterprise/$EnterpriseId/security/actions/force-password-reset" -Data $passwordResetData -Description "Force Password Reset"

# Test temporary account lock
$accountLockData = @{
    userId = "test-user-123"
    reason = "Suspicious activity detected"
    duration = 2
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/enterprise/$EnterpriseId/security/actions/temp-lock-account" -Data $accountLockData -Description "Temporary Account Lock (2 hours)"

# Test send security alert
$securityAlertData = @{
    title = "Security Test Alert"
    message = "This is a test security alert to verify the system is working."
    severity = "medium"
    recipients = "admins"
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/enterprise/$EnterpriseId/security/actions/send-security-alert" -Data $securityAlertData -Description "Send Security Alert to Admins"

# Test create incident report
$incidentData = @{
    title = "Test Security Incident"
    description = "This is a test incident report to verify incident creation."
    severity = "high"
    affectedSystems = @("authentication", "user_management")
} | ConvertTo-Json -Depth 10

Test-Endpoint -Method "POST" -Endpoint "/enterprise/$EnterpriseId/security/actions/create-incident" -Data $incidentData -Description "Create Incident Report"

Write-Host "📤 Step 6: Testing Export Functionality" -ForegroundColor Yellow
Write-Host ""

# Test export security logs
Test-Endpoint -Method "GET" -Endpoint "/enterprise/$EnterpriseId/security/logs/export?format=json&timeframe=7d" -Description "Export Security Logs (JSON)"

Write-Host "✅ Security Alerts System Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Test Summary:" -ForegroundColor Blue
Write-Host "• Generated test activity logs (failed logins, admin changes, system errors)"
Write-Host "• Tested all security alert endpoints"
Write-Host "• Tested security log viewing and filtering"
Write-Host "• Tested security actions (password reset, account lock, alerts)"
Write-Host "• Tested export functionality"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check server logs for alert detection processing"
Write-Host "2. Verify alerts were created in the database"
Write-Host "3. Test real-time alert generation"
Write-Host "4. Verify email notifications (if configured)"
Write-Host ""