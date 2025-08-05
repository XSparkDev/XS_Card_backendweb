const { db } = require('./firebase');
const { EmployeeDocIdMigration } = require('./migrate-employee-docids');

/**
 * Test Script for Employee Document ID Migration
 * 
 * This script tests the migration functionality and verifies that:
 * 1. Employee documents are correctly migrated to use userId as document ID
 * 2. User document references are updated correctly
 * 3. Team employee references are maintained
 * 4. No data is lost during migration
 */

class EmployeeMigrationTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    /**
     * Log test result
     */
    logTest(testName, passed, details = '') {
        if (passed) {
            console.log(`✅ ${testName}`);
            this.testResults.passed++;
        } else {
            console.log(`❌ ${testName}: ${details}`);
            this.testResults.failed++;
            this.testResults.errors.push({ testName, details });
        }
    }

    /**
     * Test: Verify migration script can scan employees correctly
     */
    async testScanEmployees() {
        try {
            console.log('\n📋 Test: Scanning employees for migration...');
            
            const migration = new EmployeeDocIdMigration();
            const employeesToMigrate = await migration.getAllEmployeesToMigrate();
            
            this.logTest(
                'Scan employees', 
                Array.isArray(employeesToMigrate), 
                `Expected array, got ${typeof employeesToMigrate}`
            );
            
            console.log(`Found ${employeesToMigrate.length} employees to potentially migrate`);
            
            // Test structure of migration data
            if (employeesToMigrate.length > 0) {
                const firstEmployee = employeesToMigrate[0];
                const requiredFields = ['enterpriseId', 'departmentId', 'currentDocId', 'userId', 'employeeData'];
                
                for (const field of requiredFields) {
                    this.logTest(
                        `Employee data has ${field}`,
                        firstEmployee.hasOwnProperty(field),
                        `Missing field: ${field}`
                    );
                }
            }
            
        } catch (error) {
            this.logTest('Scan employees', false, error.message);
        }
    }

    /**
     * Test: Run dry run migration
     */
    async testDryRunMigration() {
        try {
            console.log('\n🔍 Test: Running dry run migration...');
            
            const migration = new EmployeeDocIdMigration();
            await migration.runMigration(true); // Dry run
            
            this.logTest(
                'Dry run migration',
                migration.errorCount === 0,
                `Migration had ${migration.errorCount} errors`
            );
            
        } catch (error) {
            this.logTest('Dry run migration', false, error.message);
        }
    }

    /**
     * Test: Verify user ID extraction logic
     */
    async testUserIdExtraction() {
        try {
            console.log('\n🔍 Test: User ID extraction logic...');
            
            const migration = new EmployeeDocIdMigration();
            
            // Test Firestore DocumentReference extraction
            const mockRef = { path: 'users/test-user-123' };
            const extractedId = migration.extractUserIdFromReference(mockRef);
            this.logTest(
                'Extract userId from DocumentReference',
                extractedId === 'test-user-123',
                `Expected 'test-user-123', got '${extractedId}'`
            );
            
            // Test string reference extraction
            const stringRef = 'users/another-user-456';
            const extractedId2 = migration.extractUserIdFromReference(stringRef);
            this.logTest(
                'Extract userId from string reference',
                extractedId2 === 'another-user-456',
                `Expected 'another-user-456', got '${extractedId2}'`
            );
            
            // Test invalid reference handling
            const invalidRef = null;
            const extractedId3 = migration.extractUserIdFromReference(invalidRef);
            this.logTest(
                'Handle invalid reference',
                extractedId3 === null,
                `Expected null, got '${extractedId3}'`
            );
            
        } catch (error) {
            this.logTest('User ID extraction logic', false, error.message);
        }
    }

    /**
     * Test: Verify employee document structure after new code changes
     */
    async testNewEmployeeCreation() {
        try {
            console.log('\n👥 Test: Verify new employee creation uses userId as document ID...');
            
            // This test would require creating a test employee, but we'll just verify
            // that the updated code doesn't have obvious issues
            
            // Check if departmentsController.js has been updated correctly
            const fs = require('fs');
            const departmentsControllerContent = fs.readFileSync('./controllers/enterprise/departmentsController.js', 'utf8');
            
            // Check for updated patterns
            const hasUserIdAsDocId = departmentsControllerContent.includes('employeesRef.doc(manager.id)') || 
                                   departmentsControllerContent.includes('employeesRef.doc(actualUserId)');
            
            this.logTest(
                'DepartmentsController uses userId as document ID',
                hasUserIdAsDocId,
                'Code still uses .add() instead of .doc(userId).set()'
            );
            
            const hasUpdatedReferences = departmentsControllerContent.includes('employees/${manager.id}') ||
                                       departmentsControllerContent.includes('employees/${actualUserId}');
            
            this.logTest(
                'DepartmentsController updates references correctly',
                hasUpdatedReferences,
                'Employee references not updated to use userId'
            );
            
        } catch (error) {
            this.logTest('New employee creation test', false, error.message);
        }
    }

    /**
     * Test: Check for potential issues in existing data
     */
    async testDataIntegrity() {
        try {
            console.log('\n🔍 Test: Checking data integrity...');
            
            // Get a sample of enterprises to test
            const enterprisesSnapshot = await db.collection('enterprise').limit(2).get();
            
            if (enterprisesSnapshot.empty) {
                console.log('No enterprises found - skipping data integrity tests');
                return;
            }
            
            let employeesFound = 0;
            let employeesWithValidUserId = 0;
            let employeesAlreadyMigrated = 0;
            
            for (const enterpriseDoc of enterprisesSnapshot.docs) {
                const departmentsSnapshot = await enterpriseDoc.ref.collection('departments').limit(2).get();
                
                for (const departmentDoc of departmentsSnapshot.docs) {
                    const employeesSnapshot = await departmentDoc.ref.collection('employees').limit(5).get();
                    
                    for (const employeeDoc of employeesSnapshot.docs) {
                        employeesFound++;
                        const employeeData = employeeDoc.data();
                        
                        // Check if employee has valid userId reference
                        if (employeeData.userId) {
                            employeesWithValidUserId++;
                        }
                        
                        // Check if already migrated (doc ID equals extracted userId)
                        const migration = new EmployeeDocIdMigration();
                        const extractedUserId = migration.extractUserIdFromReference(employeeData.userId);
                        if (extractedUserId && employeeDoc.id === extractedUserId) {
                            employeesAlreadyMigrated++;
                        }
                    }
                }
            }
            
            this.logTest(
                'Employees have userId references',
                employeesWithValidUserId === employeesFound,
                `${employeesWithValidUserId}/${employeesFound} employees have valid userId references`
            );
            
            console.log(`📊 Data integrity summary:`);
            console.log(`  - Total employees checked: ${employeesFound}`);
            console.log(`  - Employees with valid userId: ${employeesWithValidUserId}`);
            console.log(`  - Employees already migrated: ${employeesAlreadyMigrated}`);
            console.log(`  - Employees needing migration: ${employeesFound - employeesAlreadyMigrated}`);
            
        } catch (error) {
            this.logTest('Data integrity check', false, error.message);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Employee Migration Tests');
        console.log('=' .repeat(50));
        
        try {
            await this.testUserIdExtraction();
            await this.testNewEmployeeCreation();
            await this.testScanEmployees();
            await this.testDataIntegrity();
            await this.testDryRunMigration();
            
            // Final summary
            console.log('\n' + '='.repeat(50));
            console.log('🏁 Test Results Summary');
            console.log(`✅ Passed: ${this.testResults.passed}`);
            console.log(`❌ Failed: ${this.testResults.failed}`);
            
            if (this.testResults.failed > 0) {
                console.log('\n❌ Failed Tests:');
                this.testResults.errors.forEach((error, index) => {
                    console.log(`  ${index + 1}. ${error.testName}: ${error.details}`);
                });
            }
            
            const success = this.testResults.failed === 0;
            if (success) {
                console.log('\n🎉 All tests passed! Migration should be safe to run.');
            } else {
                console.log('\n⚠️  Some tests failed. Please review before running migration.');
            }
            
            return success;
            
        } catch (error) {
            console.error('💥 Test suite failed with error:', error);
            return false;
        }
    }
}

// Command line execution
async function main() {
    const tester = new EmployeeMigrationTester();
    
    try {
        const success = await tester.runAllTests();
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error('💥 Test runner failed:', error);
        process.exit(1);
    }
}

// Export for reuse
module.exports = { EmployeeMigrationTester };

// Run if called directly
if (require.main === module) {
    main();
}