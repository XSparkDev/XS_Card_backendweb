# Render Production Configuration Guide

## 🔧 Environment Variables for Production

### Required Environment Variables in Render Dashboard:

1. **NODE_ENV**
   ```
   NODE_ENV=production
   ```

2. **ALLOWED_ORIGINS** (CORS)
   ```
   ALLOWED_ORIGINS=https://xscard-app.onrender.com,https://your-frontend-domain.com
   ```

3. **APP_URL**
   ```
   APP_URL=https://xscard-app.onrender.com
   ```

### How to Set in Render Dashboard:

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Add each variable above
4. Click **Save Changes**
5. Redeploy your service

## 🔒 Security Considerations

### Production CORS Behavior:
- ✅ Only allows requests from domains in `ALLOWED_ORIGINS`
- ✅ Blocks all other origins
- ✅ Logs blocked origins for debugging

### Current CORS Logic:
```javascript
// In development: allows all origins (*)
// In production: only allows specified origins
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

if (isDevelopment) {
  return callback(null, true); // Allow all
} else {
  // Check against ALLOWED_ORIGINS
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
}
```

## 🚀 Deployment Checklist

- [ ] Set `NODE_ENV=production` in Render
- [ ] Set `ALLOWED_ORIGINS` with your frontend domains
- [ ] Set `APP_URL` to your production URL
- [ ] Verify all other environment variables are set
- [ ] Test CORS with your frontend
- [ ] Monitor logs for any CORS issues

## 🔍 Testing Production CORS

After deployment, test with:
```bash
curl -H "Origin: https://your-frontend-domain.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://xscard-app.onrender.com/api/health -v
```

Expected response:
```
Access-Control-Allow-Origin: https://your-frontend-domain.com
```
