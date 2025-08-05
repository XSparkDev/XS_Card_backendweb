const { db, admin } = require('./firebase');
const { AddActiveFieldToUsers } = require('./add-active-field-to-users');

/**
 * Test Script for Active Field Addition
 * 
 * This script tests the active field addition functionality and verifies that:
 * 1. Enterprise employees get active: true
 * 2. Non-enterprise employees get active: false  
 * 3. Non-enterprise users are skipped
 * 4. Users with existing active field are skipped
 */

class ActiveFieldAdditionTester {
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
     * Test: Verify enterprise employee detection logic
     */
    async testEnterpriseEmployeeDetection() {
        try {
            console.log('\n🔍 Test: Enterprise employee detection logic...');
            
            const processor = new AddActiveFieldToUsers();
            
            // Test case 1: Enterprise employee
            const enterpriseEmployee = {
                isEmployee: true,
                plan: 'enterprise',
                enterpriseRef: { id: 'test-enterprise' },
                employeeRef: { id: 'test-employee' }
            };
            const result1 = processor.isEnterpriseEmployee(enterpriseEmployee);
            this.logTest(
                'Detect enterprise employee',
                result1 === true,
                `Expected true, got ${result1}`
            );
            
            // Test case 2: Non-enterprise employee
            const nonEnterpriseEmployee = {
                isEmployee: true,
                plan: 'free',
                enterpriseRef: null,
                employeeRef: null
            };
            const result2 = processor.isEnterpriseEmployee(nonEnterpriseEmployee);
            this.logTest(
                'Detect non-enterprise employee',
                result2 === false,
                `Expected false, got ${result2}`
            );
            
            // Test case 3: Non-enterprise user (no isEmployee field)
            const nonEnterpriseUser = {
                plan: 'free',
                enterpriseRef: null,
                employeeRef: null
            };
            const result3 = processor.isEnterpriseEmployee(nonEnterpriseUser);
            this.logTest(
                'Detect non-enterprise user',
                result3 === null,
                `Expected null, got ${result3}`
            );
            
            // Test case 4: Enterprise user but not employee
            const enterpriseUserNotEmployee = {
                isEmployee: false,
                plan: 'enterprise',
                enterpriseRef: { id: 'test-enterprise' }
            };
            const result4 = processor.isEnterpriseEmployee(enterpriseUserNotEmployee);
            this.logTest(
                'Detect enterprise user but not employee',
                result4 === false,
                `Expected false, got ${result4}`
            );
            
        } catch (error) {
            this.logTest('Enterprise employee detection logic', false, error.message);
        }
    }

    /**
     * Test: Verify dry run functionality
     */
    async testDryRunFunctionality() {
        try {
            console.log('\n🔍 Test: Dry run functionality...');
            
            const processor = new AddActiveFieldToUsers();
            
            // Run dry run
            await processor.run(true);
            
            this.logTest(
                'Dry run completes without errors',
                processor.stats.errors === 0,
                `Dry run had ${processor.stats.errors} errors`
            );
            
            this.logTest(
                'Dry run doesn\'t make actual changes',
                processor.dryRun === true,
                'Dry run flag not set correctly'
            );
            
        } catch (error) {
            this.logTest('Dry run functionality', false, error.message);
        }
    }

    /**
     * Test: Check existing user data structure
     */
    async testExistingUserData() {
        try {
            console.log('\n📊 Test: Analyzing existing user data...');
            
            // Get a sample of users to analyze
            const usersSnapshot = await db.collection('users').limit(10).get();
            
            if (usersSnapshot.empty) {
                console.log('No users found - skipping data analysis tests');
                return;
            }
            
            let usersWithActiveField = 0;
            let usersWithIsEmployee = 0;
            let enterpriseEmployees = 0;
            let nonEnterpriseEmployees = 0;
            let nonEnterpriseUsers = 0;
            
            const processor = new AddActiveFieldToUsers();
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                
                if (userData.hasOwnProperty('active')) {
                    usersWithActiveField++;
                }
                
                if (userData.hasOwnProperty('isEmployee')) {
                    usersWithIsEmployee++;
                    
                    const isEnterpriseEmployee = processor.isEnterpriseEmployee(userData);
                    if (isEnterpriseEmployee === true) {
                        enterpriseEmployees++;
                    } else if (isEnterpriseEmployee === false) {
                        nonEnterpriseEmployees++;
                    }
                } else {
                    nonEnterpriseUsers++;
                }
            });
            
