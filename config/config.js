// Development and production URLs
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const config = {
    development: {
        PASSCREATOR_PUBLIC_URL: process.env.DEV_PASSCREATOR_PUBLIC_URL,
        BASE_URL: process.env.DEV_BASE_URL || 'http://localhost:8383',
        // Add any other development-specific configs here
    },
    production: {
        PASSCREATOR_PUBLIC_URL: process.env.PROD_PASSCREATOR_PUBLIC_URL || process.env.APP_URL,
        BASE_URL: process.env.PROD_BASE_URL || process.env.APP_URL || 'https://your-domain.com',
        // Add any other production-specific configs here
    }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
