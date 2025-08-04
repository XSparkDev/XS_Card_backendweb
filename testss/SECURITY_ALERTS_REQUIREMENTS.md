# 🔒 Security Alerts System - Backend Requirements Document

## 📋 **Overview**
This document outlines the backend requirements for implementing a comprehensive security alerts system for enterprise user management. The system will provide real-time security monitoring, actionable alerts, and enterprise-isolated data handling.

---

## 🎯 **Security Alert Types We Can Handle**

### **1. Authentication Security Alerts**
Based on backend logs: **User Login/Logout**, **User Errors**

| Alert Type | Trigger | Severity | Description |
|------------|---------|----------|-------------|
| `failed_login_attempts` | >3 failed logins in 1 hour | `high` | Multiple failed login attempts detected |
| `unusual_login_time` | Login outside business hours | `medium` | Login detected outside normal hours |
| `new_location_login` | Login from new IP/location | `medium` | Login from previously unseen location |
| `account_lockout` | Account temporarily locked | `high` | Account locked due to security policy |
| `suspicious_logout` | Immediate logout after login | `low` | User logged out immediately after login |

### **2. Account Management Alerts**
Based on backend logs: **User Registration**, **Profile Updates**, **Account Deactivation**

| Alert Type | Trigger | Severity | Description |
|------------|---------|----------|-------------|
| `admin_account_created` | New admin user registered | `critical` | New administrator account created |
| `admin_profile_changed` | Admin profile modified | `high` | Administrator profile information changed |
| `account_deactivated` | User account deactivated | `medium` | User account has been deactivated |
| `password_changed` | Admin password changed | `high` | Administrator password was changed |
| `bulk_user_operation` | >5 users affected | `medium` | Bulk operation affecting multiple users |

### **3. System Security Alerts**
Based on backend logs: **User Errors**, **System Errors**

| Alert Type | Trigger | Severity | Description |
|------------|---------|----------|-------------|
| `system_error` | Critical system error | `critical` | System error affecting user management |
| `api_rate_limit` | Rate limit exceeded | `medium` | API rate limit exceeded |
| `database_error` | Database connection issues | `critical` | Database connectivity problems |
| `authentication_error` | Auth system failure | `critical` | Authentication system malfunction |

### **4. Compliance & Audit Alerts**
Based on backend logs: **Email Sending**, **Enterprise Updates**

| Alert Type | Trigger | Severity | Description |
|------------|---------|----------|-------------|
| `large_data_export` | >100 records exported | `medium` | Large data export detected |
| `email_sent_to_external` | Email to external domain | `low` | Email sent to external domain |
| `enterprise_settings_changed` | Enterprise config modified | `high` | Enterprise settings modified |

---

## 📡 **Backend API Endpoints Required**

### **Core Security Alerts Endpoints**
```typescript
// Fetch security alerts for enterprise
GET /enterprise/:enterpriseId/security/alerts
GET /enterprise/:enterpriseId/security/alerts?severity=high&type=failed_login
GET /enterprise/:enterpriseId/security/alerts?status=unacknowledged

// Acknowledge/Resolve alerts
POST /enterprise/:enterpriseId/security/alerts/:alertId/acknowledge
POST /enterprise/:enterpriseId/security/alerts/:alertId/resolve

// Security logs for detailed investigation
GET /enterprise/:enterpriseId/security/logs
GET /enterprise/:enterpriseId/security/logs?userId=:userId&timeframe=24h

// Security actions
POST /enterprise/:enterpriseId/security/actions/force-password-reset
POST /enterprise/:enterpriseId/security/actions/temp-lock-account
POST /enterprise/:enterpriseId/security/actions/send-security-alert
```

---

## 📊 **Expected Backend Response Payloads**

### **1. Security Alerts List Response**
```typescript
interface SecurityAlertsResponse {
  status: boolean;
  data: {
    alerts: SecurityAlert[];
    totalCount: number;
    unacknowledgedCount: number;
    criticalCount: number;
  };
}

interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
  timestamp: string; // ISO 8601
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: {
    id: string;
    name: string;
    email: string;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    failedAttempts?: number;
    affectedUsers?: number;
    errorCode?: string;
    logEntryId?: string;
  };
  actions: SecurityAction[];
}

type SecurityAlertType = 
  | 'failed_login_attempts'
  | 'unusual_login_time'
  | 'new_location_login'
  | 'account_lockout'
  | 'suspicious_logout'
  | 'admin_account_created'
  | 'admin_profile_changed'
  | 'account_deactivated'
  | 'password_changed'
  | 'bulk_user_operation'
  | 'system_error'
  | 'api_rate_limit'
  | 'database_error'
  | 'authentication_error'
  | 'large_data_export'
  | 'email_sent_to_external'
  | 'enterprise_settings_changed';

interface SecurityAction {
  id: string;
  name: string;
  description: string;
  type: 'button' | 'link' | 'dropdown';
  action: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}
```

### **2. Security Logs Response**
```typescript
interface SecurityLogsResponse {
  status: boolean;
  data: {
    logs: SecurityLog[];
    totalCount: number;
    hasMore: boolean;
    lastTimestamp?: string;
  };
}

interface SecurityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
}
```

### **3. Security Action Response**
```typescript
interface SecurityActionResponse {
  status: boolean;
  message: string;
  data?: {
    actionId: string;
    result: string;
    affectedUsers?: number;
    emailSent?: boolean;
  };
}
```

---

## 🎨 **Frontend UI Components Required**

