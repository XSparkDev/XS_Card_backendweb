/**
 * Subscription plans configuration
 * 
 * This file contains temporary hard-coded subscription plans.
 * In the future, these will be stored in the database.
 */

const SUBSCRIPTION_PLANS = {
    MONTHLY_PLAN: {
        id: 'MONTHLY_PLAN',
        name: 'Monthly Subscription',
        amount: 159.99, // in ZAR
        planCode: 'PLN_25xliarx7epm9ct',
        interval: 'monthly',
        description: 'XS Card Monthly Subscription'
    },
    ANNUAL_PLAN: {
        id: 'ANNUAL_PLAN',
        name: 'Annual Subscription',
        amount: 1800.00, // in ZAR
        planCode: 'PLN_kzb7lj21vrehzeq',
        interval: 'annually',
        description: 'XS Card Annual Subscription'
    }
};

// Constants for trial
const SUBSCRIPTION_CONSTANTS = {
    VERIFICATION_AMOUNT: 100, // R1.00 in cents
    TRIAL_DAYS: 0, // Changed from 7 days to 0 days
    TRIAL_MINUTES: 10080 // 7 days trial (7 * 24 * 60 minutes)
};

// Helper function to get plan by code
const getPlanByCode = (planCode) => {
    return Object.values(SUBSCRIPTION_PLANS).find(plan => plan.planCode === planCode);
};

// Helper function to get plan by ID
const getPlanById = (planId) => {
    return SUBSCRIPTION_PLANS[planId];
};

module.exports = {
    SUBSCRIPTION_PLANS,
    SUBSCRIPTION_CONSTANTS,
    getPlanByCode,
    getPlanById
};
