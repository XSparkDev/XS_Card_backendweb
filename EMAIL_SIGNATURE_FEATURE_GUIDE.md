# Email Signature Feature Guide

## Overview

The Email Signature feature allows users to create, manage, and automatically apply professional email signatures to all outgoing emails. This feature is similar to Blinq's email signature functionality and provides a comprehensive solution for personal and enterprise users.

## Features

- **Custom Signature Creation**: Users can create personalized email signatures with their contact information
- **Multiple Styles**: Professional, Modern, and Minimal signature styles
- **Template System**: Pre-built templates for quick signature creation
- **Preview Functionality**: Real-time preview of signatures before saving
- **Test Email Feature**: Send test emails to verify signature appearance
- **Enterprise Management**: Bulk signature updates for enterprise users
- **Automatic Application**: Signatures are automatically applied to all outgoing emails
- **Social Media Integration**: Include social media links in signatures
- **Responsive Design**: Signatures work across different email clients

## API Endpoints

### User Signature Management

#### Create/Update Email Signature
```
PATCH /Users/:id/email-signature
```

**Request Body:**
```json
{
  "signatureText": "Custom signature text",
  "signatureHtml": "<div>Custom HTML signature</div>",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional",
  "isActive": true
}
```

#### Get Email Signature
```
GET /Users/:id/email-signature
```

**Response:**
```json
{
  "signature": {
    "signatureText": "Custom signature text",
    "signatureHtml": "<div>Generated HTML signature</div>",
    "includeName": true,
    "includeTitle": true,
    "includeCompany": true,
    "includePhone": true,
    "includeEmail": true,
    "includeWebsite": false,
    "includeSocials": false,
    "signatureStyle": "professional",
    "isActive": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "hasSignature": true
}
```

#### Delete Email Signature
```
DELETE /Users/:id/email-signature
```

### Signature Templates

#### Get Available Templates
```
GET /signature-templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": "professional",
      "name": "Professional",
      "description": "Clean and professional signature style",
      "preview": {
        "name": "John Doe",
        "title": "Senior Developer",
        "company": "Tech Corp",
        "phone": "+1 (555) 123-4567",
        "email": "john.doe@techcorp.com"
      }
    },
    {
      "id": "modern",
      "name": "Modern",
      "description": "Contemporary design with bold typography",
      "preview": {
        "name": "Jane Smith",
        "title": "Marketing Manager",
        "company": "Digital Solutions",
        "phone": "+1 (555) 987-6543",
        "email": "jane.smith@digitalsolutions.com"
      }
    },
    {
      "id": "minimal",
      "name": "Minimal",
      "description": "Simple and clean signature",
      "preview": {
        "name": "Mike Johnson",
        "title": "Designer",
        "company": "Creative Studio",
        "phone": "+1 (555) 456-7890",
        "email": "mike.johnson@creativestudio.com"
      }
    }
  ]
}
```

### Signature Preview

#### Preview Signature
```
POST /Users/:id/signature-preview
```

**Request Body:**
```json
{
  "signatureText": "Custom signature text",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional"
}
```

**Response:**
```json
{
  "preview": "<div style=\"font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.4;\">Custom signature text</div><div style=\"font-weight: bold; color: #2c3e50; font-size: 16px;\">John Doe</div><div style=\"color: #7f8c8d; font-style: italic;\">Senior Developer</div><div style=\"color: #34495e;\">Tech Corp</div><div style=\"color: #34495e;\">📞 +1 (555) 123-4567 | ✉️ john.doe@techcorp.com</div><div style=\"margin-top: 10px; padding-top: 10px; border-top: 1px solid #bdc3c7; font-size: 12px; color: #95a5a6;\">Sent via <a href=\"https://xscard.com\" style=\"color: #3498db; text-decoration: none;\">XS Card</a></div>",
  "message": "Signature preview generated successfully"
}
```

### Test Email Signature

#### Send Test Email
```
POST /Users/:id/test-signature
```

**Request Body:**
```json
{
  "testEmail": "test@example.com"
}
```

**Response:**
```json
{
  "message": "Test email sent successfully",
  "emailResult": {
    "success": true,
    "accepted": ["test@example.com"],
    "rejected": [],
    "messageId": "message-id-123"
  }
}
```

