# Employee Unassignment Edge Cases Test

This test script validates the enhanced employee unassignment functionality with proper warnings and edge case handling.

## What This Test Covers

### Edge Cases Implemented:
1. **Unassigning without deleting** - Employees can be unassigned from departments without setting `isEmployee: false`
2. **Bulk unassignment wrapper** - Efficient removal of all employees from a department in a single operation
3. **Team member warnings** - Different warnings for employees who are part of teams vs. regular employees

### Test Scenario:
1. ✅ Create a department (`Engineering`)
2. ✅ Create a team within the department (`Backend Team`)
3. ✅ Assign 5 employees to the department
4. ✅ Add 2 of them to the team
5. ✅ Attempt to unassign all employees (should show warnings)
6. ✅ Test individual unassignment with different responses:
   - Try to unassign team member without confirmation → Get warning
   - Unassign team member WITH confirmation → Success
   - Unassign regular employee → No warning needed
   - Try to unassign another team member and deny → Employee stays
7. ✅ Verify final state: 3 employees in department, 1 in team
8. ✅ Delete the remaining team member

## New API Endpoints

### Unassignment Endpoints
- `POST /enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/unassign`
- `POST /enterprise/:enterpriseId/departments/:departmentId/employees/unassign-all`

### Team Management Endpoints
- `POST /enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/employees`
- `DELETE /enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/employees/:employeeId`

## Running the Test

### Prerequisites
```bash
npm install axios
```

### Environment Setup
```bash
export BASE_URL="http://localhost:3000/api"  # Your API base URL
```

### Run the Test
```bash
node tests/test-employee-unassignment.js
```

## Expected Output

The test will show detailed progress with emojis and clear status messages:

```
🚀 Starting Employee Unassignment Edge Cases Test

📁 Step 1: Creating department...
✅ Department created: engineering

👥 Step 2: Creating team within department...
✅ Team created: backend-team

👷 Step 3: Creating and assigning 5 employees to department...
✅ Employee created: Alice Johnson
✅ Employee created: Bob Smith
...

🏆 Step 4: Adding 2 employees to the team...
✅ Added Alice Johnson to team
✅ Added Bob Smith to team

⚠️  Step 5: Attempting to unassign all employees (expecting warnings)...
✅ Received expected warning for bulk unassignment:
   Message: Some employees are part of teams and require confirmation
   Employees in teams: 2
   Total employees: 5

🎯 Step 6: Testing individual unassignment with different responses...

🔍 Step 6a: Attempting to unassign team member Alice without confirmation...
✅ Received expected warning for team member:
   Message: Warning: This employee is a member of the team "Backend Team"...

✅ Step 6b: Unassigning team member Alice WITH confirmation...
✅ Successfully unassigned team member:
   Employee: Alice Johnson
   Removed from team: true
   Still active: true

👤 Step 6c: Unassigning regular employee Carol (no team involvement)...
✅ Successfully unassigned regular employee:
   Employee: Carol Davis
   Removed from team: false
   Still active: true

❌ Step 6d: Attempting to unassign another team member Bob and saying "no"...
✅ Correctly received warning and did NOT proceed with unassignment:
   Employee Bob remains in department and team

📊 Step 7: Verifying final state...
✅ Remaining employees in department: 3
✅ Remaining team members: 1
🎉 Perfect! We have 3 employees left in department, 1 in team (as expected)

🗑️  Step 8: Deleting the last remaining team member...
✅ Successfully deleted employee: Bob Smith
   This should have removed them from both department and team

🏁 Final verification...
📊 Final count - Employees: 2, Team members: 0
🎉 Test completed successfully!
   ✅ 2 employees remain in department (unassigned from teams)
   ✅ 0 team members (team is empty)
   ✅ All edge cases handled correctly
```

## Key Features Validated

### 1. Enhanced Unassignment
- ✅ Employees can be unassigned without losing their employee status
- ✅ Department and team references are properly cleaned up
- ✅ Employee remains in the system for potential reassignment

### 2. Team Member Warnings
- ✅ Different warning messages for team members vs. regular employees
- ✅ Confirmation required before removing team members
- ✅ Graceful handling of user denial

### 3. Bulk Operations
- ✅ Efficient bulk unassignment with proper warnings
- ✅ Batch processing for large numbers of employees
- ✅ Transaction safety for data integrity

### 4. Data Consistency
- ✅ All references properly updated across collections
- ✅ Member counts accurately maintained
- ✅ No orphaned records left behind

## Troubleshooting

### Authentication Issues
If you get authentication errors, make sure to:
1. Have a valid user session
2. Update the `testData.authToken` in the script
3. Ensure your API requires authentication

### Department/Team Not Found
If entities aren't found:
1. Check that the enterprise ID exists (`test-enterprise`)
2. Verify the slugification logic matches your implementation
3. Ensure proper route definitions

### Employee Creation Failures
If employees can't be created:
1. Check email validation rules
2. Verify user creation process
3. Ensure proper field mappings

## Notes

- This test assumes you have authentication set up
- The test uses predictable IDs based on slugified names
- All operations are designed to be idempotent where possible
- The test includes comprehensive error handling and reporting 