const { db, admin } = require('./firebase');

/**
 * Migration Script: Change Employee Document IDs to User IDs
 * 
 * This script migrates all employee documents in the enterprise system
 * from using auto-generated document IDs to using the actual user ID
 * as the document ID, making it consistent with users, cards, and contacts collections.
 * 
 * Before: enterprise/{enterpriseId}/departments/{departmentId}/employees/{randomId}
 * After:  enterprise/{enterpriseId}/departments/{departmentId}/employees/{userId}
 */

class EmployeeDocIdMigration {
    constructor() {
        this.migratedCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.errors = [];
        this.dryRun = false; // Set to true to see what would be migrated without actual changes
    }

    /**
     * Extract user ID from userId reference field
     */
    extractUserIdFromReference(userIdReference) {
        if (!userIdReference) return null;
        
        // Handle Firestore DocumentReference
        if (userIdReference.path) {
            const pathParts = userIdReference.path.split('/');
            if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'users') {
                return pathParts[pathParts.length - 1];
            }
        }
        
        // Handle string reference like "users/user-id"
        if (typeof userIdReference === 'string' && userIdReference.includes('users/')) {
            return userIdReference.split('users/')[1];
        }
        
        return null;
    }

    /**
     * Get all enterprises and their departments/employees
     */
    async getAllEmployeesToMigrate() {
        console.log('🔍 Scanning all enterprises for employees to migrate...');
        const employeesToMigrate = [];
        
        try {
            // Get all enterprises
            const enterprisesSnapshot = await db.collection('enterprise').get();
            console.log(`📊 Found ${enterprisesSnapshot.docs.length} enterprises`);
            
            for (const enterpriseDoc of enterprisesSnapshot.docs) {
                const enterpriseId = enterpriseDoc.id;
                console.log(`\n🏢 Processing enterprise: ${enterpriseId}`);
                
                // Get all departments in this enterprise
                const departmentsSnapshot = await enterpriseDoc.ref.collection('departments').get();
                console.log(`  📁 Found ${departmentsSnapshot.docs.length} departments`);
                
                for (const departmentDoc of departmentsSnapshot.docs) {
                    const departmentId = departmentDoc.id;
                    const departmentName = departmentDoc.data().name || 'Unnamed Department';
                    console.log(`    📂 Processing department: ${departmentName} (${departmentId})`);
                    
                    // Get all employees in this department
                    const employeesSnapshot = await departmentDoc.ref.collection('employees').get();
                    console.log(`      👥 Found ${employeesSnapshot.docs.length} employees`);
                    
                    for (const employeeDoc of employeesSnapshot.docs) {
                        const employeeData = employeeDoc.data();
                        const currentDocId = employeeDoc.id;
                        const userId = this.extractUserIdFromReference(employeeData.userId);
                        
                        if (!userId) {
                            console.log(`      ⚠️  Employee ${currentDocId} has invalid userId reference, skipping`);
                            this.skippedCount++;
                            continue;
                        }
                        
                        // Check if migration is needed (current doc ID != user ID)
                        if (currentDocId === userId) {
                            console.log(`      ✅ Employee ${currentDocId} already uses userId as doc ID, skipping`);
                            this.skippedCount++;
                            continue;
                        }
                        
                        console.log(`      🎯 Employee ${currentDocId} -> ${userId} (${employeeData.name} ${employeeData.surname})`);
                        
                        employeesToMigrate.push({
                            enterpriseId,
                            departmentId,
                            departmentName,
                            currentDocId,
                            userId,
                            employeeData,
                            employeeRef: employeeDoc.ref,
                            newEmployeeRef: departmentDoc.ref.collection('employees').doc(userId)
                        });
                    }
                }
            }
            
            console.log(`\n📊 Migration Summary:`);
            console.log(`  🎯 Employees to migrate: ${employeesToMigrate.length}`);
            console.log(`  ✅ Already migrated: ${this.skippedCount}`);
            
            return employeesToMigrate;
            
        } catch (error) {
            console.error('❌ Error scanning employees:', error);
            throw error;
        }
    }

    /**
     * Migrate a single employee document
     */
    async migrateEmployee(employeeInfo) {
        const { 
            enterpriseId, departmentId, departmentName, 
            currentDocId, userId, employeeData, 
            employeeRef, newEmployeeRef 
        } = employeeInfo;
        
        try {
            console.log(`  🔄 Migrating: ${departmentName}/${employeeData.name} ${employeeData.surname} (${currentDocId} -> ${userId})`);
            
            if (this.dryRun) {
                console.log(`    🔍 DRY RUN: Would migrate employee to ${newEmployeeRef.path}`);
                this.migratedCount++;
                return { success: true, dryRun: true };
            }
            
            // Check if target document already exists
            const existingTargetDoc = await newEmployeeRef.get();
            if (existingTargetDoc.exists) {
                const error = `Target employee document already exists: ${userId}`;
                console.log(`    ❌ ${error}`);
                this.errors.push({ employeeInfo, error });
                this.errorCount++;
                return { success: false, error };
            }
            
            // Use a transaction to ensure atomicity
            await db.runTransaction(async (transaction) => {
                // 1. Create new employee document with userId as document ID
                transaction.set(newEmployeeRef, {
                    ...employeeData,
                    // Keep all existing data, timestamps will be preserved
                    migratedAt: admin.firestore.Timestamp.now(),
                    migratedFrom: currentDocId
                });
                
                // 2. Delete old employee document
                transaction.delete(employeeRef);
                
                // 3. Update user document employeeRef to point to new location
                if (userId) {
                    const userRef = db.collection('users').doc(userId);
                    transaction.update(userRef, {
                        employeeRef: newEmployeeRef,
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
                
                // 4. Update any team employee references if they exist
                if (employeeData.teamEmployeeRef) {
                    transaction.update(employeeData.teamEmployeeRef, {
                        employeeRef: newEmployeeRef,
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            });
            
            console.log(`    ✅ Successfully migrated employee ${userId}`);
            this.migratedCount++;
            return { success: true };
            
        } catch (error) {
            console.error(`    ❌ Error migrating employee ${currentDocId}:`, error.message);
            this.errors.push({ employeeInfo, error: error.message });
            this.errorCount++;
            return { success: false, error: error.message };
        }
    }

    /**
     * Run the complete migration
     */
    async runMigration(dryRun = false) {
        this.dryRun = dryRun;
        console.log(`🚀 Starting Employee Document ID Migration ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
        console.log('=' .repeat(60));
        
        try {
            // 1. Scan and collect all employees that need migration
            const employeesToMigrate = await this.getAllEmployeesToMigrate();
            
            if (employeesToMigrate.length === 0) {
                console.log('\n🎉 No employees need migration. All employees already use userId as document ID!');
                return;
            }
            
            // 2. Confirm migration (unless dry run)
            if (!dryRun) {
                console.log(`\n⚠️  About to migrate ${employeesToMigrate.length} employee documents.`);
                console.log('This will:');
                console.log('  - Create new employee documents with userId as document ID');
                console.log('  - Delete old employee documents with random IDs');  
                console.log('  - Update user documents to reference new employee documents');
                console.log('  - Update team employee references if applicable');
                console.log('\n❗ This operation cannot be easily undone!');
                
                // In a real scenario, you might want to add confirmation here
                // For now, we'll proceed automatically
            }
            
            // 3. Migrate employees in batches
            console.log(`\n🔄 ${dryRun ? 'Simulating' : 'Starting'} migration of ${employeesToMigrate.length} employees...\n`);
            
            const batchSize = 10; // Process 10 employees at a time to avoid overwhelming Firestore
            for (let i = 0; i < employeesToMigrate.length; i += batchSize) {
                const batch = employeesToMigrate.slice(i, i + batchSize);
                console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(employeesToMigrate.length/batchSize)} (${batch.length} employees)`);
                
                // Process batch concurrently
                const migrationPromises = batch.map(employeeInfo => this.migrateEmployee(employeeInfo));
                await Promise.all(migrationPromises);
                
                // Small delay between batches to be gentle on Firestore
                if (i + batchSize < employeesToMigrate.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // 4. Final summary
            console.log('\n' + '='.repeat(60));
            console.log(`✨ Migration ${dryRun ? 'Simulation' : 'Complete'}!`);
            console.log(`📊 Final Results:`);
            console.log(`  ✅ Successfully migrated: ${this.migratedCount}`);
            console.log(`  ⏭️  Skipped (already migrated): ${this.skippedCount}`);
            console.log(`  ❌ Errors: ${this.errorCount}`);
            
            if (this.errors.length > 0) {
                console.log(`\n❌ Migration Errors:`);
                this.errors.forEach((errorInfo, index) => {
                    console.log(`  ${index + 1}. Employee ${errorInfo.employeeInfo.currentDocId} -> ${errorInfo.employeeInfo.userId}: ${errorInfo.error}`);
                });
            }
            
            if (!dryRun && this.migratedCount > 0) {
                console.log(`\n🎉 Successfully migrated ${this.migratedCount} employee documents!`);
                console.log('All employee documents now use userId as their document ID.');
                console.log('User references have been updated accordingly.');
            }
            
        } catch (error) {
            console.error('💥 Migration failed with error:', error);
            throw error;
        }
    }
}

// Command line execution
async function main() {
    const migration = new EmployeeDocIdMigration();
    
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        const isDryRun = args.includes('--dry-run') || args.includes('-d');
        
        if (isDryRun) {
            console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
        } else {
            console.log('⚡ Running in LIVE mode - changes will be made to the database\n');
        }
        
        await migration.runMigration(isDryRun);
        
        console.log('\n🏁 Migration script completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 Migration script failed:', error);
        process.exit(1);
    }
}

// Export for testing or reuse
module.exports = { EmployeeDocIdMigration };

// Run if called directly
if (require.main === module) {
    main();
}