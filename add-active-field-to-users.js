const { db, admin } = require('./firebase');

/**
 * Script to add 'active' field to users based on enterprise employee status
 * 
 * This script:
 * 1. Checks if user's isEmployee is true and they are an enterprise plan user
 * 2. If true, adds active: true field
 * 3. If false, adds active: false field  
 * 4. If no isEmployee field exists, skips the user (not an enterprise user)
 */

class AddActiveFieldToUsers {
    constructor() {
        this.stats = {
            processed: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            enterpriseEmployees: 0,
            nonEnterpriseEmployees: 0,
            nonEnterpriseUsers: 0
        };
        this.errors = [];
        this.dryRun = false;
    }

    /**
     * Determine if a user is an enterprise employee
     */
    isEnterpriseEmployee(userData) {
        // Check if user has isEmployee field
        if (!userData.hasOwnProperty('isEmployee')) {
            return null; // Not an enterprise user
        }
        
        // Check if user is an employee
        if (!userData.isEmployee) {
            return false; // Enterprise user but not an employee
        }
        
        // Check if user has enterprise plan
        const hasEnterprisePlan = userData.plan === 'enterprise' || 
                                userData.enterpriseRef || 
                                userData.employeeRef;
        
        return hasEnterprisePlan;
    }

    /**
     * Process a single user
     */
    async processUser(userDoc) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        try {
            console.log(`\n👤 Processing user: ${userId} (${userData.email || 'no email'})`);
            
            // Check if user already has active field
            if (userData.hasOwnProperty('active')) {
                console.log(`  ⏭️  User already has 'active' field (${userData.active}), skipping`);
                this.stats.skipped++;
                return { success: true, skipped: true, reason: 'already_has_active_field' };
            }
            
            // Determine enterprise employee status
            const isEnterpriseEmployee = this.isEnterpriseEmployee(userData);
            
            if (isEnterpriseEmployee === null) {
                console.log(`  ⏭️  User is not an enterprise user (no isEmployee field), skipping`);
                this.stats.nonEnterpriseUsers++;
                this.stats.skipped++;
                return { success: true, skipped: true, reason: 'not_enterprise_user' };
            }
            
            // Determine active status
            const shouldBeActive = isEnterpriseEmployee;
            const activeStatus = shouldBeActive ? true : false;
            
            console.log(`  📊 User analysis:`);
            console.log(`    - isEmployee: ${userData.isEmployee}`);
            console.log(`    - plan: ${userData.plan || 'not set'}`);
            console.log(`    - enterpriseRef: ${userData.enterpriseRef ? 'exists' : 'none'}`);
            console.log(`    - employeeRef: ${userData.employeeRef ? 'exists' : 'none'}`);
            console.log(`    - Enterprise employee: ${isEnterpriseEmployee}`);
            console.log(`    - Will set active: ${activeStatus}`);
            
            if (isEnterpriseEmployee) {
                this.stats.enterpriseEmployees++;
            } else {
                this.stats.nonEnterpriseEmployees++;
            }
            
            if (this.dryRun) {
                console.log(`  🔍 DRY RUN: Would set active: ${activeStatus}`);
                this.stats.updated++;
                return { success: true, dryRun: true, activeStatus };
            }
            
            // Update user document
            await userDoc.ref.update({
                active: activeStatus,
                updatedAt: admin.firestore.Timestamp.now()
            });
            
            console.log(`  ✅ Updated user with active: ${activeStatus}`);
            this.stats.updated++;
            
            return { success: true, activeStatus };
            
        } catch (error) {
            const errorMsg = `Error processing user ${userId}: ${error.message}`;
            console.error(`  ❌ ${errorMsg}`);
            this.errors.push({ userId, error: error.message });
            this.stats.errors++;
            return { success: false, error: error.message };
        }
    }

    /**
     * Process all users in batches
     */
    async processAllUsers() {
        console.log('🚀 Starting user active field addition process');
        console.log('=' .repeat(60));
        
        try {
            // Get all users
            console.log('📋 Fetching all users...');
            const usersSnapshot = await db.collection('users').get();
            
            if (usersSnapshot.empty) {
                console.log('❌ No users found in database');
                return;
            }
            
            console.log(`📊 Found ${usersSnapshot.docs.length} users to process`);
            
            // Process users in batches
            const batchSize = 50; // Process 50 users at a time
            const allUsers = usersSnapshot.docs;
            
            for (let i = 0; i < allUsers.length; i += batchSize) {
                const batch = allUsers.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(allUsers.length / batchSize);
                
                console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);
                
                // Process batch concurrently
                const promises = batch.map(userDoc => this.processUser(userDoc));
                const results = await Promise.all(promises);
                
                // Small delay between batches to be gentle on Firestore
                if (i + batchSize < allUsers.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Print final summary
            this.printSummary();
            
        } catch (error) {
            console.error('💥 Error processing users:', error);
            throw error;
        }
    }

    /**
     * Print detailed summary of the operation
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL SUMMARY');
        console.log('=' .repeat(60));
        
        console.log(`📈 Processing Results:`);
        console.log(`  ✅ Successfully updated: ${this.stats.updated}`);
        console.log(`  ⏭️  Skipped (already had active field): ${this.stats.skipped}`);
        console.log(`  ❌ Errors: ${this.stats.errors}`);
        console.log(`  📋 Total processed: ${this.stats.processed}`);
        
        console.log(`\n👥 User Categories:`);
        console.log(`  🏢 Enterprise employees (active: true): ${this.stats.enterpriseEmployees}`);
        console.log(`  👤 Non-enterprise employees (active: false): ${this.stats.nonEnterpriseEmployees}`);
        console.log(`  🚫 Non-enterprise users (skipped): ${this.stats.nonEnterpriseUsers}`);
        
        if (this.errors.length > 0) {
            console.log(`\n❌ Errors encountered:`);
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. User ${error.userId}: ${error.error}`);
            });
        }
        
        if (this.dryRun) {
            console.log(`\n🔍 This was a DRY RUN - no changes were made to the database`);
        } else {
            console.log(`\n🎉 Successfully added 'active' field to ${this.stats.updated} users!`);
        }
    }

    /**
     * Run the complete process
     */
    async run(dryRun = false) {
        this.dryRun = dryRun;
        
        if (dryRun) {
            console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
        } else {
            console.log('⚡ Running in LIVE mode - changes will be made to the database\n');
        }
        
        try {
            await this.processAllUsers();
            console.log('\n🏁 Script completed successfully!');
            
        } catch (error) {
            console.error('\n💥 Script failed:', error);
            throw error;
        }
    }
}

// Command line execution
async function main() {
    const processor = new AddActiveFieldToUsers();
    
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        const isDryRun = args.includes('--dry-run') || args.includes('-d');
        
        await processor.run(isDryRun);
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    }
}

// Export for testing or reuse
module.exports = { AddActiveFieldToUsers };

// Run if called directly
if (require.main === module) {
    main();
} 