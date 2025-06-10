# XS Card Location Analytics

This package adds location-based analytics to your XS Card application by capturing approximate geographic location data from IP addresses when contacts are created.

## Features

- **Zero User Impact**: Captures IP addresses in the background without changing the user experience
- **Privacy-Friendly**: Uses only approximate location data from IPs (city-level), not precise GPS coordinates
- **Performance-Optimized**: Processes location lookups asynchronously to avoid slowing down the main request flow
- **Resilient**: Includes retry logic for handling temporary failures and rate limiting
- **Analytics-Ready**: Provides aggregated location data ready for heatmap visualization

## Prerequisites

- Node.js (v12+)
- Express.js backend
- Redis (for Bull job queue)
- MongoDB or other database (for storing contact data)

## Installation

1. Install required dependencies:

```bash
npm install bull node-fetch express
```

2. Copy these files to your backend project.

3. Update your database integration in `locationQueue.js` - replace the `updateContactWithLocation` function with your actual database update logic.

## Integration

### Automatic Integration

In your main Express app file:

```javascript
const express = require('express');
const app = express();
const { applyLocationTracking } = require('./pule/integration');

// Your existing Express setup code
// ...

// Apply the location tracking middleware
applyLocationTracking(app);

// Start your server
// ...
```

### Manual Integration

If automatic integration doesn't work, you can manually integrate:

```javascript
const express = require('express');
const app = express();
const { enrichContactWithIp, processContactLocation } = require('./pule/contactMiddleware');

// Add the middleware to your AddContact endpoint
app.post('/AddContact', enrichContactWithIp, async (req, res) => {
  // Your existing handler code
  const result = await saveContact(req.body);
  
  // Add this to capture the contact ID
  req.contactId = result.id;
  
  // Process location after response
  processContactLocation(req, res);
  
  // Return the response
  res.json(result);
});

// Register the analytics endpoints
app.use('/api', require('./pule/locationEndpoint'));
```

## Frontend Integration

The frontend analytics dashboard will call:

`/api/analytics/connections/locations?startDate=2023-01-01&endDate=2023-12-31`

This endpoint will return location data in the format needed by the heatmap component.

## Configuration

For production use, update the Redis connection details in `locationQueue.js`:

```javascript
const locationQueue = new Queue('location-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
});
```

## Troubleshooting

- **IP Not Detected**: Check if your server is behind a proxy and ensure `X-Forwarded-For` headers are being passed correctly.
- **Location Data Missing**: Some IPs (especially internal/private IPs) cannot be geolocated. The system will skip these.
- **Queue Not Processing**: Ensure Redis is running and accessible.

## License

MIT 