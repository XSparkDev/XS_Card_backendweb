# 🎨 Card Template System - Frontend Integration Guide

## 📋 Overview

The Card Template System allows enterprises to create standardized card designs for their employees. Templates define `colorScheme` and `companyLogo` that are automatically applied when employees are added to departments.

### **Key Concepts**
- **Enterprise Templates**: Apply to all departments (created by admins)
- **Department Templates**: Override enterprise templates (created by managers)
- **Template Inheritance**: Department templates > Enterprise templates > Defaults
- **Role-Based Permissions**: Admins can create both, managers only department templates

---

## 🔐 Authentication

All endpoints require authentication via Bearer token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## 📡 API Endpoints

### **1. Create Template**

**Endpoint:** `POST /api/templates`

**Headers:**
```javascript
{
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN',
  'Content-Type': 'application/json'
}
```

**Payload:**
```javascript
{
  "enterpriseId": "enterprise_123",
  "departmentId": "sales-dept",  // Optional - null for enterprise templates
  "name": "Sales Team Template",
  "description": "Aggressive red theme for sales team",
  "colorScheme": "#FF5733",      // Required - hex color
  "companyLogo": "/logos/sales-logo.png"  // Optional
}
```

**Success Response (201):**
```javascript
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "template_abc123",
    "enterpriseId": "enterprise_123",
    "departmentId": "sales-dept",
    "name": "Sales Team Template",
    "description": "Aggressive red theme for sales team",
    "colorScheme": "#FF5733",
    "companyLogo": "/logos/sales-logo.png",
    "createdBy": "user_123",
    "createdByRole": "manager",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "isActive": true
  }
}
```

**Error Responses:**
```javascript
// 400 - Validation Error
{
  "success": false,
  "message": "Enterprise ID, template name, and color scheme are required"
}

// 400 - Invalid Color
{
  "success": false,
  "message": "Color scheme must be a valid hex color (e.g., #FF5733)"
}

// 403 - Permission Denied
{
  "success": false,
  "message": "Managers can only create templates for their own department"
}

// 409 - Duplicate Name
{
  "success": false,
  "message": "A template with name \"Sales Team Template\" already exists for this department"
}
```

---

### **2. List Templates**

#### **Enterprise Templates**
**Endpoint:** `GET /api/templates/:enterpriseId`

**Headers:**
```javascript
{
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN'
}
```

**Query Parameters:**
```javascript
{
  includeInactive: false  // Optional - include deleted templates
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "data": {
    "enterpriseTemplates": [
      {
        "id": "template_abc123",
        "enterpriseId": "enterprise_123",
        "departmentId": null,
        "name": "Corporate Brand Template",
        "colorScheme": "#1B2B5B",
        "companyLogo": "/logos/company-logo.png",
        "createdBy": "admin_123",
        "createdByRole": "admin",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "isActive": true
      }
    ],
    "departmentTemplates": [
      {
        "id": "template_xyz789",
        "enterpriseId": "enterprise_123",
        "departmentId": "sales-dept",
        "name": "Sales Team Template",
        "colorScheme": "#FF5733",
        "companyLogo": "/logos/sales-logo.png",
        "createdBy": "manager_456",
        "createdByRole": "manager",
        "createdAt": "2024-01-15T11:00:00.000Z",
        "updatedAt": "2024-01-15T11:00:00.000Z",
        "isActive": true
      }
    ],
    "total": 2
  }
}
```

#### **Department Templates**
**Endpoint:** `GET /api/templates/:enterpriseId/departments/:departmentId`

**Success Response (200):**
```javascript
{
  "success": true,
  "data": {
    "departmentId": "sales-dept",
    "templates": [
      {
        "id": "template_xyz789",
        "name": "Sales Team Template",
        "colorScheme": "#FF5733",
        "companyLogo": "/logos/sales-logo.png",
        "createdBy": "manager_456",
        "createdByRole": "manager",
        "createdAt": "2024-01-15T11:00:00.000Z",
        "updatedAt": "2024-01-15T11:00:00.000Z",
        "isActive": true
      }
    ],
    "total": 1
  }
}
```