### Enterprise Bulk Operations

#### Bulk Update Signatures
```
PATCH /enterprise/:enterpriseId/bulk-signatures
```

**Request Body:**
```json
{
  "signatureTemplate": "Best regards,",
  "includeName": true,
  "includeTitle": true,
  "includeCompany": true,
  "includePhone": true,
  "includeEmail": true,
  "includeWebsite": false,
  "includeSocials": false,
  "signatureStyle": "professional",
  "isActive": true
}
```

**Response:**
```json
{
  "message": "Bulk signature update completed successfully",
  "usersUpdated": 25,
  "updatedUsers": ["user1", "user2", "user3"]
}
```

## Signature Styles

### Professional Style
- Font: Arial, sans-serif
- Colors: Professional grays and blues
- Layout: Clean and structured
- Best for: Corporate environments

### Modern Style
- Font: Segoe UI, Tahoma, Geneva, Verdana, sans-serif
- Colors: Contemporary color palette
- Layout: Bold typography with modern spacing
- Best for: Tech companies and startups

### Minimal Style
- Font: Helvetica Neue, Arial, sans-serif
- Colors: Simple grays
- Layout: Clean and minimal
- Best for: Creative industries and freelancers

## Signature Components

### Available Fields
- **Name**: User's full name
- **Title**: Job title/occupation
- **Company**: Company name
- **Phone**: Contact phone number
- **Email**: Contact email address
- **Website**: Personal or company website
- **Social Media**: LinkedIn, Twitter, Facebook, Instagram links

### Custom Text
Users can add custom text that appears before the signature content.

### XS Card Branding
All signatures include "Sent via XS Card" branding at the bottom.

## Integration with Email System

### Automatic Application
Email signatures are automatically applied to all outgoing emails when:
1. User has an active signature (`isActive: true`)
2. Email is sent through the system's email service
3. User ID is provided to the email service

### Email Service Integration
The `sendMailWithStatus` function now accepts an optional `userId` parameter:

```javascript
// Without signature
await sendMailWithStatus(mailOptions);

// With signature
await sendMailWithStatus(mailOptions, userId);
```

## Database Schema

### User Document Structure
```javascript
{
  // ... existing user fields
  emailSignature: {
    signatureText: "Custom signature text",
    signatureHtml: "<div>Generated HTML signature</div>",
    includeName: true,
    includeTitle: true,
    includeCompany: true,
    includePhone: true,
    includeEmail: true,
    includeWebsite: false,
    includeSocials: false,
    signatureStyle: "professional",
    isActive: true,
    updatedAt: Timestamp
  }
}
```

## Usage Examples

### Creating a Basic Signature
```javascript
// Create a professional signature
const signatureData = {
  signatureText: "Best regards,",
  includeName: true,
  includeTitle: true,
  includeCompany: true,
  includePhone: true,
  includeEmail: true,
  signatureStyle: "professional",
  isActive: true
};

// Update user signature
await fetch(`/Users/${userId}/email-signature`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(signatureData)
});
```

### Previewing a Signature
```javascript
// Preview signature before saving
const previewData = {
  signatureText: "Best regards,",
  includeName: true,
  includeTitle: true,
  includeCompany: true,
  includePhone: true,
  includeEmail: true,
  signatureStyle: "modern"
};

const response = await fetch(`/Users/${userId}/signature-preview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(previewData)
});

const { preview } = await response.json();
console.log('Signature preview:', preview);
```

### Testing a Signature
```javascript
// Send test email with signature
const testData = {
  testEmail: "test@example.com"
};

await fetch(`/Users/${userId}/test-signature`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});
```

## Frontend Integration

### Signature Management UI
The frontend should provide:
1. **Signature Editor**: Form to configure signature settings
2. **Live Preview**: Real-time preview of signature
3. **Template Selection**: Choose from pre-built templates
4. **Test Functionality**: Button to send test email
5. **Style Customization**: Options to customize appearance

### Example React Component
```jsx
import React, { useState, useEffect } from 'react';

