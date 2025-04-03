const express = require('express');
const path = require('path');
const app = express();

// Import routes
const exportRoutes = require('./routes/exportRoutes');
// Other route imports...

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Update static file serving
app.use('/profiles', express.static(path.join(__dirname, 'public/profiles')));

// Register export routes
app.use('/', exportRoutes);
// Other route registrations...

module.exports = app;