### **1. Security Alerts Dashboard**
- **Alert Cards**: Color-coded by severity (red=critical, orange=high, yellow=medium, blue=low)
- **Alert Filters**: By severity, type, status, date range
- **Alert Actions**: Acknowledge, resolve, take action buttons
- **Real-time Updates**: WebSocket or polling for new alerts

### **2. Alert Detail Modal**
- **Full Alert Information**: Complete alert details and metadata
- **User Context**: Affected user information and recent activity
- **Action Buttons**: Security actions (reset password, lock account, etc.)
- **Timeline**: Related security events and actions taken

### **3. Security Logs Viewer**
- **Log Table**: Sortable, filterable security event logs
- **Search Functionality**: Search by user, action, IP, etc.
- **Export Capability**: Export logs for compliance/audit
- **Real-time Streaming**: Live log updates

---

## 🛠 **Additional Features Not Mentioned**

### **1. Predictive Security**
```typescript
// Alert patterns and predictions
interface SecurityPrediction {
  userId: string;
  riskScore: number; // 0-100
  predictedThreats: string[];
  recommendedActions: SecurityAction[];
}
```

### **2. Security Score Dashboard**
```typescript
interface SecurityScore {
  overallScore: number; // 0-100
  categoryScores: {
    authentication: number;
    accountManagement: number;
    systemHealth: number;
    compliance: number;
  };
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}
```

### **3. Automated Response Rules**
```typescript
interface SecurityRule {
  id: string;
  name: string;
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  enabled: boolean;
  priority: number;
}

interface SecurityCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}
```

### **4. Security Reports**
- **Daily/Weekly/Monthly Security Reports**
- **Compliance Reports** (GDPR, SOC2, etc.)
- **User Activity Reports**
- **Threat Intelligence Integration**

---

## 🔧 **Technical Implementation Details**

### **1. Enterprise Isolation**
```typescript
// All endpoints must be enterprise-scoped
const buildSecurityUrl = (endpoint: string) => 
  buildEnterpriseUrl(`/enterprise/:enterpriseId/security${endpoint}`);

// Authentication headers
const getSecurityHeaders = () => getEnterpriseHeaders();
```

### **2. Real-time Updates**
```typescript
// WebSocket connection for live alerts
const securityWebSocket = new WebSocket(
  `ws://localhost:8383/enterprise/${enterpriseId}/security/ws`
);
```

### **3. Alert Acknowledgment System**
```typescript
// Track who acknowledged what and when
interface AlertAcknowledgment {
  alertId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
  notes?: string;
}
```

---

## 📋 **Backend Requirements Summary**

### **Required Backend Features:**
1. **Enterprise-scoped security alert generation** from existing logs
2. **Real-time alert processing** and notification system
3. **Alert acknowledgment and resolution** tracking
4. **Security action execution** (password reset, account lock, etc.)
5. **Comprehensive security logging** with metadata
6. **Alert filtering and search** capabilities
7. **WebSocket support** for real-time updates
8. **Export functionality** for compliance reporting

### **Database Schema Requirements:**
```sql
-- Security alerts table
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY,
  enterprise_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID,
  timestamp TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  acknowledged_by UUID,
  metadata JSONB,
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(id)
);

-- Security logs table
CREATE TABLE security_logs (
  id UUID PRIMARY KEY,
  enterprise_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  location VARCHAR(255),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (enterprise_id) REFERENCES enterprises(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🎯 **Priority Implementation Order**

### **Phase 1: Core Alerts (Week 1)**
1. Failed login attempts detection
2. Admin account changes monitoring
3. Basic alert acknowledgment system

### **Phase 2: Enhanced Monitoring (Week 2)**
1. Unusual login patterns
2. System error alerts
3. Security action buttons

### **Phase 3: Advanced Features (Week 3)**
1. Real-time WebSocket updates
2. Security logs viewer
3. Export and reporting

### **Phase 4: Intelligence (Week 4)**
1. Security scoring
2. Predictive alerts
3. Automated response rules

---

## 🔍 **Existing Backend Logs to Leverage**

Based on the backend logging information provided, here are the relevant logs we can use:

### **User Management Activities:**
- ✅ User Registration - New user creation with email verification
- ✅ Email Verification - Email verification attempts (success/failure)
- ✅ User Login/Logout - Authentication events
- ✅ Profile Updates - User profile modifications
- ✅ Password Changes - Password reset and updates
- ✅ Account Deactivation - User account deactivation
- ✅ User Errors - Failed operations with error details

### **Enterprise Activities:**
- ✅ Enterprise Creation - New enterprise setup
- ✅ Enterprise Updates - Enterprise information changes
- ✅ Enterprise Deletion - Enterprise removal

### **System Activities:**
- ✅ Error Logging - System errors and failures
- ✅ Cache Operations - Cache management activities
- ✅ System Initialization - System startup events

### **Notification Activities:**
- ✅ Email Sending - Email notifications sent
- ✅ Notification Preferences - User preference changes
- ✅ System Notifications - System-wide notifications

---

## 🛡️ **Enterprise Isolation Guarantees**

### **Critical Requirements:**
1. **All endpoints must include `:enterpriseId` parameter**
2. **All database queries must filter by `enterprise_id`**
3. **Authentication must validate enterprise membership**
4. **No cross-enterprise data leakage possible**

### **Security Measures:**
- Enterprise-scoped URL patterns
- Database-level enterprise filtering
- Authentication token enterprise validation
- Frontend enterprise context validation

---

This document provides a comprehensive framework for implementing a robust, enterprise-isolated security alerts system that leverages existing backend logging infrastructure while providing powerful security monitoring and response capabilities. 