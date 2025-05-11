# Location Service Testing Guide

This guide provides instructions for testing the location service specifically in the context of **adding contacts**, which is when the location feature is actually used in the application.

## Prerequisites

1. Make sure your server is running
2. Have Postman or a similar API testing tool ready
3. Have a valid test user ID in Firebase (to store contacts)
4. Ensure your Google Maps API key is set up correctly in the environment

## Google Maps API Setup

Before running the tests that involve Google Maps:

1. Make sure you have a valid Google Maps API key
2. Add the key to your `.env` file:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
3. Enable the Geocoding API in your Google Cloud Console
4. Test the Google Maps API directly before running complex tests

## Troubleshooting the "Failed to get coordinates from IP" Error

If you're seeing the error "Failed to get coordinates from IP" when testing Google Maps, use these diagnostic tests:

### 1. Testing the Initial Coordinate Lookup

This tests the first step of the Google Maps function (getting coordinates from IP):

**Postman Request:**
- **Method:** GET
- **URL:** `http://localhost:8383/test/google-coords-test?ip=8.8.8.8`

**Expected Result:**
- If successful, you'll see the initial coordinates and Google geocoding results
- If it fails, you'll see exactly where the error is occurring

### 2. Using Google Maps with Direct Coordinates

Since the IP-to-coordinates lookup is failing, you can bypass it by providing coordinates directly:

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/google-direct`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Google",
  "surname": "Direct",
  "latitude": 37.422,
  "longitude": -122.084
}
```

**Expected Result:**
- Contact is created with location data from Google Maps
- Location data has city, region, and country information
- This confirms your Google Maps API key is working properly

## Test Scenarios

### 0. Testing Google Maps API Directly

This tests if your Google Maps API setup is working correctly:

**Postman Request:**
- **Method:** GET
- **URL:** `http://localhost:8383/test/google-test?ip=8.8.8.8`

**Expected Result:**
- If your Google Maps API key is set up correctly, you'll get a success response with location data
- If there's a problem, you'll get detailed error information
- This will help diagnose any issues before testing the fallback scenarios

### 1. Testing Normal Contact Addition With Location

This tests the standard flow where a contact is added and location data is attached directly.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Test",
  "surname": "User",
  "email": "test@example.com",
  "phone": "123-456-7890",
  "howWeMet": "Location testing",
  "ipAddress": "8.8.8.8"
}
```

**Expected Result:**
- Contact is created with location data from ipapi.co (primary service)
- Check that the response includes location data with city, country, and coordinates
- Verify that the contact is stored in Firebase with location data

### 2. Testing Queue-Based Location Processing (Real App Flow)

This tests the real application flow where contacts are added and location is processed asynchronously.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/queued`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Queue",
  "surname": "Test",
  "email": "queue@example.com",
  "phone": "123-456-7890",
  "howWeMet": "Queue testing",
  "ipAddress": "1.1.1.1"
}
```

**Expected Result:**
- Contact is created without location data initially
- Location processing is queued in the background
- After a few seconds, you can verify location data was added by using the check-contact endpoint

### 3. Testing Primary Service Failure (ipapi.co fails)

This tests the scenario where the primary service fails and the system falls back to the first fallback service.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/fallback-test`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Fallback1",
  "surname": "Test",
  "ipAddress": "8.8.8.8",
  "scenario": "ipapi-fails"
}
```

**Expected Result:**
- Contact is created with location data from ip-api.com (first fallback service)
- Check that location data is still obtained despite the primary service failure
- Verify the fallback path in server logs
- Response should show `providerUsed: "ip-api.com"`

### 4. Testing Both Free Services Failure (Google Fallback)

This tests the scenario where both ipapi.co and ip-api.com fail, so the system falls back to Google Maps.

**Important**: If you're seeing the "Failed to get coordinates from IP" error, use the diagnostic tests and Google Direct test instead.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/fallback-test`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Google",
  "surname": "Fallback",
  "ipAddress": "8.8.8.8",
  "scenario": "ipapi-and-ipapi2-fail"
}
```

**Expected Result:**
- Contact is created with location data from Google Maps
- Both primary and first fallback service failures are logged
- Response should show `providerUsed: "Google Maps"`
- Location data follows same structure as from other providers

If this test fails, check the `errorDetails` field in the response for detailed information about the Google Maps API failure.

### 5. Testing Google Failure (Should Still Use Free Services)

This tests that when Google fails but the free services work, the system operates correctly.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/fallback-test`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "Primary",
  "surname": "Works",
  "ipAddress": "8.8.8.8",
  "scenario": "google-fails"
}
```

**Expected Result:**
- Contact is created with location data from one of the free services
- Google Maps failure doesn't affect the operation because free services work
- Location data is properly obtained and saved

### 6. Testing Complete Service Failure

This tests the scenario when all location services fail.

**Postman Request:**
- **Method:** POST
- **URL:** `http://localhost:8383/test/add-contact/fallback-test`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "userId": "YOUR_TEST_USER_ID",
  "name": "All",
  "surname": "Fail",
  "ipAddress": "invalid.ip.address",
  "scenario": "all-fail"
}
```

**Expected Result:**
- Contact is created but without location data
- Response shows `locationFound: false` and `providerUsed: "none - all failed"`
- Failures are logged to server console

### 7. Checking Contact Location Data

After running any of the tests, you can verify the location data was properly stored:

**Postman Request:**
- **Method:** GET
- **URL:** `http://localhost:8383/test/check-contact?userId=YOUR_TEST_USER_ID&contactIndex=0`

**Expected Result:**
- JSON response with the contact data including location field if available
- `hasLocation` boolean indicating whether location data exists

## Troubleshooting Google Maps API

If scenario 4 fails, follow these steps:

1. Check if Google Maps API key is properly set:
   ```
   http://localhost:8383/test/google-test?ip=8.8.8.8
   ```

2. Verify in the response:
   - `apiKeyConfigured` should be `true`
   - If there's an error, check the error message for details

3. Test the issue with the IP-to-coordinates conversion:
   ```
   http://localhost:8383/test/google-coords-test?ip=8.8.8.8
   ```

4. If the IP-to-coordinates step is failing, use the direct coordinates approach:
   ```
   POST http://localhost:8383/test/add-contact/google-direct
   ```
   With coordinates for Google's headquarters or any known location.

5. Common issues:
   - API key not set in environment variables
   - API key doesn't have Geocoding API enabled
   - API key has restrictions that prevent server usage
   - Geocoding API hasn't been enabled in Google Cloud Console
   - IP-to-coordinates service (ip-api.com) is failing

## Fallback Hierarchy

The location service uses the following fallback order:
1. **ipapi.co** (primary service - free tier)
2. **ip-api.com** (first fallback - free tier, higher rate limits)
3. **Google Maps** (final fallback - paid, highly reliable)

## Integration with Real Contact Addition Flow

The location feature is integrated into the contact addition flow via:

1. The `enrichContactWithIp` middleware which captures the client's IP
2. The `processContactLocation` function which queues location lookups
3. The `queueLocationLookup` function that processes IP-to-location in the background
4. The Bull queue which handles asynchronous processing

To test in the real app:

1. Scan a user's QR code and submit contact details
2. The IP will be automatically captured and processed
3. Check the contact in Firebase after a few seconds to verify location data 