---

### **3. Get Individual Template**

**Endpoint:** `GET /api/templates/template/:templateId`

**Headers:**
```javascript
{
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN'
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "data": {
    "id": "template_xyz789",
    "enterpriseId": "enterprise_123",
    "departmentId": "sales-dept",
    "name": "Sales Team Template",
    "description": "Aggressive red theme for sales team",
    "colorScheme": "#FF5733",
    "companyLogo": "/logos/sales-logo.png",
    "createdBy": "manager_456",
    "createdByRole": "manager",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z",
    "isActive": true
  }
}
```

**Error Response (404):**
```javascript
{
  "success": false,
  "message": "Template not found"
}
```

---

### **4. Update Template**

**Endpoint:** `PUT /api/templates/:templateId`

**Headers:**
```javascript
{
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN',
  'Content-Type': 'application/json'
}
```

**Payload (all fields optional):**
```javascript
{
  "name": "Updated Sales Template",
  "description": "Updated description",
  "colorScheme": "#E74C3C",
  "companyLogo": "/logos/new-sales-logo.png",
  "isActive": true
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": "template_xyz789",
    "name": "Updated Sales Template",
    "description": "Updated description",
    "colorScheme": "#E74C3C",
    "companyLogo": "/logos/new-sales-logo.png",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

**Error Responses:**
```javascript
// 400 - Invalid Color
{
  "success": false,
  "message": "Color scheme must be a valid hex color (e.g., #FF5733)"
}

// 409 - Duplicate Name
{
  "success": false,
  "message": "A template with name \"Updated Sales Template\" already exists for this department"
}
```

---

### **5. Delete Template**

**Endpoint:** `DELETE /api/templates/:templateId`

**Headers:**
```javascript
{
  'Authorization': 'Bearer YOUR_FIREBASE_ID_TOKEN'
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "message": "Template deleted successfully"
}
```

**Note:** This is a soft delete - the template is marked as inactive but not permanently removed.

---

## 🎯 Additional Endpoints

### **Get Effective Template (with inheritance)**

**Endpoint:** `GET /api/templates/:enterpriseId/:departmentId/effective`

**Success Response (200):**
```javascript
{
  "success": true,
  "data": {
    "template": {
      "id": "template_xyz789",
      "name": "Sales Team Template",
      "colorScheme": "#FF5733",
      "companyLogo": "/logos/sales-logo.png"
    },
    "source": "department",
    "inheritance": "Department template overrides enterprise template"
  }
}
```

**No Template Found (200):**
```javascript
{
  "success": true,
  "data": null,
  "message": "No templates found for this department or enterprise",
  "fallback": {
    "colorScheme": "#1B2B5B",
    "companyLogo": null
  }
}
```

### **Preview Template**

**Endpoint:** `GET /api/templates/template/:templateId/preview`

**Query Parameters:**
```javascript
{
  employeeName: "John Doe",
  employeeEmail: "john.doe@company.com",
  employeeTitle: "Sales Representative",
  employeePhone: "+1234567890"
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "data": {
    "template": {
      "id": "template_xyz789",
      "name": "Sales Team Template",
      "description": "Aggressive red theme for sales team",
      "colorScheme": "#FF5733",
      "companyLogo": "/logos/sales-logo.png",
      "source": "department"
    },
    "previewCard": {
      "name": "John",
      "surname": "Doe",
      "email": "john.doe@company.com",
      "phone": "+1234567890",
      "occupation": "Sales Representative",
      "company": "Company Name",
      "colorScheme": "#FF5733",
      "companyLogo": "/logos/sales-logo.png",
      "templateId": "template_xyz789",
      "templateName": "Sales Team Template",
      "templateSource": "department"
    },
    "enterprise": {
      "id": "enterprise_123",
      "name": "Company Name",
      "logoUrl": "/logos/company-logo.png"
    }
  }
}
```

---

## 🔐 Permission Rules

### **Template Creation Permissions**
- **Admin**: Can create enterprise templates AND department templates
- **Manager**: Can only create templates for their own department
- **Employee**: Cannot create templates (403 Forbidden)

### **Template Access Permissions**
- **Admin**: Can view/edit all templates in their enterprise
- **Manager**: Can view/edit templates for their department + enterprise templates
- **Employee**: Can view templates but cannot edit

### **Common Permission Errors**
```javascript
// Employee trying to create template
{
  "success": false,
  "message": "Employees cannot create or modify templates"
}

