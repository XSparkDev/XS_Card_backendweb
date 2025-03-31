const AUTH_ENDPOINTS = {
    signIn: `${process.env.FIREBASE_AUTH_SIGNIN_URL}?key=${process.env.FIREBASE_WEB_API_KEY}`,
    signUp: `${process.env.FIREBASE_AUTH_SIGNUP_URL}?key=${process.env.FIREBASE_WEB_API_KEY}`
};

const EMAIL_TEMPLATES = {
    verification: {
        subject: 'Verify your XS Card email address',
        getHtml: (name, verificationLink) => `
            <h1>XS Card Email Verification</h1>
            <p>Hello ${name},</p>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
        `
    }
};

const AUTH_CONSTANTS = {
    VERIFICATION_EMAIL_COOLDOWN: 2 * 60 * 1000,
};

module.exports = {
    AUTH_ENDPOINTS,
    EMAIL_TEMPLATES,
    AUTH_CONSTANTS
};
