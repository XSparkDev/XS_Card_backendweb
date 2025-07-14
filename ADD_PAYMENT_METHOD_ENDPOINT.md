# Add Payment Method Endpoint

## Overview
The Add Payment Method endpoint allows users to manually add new payment methods to their account. It follows the same verification pattern as subscription setup - charging R1.00 for verification, then issuing an immediate refund.

## API Endpoint

### Add Payment Method
**Endpoint:** `POST /billing/payment-methods`  
**Auth Required:** Yes  
**Description:** Initialize the addition of a new payment method

---

## Request Structure

### Headers
```
Authorization: Bearer <firebase-jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "email": "user@example.com",
  "amount": 100
}
```

### Request Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `email` | string | No | User's registered email | Email address for the payment (falls back to user's account email) |
| `amount` | number | No | 100 | Verification amount in kobo (100 = R1.00) |

---

## Response Structure

### Success Response (200)
```json
{
  "status": true,
  "message": "Transaction initialized",
  "data": {
    "authorization_url": "https://checkout.paystack.com/abc123xyz",
    "access_code": "access_code_here",
    "reference": "ref_1234567890"
  }
}
```

### Error Responses

#### User Not Found (404)
```json
{
  "status": false,
  "message": "User not found"
}
```

#### Missing Email (400)
```json
{
  "status": false,
  "message": "Email is required"
}
```

#### Server Error (500)
```json
{
  "status": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## Callback Handling

### Callback Endpoints
- **GET:** `/billing/payment-method/callback?reference=ref_123`
- **POST:** `/billing/payment-method/callback` with body containing `data.reference`

### Callback Process
1. **Verify Transaction**: Validates payment with Paystack
2. **Issue Refund**: Automatically refunds the R1.00 verification amount
3. **Store Payment Method**: Saves card details to database
4. **Activity Logging**: Records the payment method addition
5. **Redirect/Response**: Returns success or failure status

---

## Usage Flow

### Step 1: Initialize Payment Method Addition
```bash
curl -X POST http://localhost:3000/billing/payment-methods \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Step 2: User Completes Payment
User is redirected to Paystack checkout page to enter card details and complete the R1.00 verification payment.

### Step 3: Automatic Processing
- Paystack calls the callback endpoint
- System verifies the payment
- Refund is issued automatically
- Payment method is stored in database
- Activity is logged

### Step 4: Confirmation
User is redirected to success/failure page, and the new payment method appears in their account.

---

## Database Storage

Payment methods are stored with the following structure:

```json
{
  "userId": "user123",
  "customerCode": "CUS_abcd1234",
  "type": "card",
  "brand": "visa",
  "last4": "4242",
  "expiryMonth": 12,
  "expiryYear": 2025,
  "authorizationCode": "AUTH_xyz789",
  "isDefault": false,
  "createdAt": "2025-07-12T00:00:00Z"
}
```

---

## Security Features

- **Authentication Required**: All requests must include valid JWT token
- **Ownership Verification**: Users can only add payment methods to their own account
- **Activity Logging**: All payment method operations are logged for audit
- **Automatic Refund**: Verification charges are automatically refunded
- **Default Management**: First payment method is set as default, subsequent ones are not

---

## Integration Notes

### Environment Variables Required
- `PAYSTACK_SECRET_KEY`: Your Paystack secret key
- `APP_URL`: Base URL for callback endpoints

### Dependencies
- Paystack API integration
- Firebase Firestore for storage
- Activity logging system

### Related Endpoints
- `GET /billing/payment-methods` - List payment methods
- `PUT /billing/payment-methods/:id` - Update payment method
- `DELETE /billing/payment-methods/:id` - Delete payment method

---

## Example Usage

```javascript
// Frontend implementation example
const addPaymentMethod = async () => {
  try {
    const response = await fetch('/billing/payment-methods', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email
      })
    });

    const data = await response.json();
    
    if (data.status) {
      // Redirect user to Paystack checkout
      window.location.href = data.data.authorization_url;
    }
  } catch (error) {
    console.error('Error adding payment method:', error);
  }
};
```

This endpoint provides a secure and user-friendly way to add payment methods while maintaining the same verification pattern used throughout the application.
