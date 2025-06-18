# Billing Tab API Endpoints - Backend Implementation Guide

This document provides a comprehensive list of all API endpoints needed for the XSCard Billing tab functionality, including example payloads, responses, and implementation notes.

## 🔗 **Table of Contents**
1. [Subscription Management](#subscription-management)
2. [Payment Methods](#payment-methods)
3. [Billing Logs](#billing-logs)
4. [Enterprise Features](#enterprise-features)
5. [Demo Requests & Inquiries](#demo-requests--inquiries)
6. [Authentication](#authentication)

---

## 📊 **Subscription Management**

### 1. Get Subscription Status
**Endpoint:** `GET /subscription/status`  
**Auth Required:** Yes  
**Description:** Get current user's subscription details

**Response:**
```json
{
  "status": true,
  "data": {
    "subscriptionStatus": "active",
    "subscriptionPlan": "MONTHLY_PLAN",
    "subscriptionReference": "sub_1234567890",
    "subscriptionStart": "2025-01-01T00:00:00Z",
    "subscriptionEnd": "2025-07-01T00:00:00Z",
    "trialStartDate": "2025-01-01T00:00:00Z",
    "trialEndDate": "2025-01-15T00:00:00Z",
    "customerCode": "CUS_abcd1234",
    "subscriptionCode": "SUB_efgh5678",
    "isActive": true,
    "plan": "premium",
    "amount": 159.99
  }
}
```

### 2. Get Available Plans
**Endpoint:** `GET /subscription/plans`  
**Auth Required:** Yes  
**Description:** Get all available subscription plans

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "MONTHLY_PLAN",
      "name": "Monthly Subscription",
      "amount": 159.99,
      "interval": "monthly",
      "description": "XS Card Monthly Subscription",
      "trialDays": 0,
      "planCode": "PLN_25xliarx7epm9ct",
      "features": [
        "Unlimited digital business cards",
        "Advanced QR code features",
        "Priority email support",
        "Custom branding and themes",
        "Unlimited contacts",
        "Analytics and insights",
        "Team collaboration tools",
        "API access"
      ]
    },
    {
      "id": "ANNUAL_PLAN",
      "name": "Annual Subscription",
      "amount": 1800.00,
      "interval": "annually",
      "description": "XS Card Annual Subscription",
      "trialDays": 0,
      "planCode": "PLN_kzb7lj21vrehzeq",
      "features": [
        "All Premium features",
        "Save R120 compared to monthly (6.7% savings)",
        "Priority support",
        "Advanced reporting"
      ]
    }
  ]
}
```

### 3. Initialize Payment (Create Subscription)
**Endpoint:** `POST /subscription/initialize`  
**Auth Required:** Yes  
**Description:** Initialize payment for a new subscription

**Request:**
```json
{
  "email": "user@example.com",
  "amount": 15999,
  "planId": "MONTHLY_PLAN"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "access_code_here",
    "reference": "ref_1234567890"
  }
}
```

### 4. Update Subscription Plan
**Endpoint:** `PUT /subscription/plan`  
**Auth Required:** Yes  
**Description:** Direct plan change without payment flow

**Request:**
```json
{
  "planId": "ANNUAL_PLAN",
  "reason": "User requested upgrade to annual plan"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Subscription plan updated successfully",
  "data": {
    "subscriptionCode": "SUB_efgh5678",
    "newPlan": "ANNUAL_PLAN",
    "effectiveDate": "2025-01-20T00:00:00Z"
  }
}
```

### 5. Cancel Subscription
**Endpoint:** `POST /subscription/cancel`  
**Auth Required:** Yes  
**Description:** Cancel user's active subscription

**Request:**
```json
{
  "subscriptionCode": "SUB_efgh5678",
  "reason": "No longer needed",
  "feedback": "Found a different solution",
  "effectiveDate": "end_of_period"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "subscriptionCode": "SUB_efgh5678",
    "cancellationDate": "2025-01-20T00:00:00Z",
    "effectiveDate": "2025-07-01T00:00:00Z"
  }
}
```

---

## 💳 **Payment Methods**

### 6. Get Payment Methods
**Endpoint:** `GET /billing/payment-methods`  
**Auth Required:** Yes  
**Description:** Get user's saved payment methods

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "pm_001",
      "type": "card",
      "brand": "visa",
      "last4": "4242",
      "expiryMonth": 12,
      "expiryYear": 2025,
      "isDefault": true,
      "customerCode": "CUS_abcd1234"
    }
  ]
}
```

### 7. Update Payment Method
**Endpoint:** `PUT /billing/payment-methods/:id`  
**Auth Required:** Yes  
**Description:** Update a payment method's details

**Request:**
```json
{
  "isDefault": false,
  "expiryMonth": 6,
  "expiryYear": 2026
}
```

**Response:**
```json
{
  "status": true,
  "message": "Payment method updated successfully",
  "data": {
    "id": "pm_001",
    "isDefault": false,
    "expiryMonth": 6,
    "expiryYear": 2026
  }
}
```

### 8. Delete Payment Method
**Endpoint:** `DELETE /billing/payment-methods/:id`  
**Auth Required:** Yes  
**Description:** Remove a payment method

**Response:**
```json
{
  "status": true,
  "message": "Payment method deleted successfully"
}
```

---

## 📜 **Billing Logs**

### 9. Get Billing Logs
**Endpoint:** `GET /subscription/logs`  
**Auth Required:** Yes  
**Description:** Get user's billing activity history

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "log_001",
      "action": "subscription_created",
      "resource": "subscription",
      "userId": "user_123",
      "resourceId": "sub_1234567890",
      "timestamp": "2025-06-01T10:30:00Z",
      "details": {
        "type": "subscription",
        "plan": "MONTHLY_PLAN",
        "amount": 159.99,
        "interval": "monthly"
      }
    },
    {
      "id": "log_002",
      "action": "payment_successful",
      "resource": "payment",
      "userId": "user_123",
      "resourceId": "pay_abcd1234",
      "timestamp": "2025-06-01T10:31:00Z",
      "details": {
        "type": "payment",
        "amount": 159.99,
        "plan": "MONTHLY_PLAN"
      }
    }
  ]
}
```

---

## 🏢 **Enterprise Features**

### 10. Get Enterprise Data
**Endpoint:** `GET /enterprise/:enterpriseId`  
**Auth Required:** Yes  
**Description:** Get enterprise organization details

**Response:**
```json
{
  "status": true,
  "data": {
    "enterprise": {
      "id": "PegXyjZYojbLudlmOmDf",
      "name": "Acme Corporation",
      "description": "Leading technology solutions provider",
      "industry": "Technology",
      "website": "https://acme.com",
      "logoUrl": "https://example.com/logo.png",
      "colorScheme": "#1B2B5B",
      "companySize": "large",
      "address": {
        "street": "123 Business St",
        "city": "Cape Town",
        "state": "Western Cape",
        "postalCode": "8001",
        "country": "South Africa"
      }
    }
  }
}
```

### 11. Update Enterprise Data
**Endpoint:** `PUT /enterprise/:enterpriseId`  
**Auth Required:** Yes  
**Description:** Update enterprise organization details

**Request:**
```json
{
  "name": "Acme Corporation Ltd",
  "description": "Leading technology solutions provider",
  "industry": "Technology",
  "website": "https://acme.com",
  "logoUrl": "https://example.com/new-logo.png",
  "colorScheme": "#2B3B7B",
  "companySize": "enterprise",
  "address": {
    "street": "456 New Business Ave",
    "city": "Cape Town",
    "state": "Western Cape",
    "postalCode": "8001",
    "country": "South Africa"
  }
}
```

**Response:**
```json
{
  "status": true,
  "message": "Enterprise updated successfully",
  "data": {
    "enterprise": {
      "id": "PegXyjZYojbLudlmOmDf",
      "name": "Acme Corporation Ltd",
      "description": "Leading technology solutions provider",
      "industry": "Technology",
      "website": "https://acme.com",
      "logoUrl": "https://example.com/new-logo.png",
      "colorScheme": "#2B3B7B",
      "companySize": "enterprise",
      "address": {
        "street": "456 New Business Ave",
        "city": "Cape Town",
        "state": "Western Cape",
        "postalCode": "8001",
        "country": "South Africa"
      }
    }
  }
}
```

### 12. Get Enterprise Invoices
**Endpoint:** `GET /enterprise/invoices`  
**Auth Required:** Yes  
**Description:** Get enterprise invoices (for enterprise customers)

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "inv_001",
      "waveAppsInvoiceId": "WA_INV_001",
      "number": "INV-2025-001",
      "date": "2025-01-01",
      "dueDate": "2025-01-31",
      "amount": 12000.00,
      "currency": "ZAR",
      "status": "paid",
      "downloadUrl": "/api/invoices/inv_001/download",
      "lineItems": [
        {
          "description": "XSCard Enterprise License - January 2025",
          "quantity": 1,
          "rate": 12000.00,
          "amount": 12000.00
        }
      ]
    }
  ]
}
```