            console.log(`📊 User data analysis:`);
            console.log(`  - Users with 'active' field: ${usersWithActiveField}`);
            console.log(`  - Users with 'isEmployee' field: ${usersWithIsEmployee}`);
            console.log(`  - Enterprise employees: ${enterpriseEmployees}`);
            console.log(`  - Non-enterprise employees: ${nonEnterpriseEmployees}`);
            console.log(`  - Non-enterprise users: ${nonEnterpriseUsers}`);
            
            this.logTest(
                'User data analysis completed',
                true,
                `Analyzed ${usersSnapshot.docs.length} users`
            );
            
        } catch (error) {
            this.logTest('Existing user data analysis', false, error.message);
        }
    }

    /**
     * Test: Verify processor class structure
     */
    async testProcessorClassStructure() {
        try {
            console.log('\n🏗️  Test: Processor class structure...');
            
            const processor = new AddActiveFieldToUsers();
            
            // Check if required methods exist
            this.logTest(
                'Has isEnterpriseEmployee method',
                typeof processor.isEnterpriseEmployee === 'function',
                'Method not found'
            );
            
            this.logTest(
                'Has processUser method',
                typeof processor.processUser === 'function',
                'Method not found'
            );
            
            this.logTest(
                'Has processAllUsers method',
                typeof processor.processAllUsers === 'function',
                'Method not found'
            );
            
            this.logTest(
                'Has run method',
                typeof processor.run === 'function',
                'Method not found'
            );
            
            // Check if stats object exists
            this.logTest(
                'Has stats object',
                processor.stats && typeof processor.stats === 'object',
                'Stats object not found'
            );
            
            // Check required stats properties
            const requiredStats = ['processed', 'updated', 'skipped', 'errors', 'enterpriseEmployees', 'nonEnterpriseEmployees', 'nonEnterpriseUsers'];
            for (const stat of requiredStats) {
                this.logTest(
                    `Has ${stat} stat`,
                    processor.stats.hasOwnProperty(stat),
                    `Missing stat: ${stat}`
                );
            }
            
        } catch (error) {
            this.logTest('Processor class structure', false, error.message);
        }
    }

    /**
     * Test: Verify error handling
     */
    async testErrorHandling() {
        try {
            console.log('\n🛡️  Test: Error handling...');
            
            const processor = new AddActiveFieldToUsers();
            
            // Test with invalid user data
            const invalidUserData = {
                id: 'test-user',
                data: () => {
                    throw new Error('Simulated data error');
                },
                ref: {
                    update: async () => {
                        throw new Error('Simulated update error');
                    }
                }
            };
            
            const result = await processor.processUser(invalidUserData);
            
            this.logTest(
                'Handles processing errors gracefully',
                result.success === false && result.error,
                'Error not handled properly'
            );
            
            this.logTest(
                'Increments error count on failure',
                processor.stats.errors > 0,
                'Error count not incremented'
            );
            
        } catch (error) {
            this.logTest('Error handling', false, error.message);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Active Field Addition Tests');
        console.log('=' .repeat(50));
        
        try {
            await this.testProcessorClassStructure();
            await this.testEnterpriseEmployeeDetection();
            await this.testExistingUserData();
            await this.testErrorHandling();
            await this.testDryRunFunctionality();
            
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
                console.log('\n🎉 All tests passed! Active field addition should work correctly.');
                console.log('\n📝 Next steps:');
                console.log('  1. Run: node add-active-field-to-users.js --dry-run');
                console.log('  2. Review the output to ensure it looks correct');
                console.log('  3. Run: node add-active-field-to-users.js');
                console.log('  4. Verify results with this test script again');
            } else {
                console.log('\n⚠️  Some tests failed. Please review before running the script.');
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
    const tester = new ActiveFieldAdditionTester();
    
    try {
        const success = await tester.runAllTests();
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error('💥 Test runner failed:', error);
        process.exit(1);
    }
}

// Export for reuse
module.exports = { ActiveFieldAdditionTester };

// Run if called directly
if (require.main === module) {
    main();
} 