const EmailSignatureEditor = ({ userId }) => {
  const [signature, setSignature] = useState({
    signatureText: '',
    includeName: true,
    includeTitle: true,
    includeCompany: true,
    includePhone: true,
    includeEmail: true,
    includeWebsite: false,
    includeSocials: false,
    signatureStyle: 'professional',
    isActive: true
  });
  
  const [preview, setPreview] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const previewSignature = async () => {
    const response = await fetch(`/Users/${userId}/signature-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signature)
    });
    const { preview } = await response.json();
    setPreview(preview);
  };

  const saveSignature = async () => {
    await fetch(`/Users/${userId}/email-signature`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signature)
    });
  };

  const sendTestEmail = async () => {
    await fetch(`/Users/${userId}/test-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testEmail })
    });
  };

  return (
    <div>
      {/* Signature configuration form */}
      <div>
        <textarea
          value={signature.signatureText}
          onChange={(e) => setSignature({...signature, signatureText: e.target.value})}
          placeholder="Enter custom signature text..."
        />
        
        <div>
          <label>
            <input
              type="checkbox"
              checked={signature.includeName}
              onChange={(e) => setSignature({...signature, includeName: e.target.checked})}
            />
            Include Name
          </label>
          {/* Add other checkboxes for other fields */}
        </div>
        
        <select
          value={signature.signatureStyle}
          onChange={(e) => setSignature({...signature, signatureStyle: e.target.value})}
        >
          <option value="professional">Professional</option>
          <option value="modern">Modern</option>
          <option value="minimal">Minimal</option>
        </select>
      </div>
      
      {/* Preview section */}
      <div>
        <h3>Preview</h3>
        <button onClick={previewSignature}>Update Preview</button>
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
      
      {/* Test email section */}
      <div>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Enter test email address"
        />
        <button onClick={sendTestEmail}>Send Test Email</button>
      </div>
      
      {/* Save button */}
      <button onClick={saveSignature}>Save Signature</button>
    </div>
  );
};
```

## Security Considerations

1. **Input Validation**: All signature inputs are validated
2. **HTML Sanitization**: Custom HTML signatures should be sanitized
3. **Rate Limiting**: Test email functionality should be rate-limited
4. **Authentication**: All signature operations require user authentication
5. **Enterprise Permissions**: Bulk operations require enterprise admin permissions

## Error Handling

### Common Error Responses
```json
{
  "message": "User not found",
  "error": "User with specified ID does not exist"
}
```

```json
{
  "message": "Invalid test email address",
  "error": "Email format is invalid"
}
```

```json
{
  "message": "No active email signature found",
  "error": "User does not have an active signature"
}
```

## Performance Considerations

1. **Caching**: Signature templates are cached
2. **Lazy Loading**: Signature generation is done on-demand
3. **Bulk Operations**: Enterprise bulk updates use batch operations
4. **Email Queue**: Test emails are processed asynchronously

## Monitoring and Analytics

The system logs signature-related activities:
- Signature creation/updates
- Test email sends
- Bulk signature operations
- Template usage statistics

## Future Enhancements

1. **Advanced Templates**: More signature templates and customization options
2. **Image Support**: Allow company logos and profile pictures
3. **Conditional Logic**: Different signatures for different email types
4. **Analytics Dashboard**: Track signature usage and effectiveness
5. **Mobile Optimization**: Better signature display on mobile devices
6. **Integration APIs**: Connect with popular email clients
7. **A/B Testing**: Test different signature styles for effectiveness

## Support and Troubleshooting

### Common Issues

1. **Signature not appearing**: Check if signature is active and user ID is provided
2. **HTML not rendering**: Verify email client supports HTML signatures
3. **Test email not received**: Check spam folder and email configuration
4. **Bulk update failed**: Verify enterprise permissions and user count

### Debug Information
Enable debug logging to troubleshoot signature issues:
```javascript
console.log('Signature data:', signature);
console.log('Email options:', mailOptions);
console.log('User ID:', userId);
```

## Conclusion

The Email Signature feature provides a comprehensive solution for creating and managing professional email signatures. It integrates seamlessly with the existing email system and provides both individual and enterprise-level management capabilities. The feature is designed to be user-friendly while maintaining security and performance standards.