// Manager trying to create enterprise template
{
  "success": false,
  "message": "Managers cannot create enterprise-level templates"
}

// Manager trying to create template for different department
{
  "success": false,
  "message": "Managers can only create templates for their own department"
}
```

---

## 🎨 Template Inheritance Logic

### **Priority Order**
1. **Department Template** (highest priority)
2. **Enterprise Template** (fallback)
3. **Default Values** (if no templates exist)

### **Example Scenarios**

**Scenario A: Department has template**
```javascript
// Department template overrides enterprise template
colorScheme: "#FF5733"  // From department template
companyLogo: "/logos/sales-logo.png"  // From department template
```

**Scenario B: No department template, enterprise has template**
```javascript
// Uses enterprise template
colorScheme: "#1B2B5B"  // From enterprise template
companyLogo: "/logos/company-logo.png"  // From enterprise template
```

**Scenario C: No templates exist**
```javascript
// Uses defaults
colorScheme: "#1B2B5B"  // Default
companyLogo: null  // Default
```

---

## 🚀 Frontend Integration Examples

### **Create Template Form**
```javascript
const createTemplate = async (templateData) => {
  try {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Template created:', result.data);
      // Update UI - show success message, refresh template list
    } else {
      console.error('Template creation failed:', result.message);
      // Show error message to user
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### **Template List Component**
```javascript
const fetchTemplates = async (enterpriseId) => {
  try {
    const response = await fetch(`/api/templates/${enterpriseId}`, {
      headers: {
        'Authorization': `Bearer ${firebaseToken}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      setEnterpriseTemplates(result.data.enterpriseTemplates);
      setDepartmentTemplates(result.data.departmentTemplates);
    }
  } catch (error) {
    console.error('Failed to fetch templates:', error);
  }
};
```

### **Template Preview Component**
```javascript
const previewTemplate = async (templateId, employeeData) => {
  try {
    const params = new URLSearchParams({
      employeeName: employeeData.name,
      employeeEmail: employeeData.email,
      employeeTitle: employeeData.title
    });
    
    const response = await fetch(`/api/templates/template/${templateId}/preview?${params}`, {
      headers: {
        'Authorization': `Bearer ${firebaseToken}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Display preview card with template styling
      displayPreviewCard(result.data.previewCard);
    }
  } catch (error) {
    console.error('Failed to preview template:', error);
  }
};
```

---

## 📝 Notes for Frontend Implementation

1. **Color Validation**: Always validate hex colors on frontend before sending
2. **Permission Handling**: Check user role before showing create/edit buttons
3. **Template Inheritance**: Show which template is effective for each department
4. **Error Handling**: Display user-friendly error messages
5. **Loading States**: Show loading indicators during API calls
6. **Template Preview**: Use the preview endpoint to show live previews
7. **Soft Delete**: Deleted templates are marked inactive but not removed

---

## 🔧 Testing Endpoints

### **Test Template Creation**
```bash
curl -X POST /api/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enterpriseId": "test-enterprise",
    "name": "Test Template",
    "colorScheme": "#FF5733"
  }'
```

### **Test Template List**
```bash
curl -X GET /api/templates/test-enterprise \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The system is ready for frontend integration! 🎉 