// Development and production URLs
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const config = {
    development: {
        PASSCREATOR_PUBLIC_URL: process.env.DEV_PASSCREATOR_PUBLIC_URL,
        // Add any other development-specific configs here
    },
    production: {
        PASSCREATOR_PUBLIC_URL: process.env.PROD_PASSCREATOR_PUBLIC_URL || process.env.APP_URL,
        // Add any other production-specific configs here
    }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