### 13. Download Invoice
**Endpoint:** `GET /enterprise/invoices/:invoiceId/download`  
**Auth Required:** Yes  
**Description:** Download enterprise invoice PDF

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="invoice-INV-2025-001.pdf"`
- Binary PDF data

---

## 📅 **Demo Requests & Inquiries**

### 14. Submit Demo Request
**Endpoint:** `POST /enterprise/demo`  
**Auth Required:** Yes  
**Description:** Submit a demo request

**Request:**
```json
{
  "companyName": "Acme Corporation",
  "contactPersonName": "John Doe",
  "email": "john@acme.com",
  "phone": "+27 11 123 4567",
  "companySize": "medium",
  "industry": "Technology",
  "estimatedUsers": 50,
  "specificRequirements": "We need custom branding and integration with our CRM",
  "preferredContactTime": "Monday-Friday, 9AM-5PM",
  "currentSolution": "Business cards and networking events",
  "budget": "15k_50k",
  "timeline": "month",
  "inquiryType": "demo",
  "requestType": "enterprise_demo",
  "submittedAt": "2025-01-20T10:30:00Z",
  "source": "settings_billing_tab"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Demo request submitted successfully",
  "data": {
    "inquiryId": "demo_12345",
    "expectedResponse": "within 24 hours"
  }
}
```

### 15. Submit Enterprise Inquiry
**Endpoint:** `POST /enterprise/inquiry`  
**Auth Required:** Yes  
**Description:** Submit a general enterprise inquiry

**Request:**
```json
{
  "companyName": "Acme Corporation",
  "contactPersonName": "Jane Smith",
  "email": "jane@acme.com",
  "phone": "+27 11 123 4568",
  "companySize": "large",
  "industry": "Finance",
  "estimatedUsers": 200,
  "specificRequirements": "Need enterprise-grade security and compliance",
  "preferredContactTime": "Tuesday-Thursday, 10AM-4PM",
  "inquiryType": "pricing",
  "currentSolution": "Multiple vendors",
  "budget": "over_50k",
  "timeline": "quarter",
  "submittedAt": "2025-01-20T14:30:00Z"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Enterprise inquiry submitted successfully",
  "data": {
    "inquiryId": "inquiry_67890",
    "expectedResponse": "within 2 business days"
  }
}
```

---

## 🔐 **Authentication**

All endpoints require authentication using Bearer token:

```
Authorization: Bearer <firebase_token>
```

### Error Responses

All endpoints follow this error format:

```json
{
  "status": false,
  "message": "Error description",
  "error": "SPECIFIC_ERROR_CODE"
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## 🚀 **Implementation Priority**

### Phase 1 (Critical - Needed for MVP):
1. ✅ GET `/subscription/status`
2. ✅ GET `/subscription/plans`
3. ✅ POST `/subscription/initialize`
4. ✅ POST `/subscription/cancel`
5. ✅ GET `/subscription/logs`
6. ✅ PUT `/subscription/plan`

### Phase 2 (Important - Payment Methods Management):
6. ⚠️ GET `/billing/payment-methods` - **IMPLEMENTATION ISSUES - NEEDS REVISION**
7. ⚠️ PUT `/billing/payment-methods/:id` - **IMPLEMENTATION ISSUES - NEEDS REVISION**
8. ⚠️ DELETE `/billing/payment-methods/:id` - **IMPLEMENTATION ISSUES - NEEDS REVISION**

### Phase 3 (Enterprise features):
9. ✅ GET `/enterprise/:enterpriseId`
10. ✅ PUT `/enterprise/:enterpriseId`
11. 🔗 GET `/enterprise/invoices` - **DEPENDS ON WAVE APPS INTEGRATION**
12. 🔗 GET `/enterprise/invoices/:invoiceId/download` - **DEPENDS ON WAVE APPS INTEGRATION**
13. ✅ POST `/enterprise/demo`
14. ✅ POST `/enterprise/inquiry`

---

## 📝 **Implementation Status Notes**

### ✅ **Phase 1 - COMPLETED**
- All core subscription management endpoints working
- Response formats standardized
- Non-intrusive implementation successful

### ⚠️ **Phase 2 - IMPLEMENTATION ISSUES**
**Status:** Implementation completed but experiencing runtime failures
**Files Created:**
- `controllers/billingController.js` ✅ Created
- `routes/billingRoutes.js` ✅ Created  
- Routes registered in `server.js` ✅ Done
- Payment method auto-storage in subscription callbacks ✅ Added

**Known Issues:**
- Runtime failures in payment methods endpoints
- Need to debug and fix implementation
- Non-critical failures - can be revisited later

**Next Steps for Phase 2:**
1. Debug payment methods GET endpoint
2. Fix payment method update/delete operations
3. Test Paystack integration for payment method storage
4. Verify database schema and operations

### ✅ **Phase 3 - COMPLETED** (except Wave Apps dependent features)
**Status:** All implementable endpoints working successfully
**Files Created/Modified:**
- `controllers/enterpriseController.js` ✅ Extended with new functions
- `routes/enterpriseRoutes.js` ✅ New routes added
- Response format standardization ✅ Completed
- Activity logging integration ✅ Added

**✅ Completed Endpoints:**
- GET `/enterprise/:enterpriseId` ✅ Working
- PUT `/enterprise/:enterpriseId` ✅ Working  
- POST `/enterprise/demo` ✅ Working
- POST `/enterprise/inquiry` ✅ Working

**🔗 Wave Apps Integration Dependent:**
- GET `/enterprise/invoices` - Requires Wave Apps invoicing system
- GET `/enterprise/invoices/:invoiceId/download` - Requires Wave Apps invoicing system
- Implementation is ready, waiting on Wave Apps integration

**Phase 3 Status:** Complete for current scope

---

## 📝 **Notes for Backend Implementation**

1. **Authentication**: Use Firebase Admin SDK to verify tokens
2. **Database**: Store subscription data, payment methods, billing logs
3. **Payment Processing**: Integrate with Paystack for South African payments
4. **Email Notifications**: Send confirmation emails for demo requests
5. **File Storage**: Store enterprise logos and invoice PDFs
6. **Rate Limiting**: Implement rate limiting for inquiry endpoints
7. **Validation**: Validate all input data, especially email and phone formats
8. **Logging**: Log all billing operations for audit trails
9. **Webhooks**: Handle Paystack webhooks for payment status updates
10. **Error Handling**: Provide clear error messages for all failure scenarios

This specification covers all functionality needed for the XSCard Billing tab! 