const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';
const ENTERPRISE_ID = 'test-enterprise';

// Test data
let testData = {
    departmentId: null,
    teamId: null,
    employees: [],
    authToken: null
};

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null, headers = {}) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${testData.authToken}`,
                ...headers
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message, 
            status: error.response?.status 
        };
    }
};

// Helper function to create a test user
const createTestUser = async (email, name, surname) => {
    const userData = {
        email,
        name,
        surname,
        phone: '+27123456789',
        profileImage: '',
        isEmployee: false
    };
    
    // In a real scenario, you'd create users through your user creation endpoint
    console.log(`Creating test user: ${name} ${surname} (${email})`);
    return userData;
};

// Test functions
const runTest = async () => {
    console.log('🚀 Starting Employee Unassignment Edge Cases Test\n');
    
    try {
        // Note: In a real test, you'd authenticate first
        // testData.authToken = await authenticate();
        console.log('⚠️  Note: This test assumes you have proper authentication set up\n');
        
        // Step 1: Create a department
        console.log('📁 Step 1: Creating department...');
        const departmentResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments`, {
            name: 'Engineering',
            description: 'Software Engineering Department',
            managers: []
        });
        
        if (!departmentResult.success) {
            throw new Error(`Failed to create department: ${JSON.stringify(departmentResult.error)}`);
        }
        
        testData.departmentId = 'engineering'; // Based on the slugified name
        console.log(`✅ Department created: ${testData.departmentId}\n`);
        
        // Step 2: Create a team within the department
        console.log('👥 Step 2: Creating team within department...');
        const teamResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/teams`, {
            name: 'Backend Team',
            description: 'Backend development team'
        });
        
        if (!teamResult.success) {
            throw new Error(`Failed to create team: ${JSON.stringify(teamResult.error)}`);
        }
        
        testData.teamId = 'backend-team'; // Based on the slugified name
        console.log(`✅ Team created: ${testData.teamId}\n`);
        
        // Step 3: Create and assign 5 employees to the department
        console.log('👷 Step 3: Creating and assigning 5 employees to department...');
        const employeeNames = [
            { firstName: 'Alice', lastName: 'Johnson', email: 'alice.johnson@test.com' },
            { firstName: 'Bob', lastName: 'Smith', email: 'bob.smith@test.com' },
            { firstName: 'Carol', lastName: 'Davis', email: 'carol.davis@test.com' },
            { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@test.com' },
            { firstName: 'Eve', lastName: 'Brown', email: 'eve.brown@test.com' }
        ];
        
        for (const employee of employeeNames) {
            const employeeResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees`, {
                email: employee.email,
                firstName: employee.firstName,
                lastName: employee.lastName,
                role: 'employee',
                position: 'Software Developer'
            });
            
            if (!employeeResult.success) {
                console.warn(`⚠️  Failed to create employee ${employee.firstName} ${employee.lastName}: ${JSON.stringify(employeeResult.error)}`);
            } else {
                testData.employees.push({
                    ...employee,
                    id: employeeResult.data.data?.id || employeeResult.data.employee?.id,
                    inTeam: false
                });
                console.log(`✅ Employee created: ${employee.firstName} ${employee.lastName}`);
            }
        }
        
        console.log(`\n📊 Total employees created: ${testData.employees.length}\n`);
        
        // Step 4: Add 2 employees to the team
        console.log('🏆 Step 4: Adding 2 employees to the team...');
        const employeesToAddToTeam = testData.employees.slice(0, 2);
        
        for (const employee of employeesToAddToTeam) {
            const addToTeamResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/teams/${testData.teamId}/employees`, {
                employeeId: employee.id
            });
            
            if (!addToTeamResult.success) {
                console.warn(`⚠️  Failed to add ${employee.firstName} to team: ${JSON.stringify(addToTeamResult.error)}`);
            } else {
                employee.inTeam = true;
                console.log(`✅ Added ${employee.firstName} ${employee.lastName} to team`);
            }
        }
        
        console.log(`\n📊 Employees in team: ${testData.employees.filter(e => e.inTeam).length}\n`);
        
        // Step 5: Attempt to unassign all employees (should get warnings)
        console.log('⚠️  Step 5: Attempting to unassign all employees (expecting warnings)...');
        const bulkUnassignResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/unassign-all`, {
            confirmTeamRemovals: false
        });
        
        if (bulkUnassignResult.status === 409) {
            console.log('✅ Received expected warning for bulk unassignment:');
            console.log(`   Message: ${bulkUnassignResult.error.message}`);
            console.log(`   Employees in teams: ${bulkUnassignResult.error.employeesInTeams}`);
            console.log(`   Total employees: ${bulkUnassignResult.error.totalEmployees}\n`);
        } else {
            console.warn(`⚠️  Unexpected response for bulk unassignment: ${JSON.stringify(bulkUnassignResult)}\n`);
        }
        
        // Step 6: Unassign individual employees with different responses
        console.log('🎯 Step 6: Testing individual unassignment with different responses...');
        
        // Find employees in team and not in team
        const employeeInTeam = testData.employees.find(e => e.inTeam);
        const employeeNotInTeam = testData.employees.find(e => !e.inTeam);
        const anotherEmployeeInTeam = testData.employees.find(e => e.inTeam && e.id !== employeeInTeam.id);
        
        // Test 6a: Try to unassign team member without confirmation (should get warning)
        console.log(`\n🔍 Step 6a: Attempting to unassign team member ${employeeInTeam.firstName} without confirmation...`);
        const unassignTeamMemberResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/${employeeInTeam.id}/unassign`, {
            confirmTeamRemoval: false
        });
        
        if (unassignTeamMemberResult.status === 409) {
            console.log('✅ Received expected warning for team member:');
            console.log(`   Message: ${unassignTeamMemberResult.error.warning.message}`);
            console.log(`   Team: ${unassignTeamMemberResult.error.warning.teamInfo?.name}\n`);
        } else {
            console.warn(`⚠️  Unexpected response: ${JSON.stringify(unassignTeamMemberResult)}\n`);
        }
        
        // Test 6b: Unassign team member with confirmation (say "yes")
        console.log(`✅ Step 6b: Unassigning team member ${employeeInTeam.firstName} WITH confirmation...`);
        const confirmUnassignResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/${employeeInTeam.id}/unassign`, {
            confirmTeamRemoval: true
        });
        
        if (confirmUnassignResult.success) {
            console.log('✅ Successfully unassigned team member:');
            console.log(`   Employee: ${employeeInTeam.firstName} ${employeeInTeam.lastName}`);
            console.log(`   Removed from team: ${confirmUnassignResult.data.data.removedFromTeam}`);
            console.log(`   Still active: ${confirmUnassignResult.data.data.employeeStillActive}\n`);
            
            // Remove from our tracking
            testData.employees = testData.employees.filter(e => e.id !== employeeInTeam.id);
        } else {
            console.warn(`⚠️  Failed to unassign with confirmation: ${JSON.stringify(confirmUnassignResult)}\n`);
        }
        
        // Test 6c: Unassign regular employee (no team warning expected)
        console.log(`👤 Step 6c: Unassigning regular employee ${employeeNotInTeam.firstName} (no team involvement)...`);
        const unassignRegularResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/${employeeNotInTeam.id}/unassign`, {
            confirmTeamRemoval: false
        });
        
        if (unassignRegularResult.success) {
            console.log('✅ Successfully unassigned regular employee:');
            console.log(`   Employee: ${employeeNotInTeam.firstName} ${employeeNotInTeam.lastName}`);
            console.log(`   Removed from team: ${unassignRegularResult.data.data.removedFromTeam}`);
            console.log(`   Still active: ${unassignRegularResult.data.data.employeeStillActive}\n`);
            
            // Remove from our tracking
            testData.employees = testData.employees.filter(e => e.id !== employeeNotInTeam.id);
        } else {
            console.warn(`⚠️  Failed to unassign regular employee: ${JSON.stringify(unassignRegularResult)}\n`);
        }
        
        // Test 6d: Try to unassign another team member but say "no" (don't confirm)
        console.log(`❌ Step 6d: Attempting to unassign another team member ${anotherEmployeeInTeam.firstName} and saying "no"...`);
        const denyUnassignResult = await makeRequest('POST', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/${anotherEmployeeInTeam.id}/unassign`, {
            confirmTeamRemoval: false
        });
        
        if (denyUnassignResult.status === 409) {
            console.log('✅ Correctly received warning and did NOT proceed with unassignment:');
            console.log(`   Employee ${anotherEmployeeInTeam.firstName} remains in department and team\n`);
        } else {
            console.warn(`⚠️  Unexpected response when denying unassignment: ${JSON.stringify(denyUnassignResult)}\n`);
        }
        
        // Step 7: Verify final state
        console.log('📊 Step 7: Verifying final state...');
        const finalEmployeesResult = await makeRequest('GET', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees`);
        
        if (finalEmployeesResult.success) {
            const remainingEmployees = finalEmployeesResult.data.data || finalEmployeesResult.data.employees || [];
            console.log(`✅ Remaining employees in department: ${remainingEmployees.length}`);
            
            // Check team members
            const teamMembersResult = await makeRequest('GET', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/teams/${testData.teamId}/members`);
            
            if (teamMembersResult.success) {
                const teamMembers = teamMembersResult.data.members || [];
                console.log(`✅ Remaining team members: ${teamMembers.length}`);
                
                if (remainingEmployees.length === 3 && teamMembers.length === 1) {
                    console.log('🎉 Perfect! We have 3 employees left in department, 1 in team (as expected)\n');
                } else {
                    console.warn(`⚠️  Unexpected final state: ${remainingEmployees.length} employees, ${teamMembers.length} team members\n`);
                }
            }
        }
        
        // Step 8: Delete the remaining team member
        console.log('🗑️  Step 8: Deleting the last remaining team member...');
        const remainingTeamEmployee = testData.employees.find(e => e.inTeam && e.id !== employeeInTeam.id);
        
        if (remainingTeamEmployee) {
            const deleteResult = await makeRequest('DELETE', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees/${remainingTeamEmployee.id}`);
            
            if (deleteResult.success) {
                console.log(`✅ Successfully deleted employee: ${remainingTeamEmployee.firstName} ${remainingTeamEmployee.lastName}`);
                console.log('   This should have removed them from both department and team\n');
            } else {
                console.warn(`⚠️  Failed to delete employee: ${JSON.stringify(deleteResult)}\n`);
            }
        }
        
        // Final verification
        console.log('🏁 Final verification...');
        const finalCheck = await makeRequest('GET', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/employees`);
        const finalTeamCheck = await makeRequest('GET', `/enterprise/${ENTERPRISE_ID}/departments/${testData.departmentId}/teams/${testData.teamId}/members`);
        
        if (finalCheck.success && finalTeamCheck.success) {
            const finalEmployees = finalCheck.data.data || finalCheck.data.employees || [];
            const finalTeamMembers = finalTeamCheck.data.members || [];
            
            console.log(`📊 Final count - Employees: ${finalEmployees.length}, Team members: ${finalTeamMembers.length}`);
            
            if (finalEmployees.length === 2 && finalTeamMembers.length === 0) {
                console.log('🎉 Test completed successfully!');
                console.log('   ✅ 2 employees remain in department (unassigned from teams)');
                console.log('   ✅ 0 team members (team is empty)');
                console.log('   ✅ All edge cases handled correctly');
            } else {
                console.warn('⚠️  Final state doesn\'t match expectations');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
};

// Run the test
if (require.main === module) {
    runTest().then(() => {
        console.log('\n🏁 Test execution completed');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runTest }; 