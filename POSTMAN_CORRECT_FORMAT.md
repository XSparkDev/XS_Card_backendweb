# Postman Request - Correct Format

## 🐛 **Your Current Request (INCORRECT):**

**URL:**
```
PUT http://localhost:8383/api/enterprises/x-spark-test/users/0YLb1VQ30bfSkvr82zQcEo2LOwj1/permissions
```

**Body:**
```json
{
  "removed": "['createCards']",
  "added": "['exportCards']"
}
```

## ✅ **Correct Request Format:**

**URL:**
```
PUT http://localhost:8383/api/enterprise/x-spark-test/users/0YLb1VQ30bfSkvr82zQcEo2LOwj1/permissions
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (Raw JSON):**
```json
{
  "individualPermissions": {
    "removed": ["createCards"],
    "added": ["exportCards"]
  }
}
```

## 🔧 **Key Changes:**

1. **URL Path**: Use `/api/enterprise` (singular) not `/api/enterprises` (plural)
2. **Body Structure**: Add `individualPermissions` wrapper
3. **Data Types**: Use arrays `["createCards"]` not strings `"['createCards']"`

## 📋 **Postman Setup Steps:**

1. **Method**: PUT
2. **URL**: `http://localhost:8383/api/enterprise/x-spark-test/users/0YLb1VQ30bfSkvr82zQcEo2LOwj1/permissions`
3. **Headers**:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_TOKEN`
4. **Body**: Raw JSON with the correct structure above

## 🎯 **Expected Response:**

```json
{
  "success": true,
  "data": {
    "userId": "user-001",
    "updatedPermissions": {
      "removed": ["createCards"],
      "added": ["exportCards"]
    },
    "timestamp": "2025-08-15T22:54:24.693Z",
    "updatedBy": "admin-user"
  }
}
```

## 🚀 **Try This Now:**

Copy and paste the correct format into Postman and it should work!
