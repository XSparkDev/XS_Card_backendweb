# Active Field Addition Script

This script adds an `active` field to user documents based on their enterprise employee status.

## Overview

The script processes all users in the database and adds an `active` field based on the following logic:

1. **Enterprise Employees** (`isEmployee: true` + enterprise plan) → `active: true`
2. **Non-Enterprise Employees** (`isEmployee: true` but not enterprise plan) → `active: false`  
3. **Non-Enterprise Users** (no `isEmployee` field) → **Skipped** (no changes)

## Logic Details

### Enterprise Employee Detection
A user is considered an enterprise employee if:
- `isEmployee: true` AND
- Has enterprise plan (`plan: 'enterprise'`) OR
- Has `enterpriseRef` OR  
- Has `employeeRef`

### Active Status Assignment
- **Enterprise employees**: `active: true`
- **Non-enterprise employees**: `active: false`
- **Non-enterprise users**: Skipped (no `active` field added)

## Files

### 1. Main Script: `add-active-field-to-users.js`
- Processes all users in batches
- Supports dry-run mode for testing
- Comprehensive error handling and reporting
- Detailed statistics and progress tracking

### 2. Test Script: `test-active-field-addition.js`
- Validates the logic and functionality
- Tests enterprise employee detection
- Verifies dry-run functionality
- Analyzes existing user data structure

## Usage

### Step 1: Test the Script
```bash
# Run comprehensive tests
node test-active-field-addition.js
```

### Step 2: Dry Run (Recommended)
```bash
# See what changes would be made without actually making them
node add-active-field-to-users.js --dry-run
```

### Step 3: Run the Script
```bash
# Make actual changes to the database
node add-active-field-to-users.js
```

### Step 4: Verify Results
```bash
# Run tests again to verify everything worked
node test-active-field-addition.js
```

## Command Line Options

- `--dry-run` or `-d`: Run in dry-run mode (no database changes)
- No arguments: Run in live mode (make actual changes)

## Output Example

```
🚀 Starting user active field addition process
============================================================
📋 Fetching all users...
📊 Found 150 users to process

📦 Processing batch 1/3 (50 users)

👤 Processing user: user123 (john@company.com)
  📊 User analysis:
    - isEmployee: true
    - plan: enterprise
    - enterpriseRef: exists
    - employeeRef: exists
    - Enterprise employee: true
    - Will set active: true
  ✅ Updated user with active: true

👤 Processing user: user456 (jane@personal.com)
  ⏭️  User is not an enterprise user (no isEmployee field), skipping

👤 Processing user: user789 (bob@company.com)
  📊 User analysis:
    - isEmployee: true
    - plan: free
    - enterpriseRef: none
    - employeeRef: none
    - Enterprise employee: false
    - Will set active: false
  ✅ Updated user with active: false

============================================================
📊 FINAL SUMMARY
============================================================
📈 Processing Results:
  ✅ Successfully updated: 45
  ⏭️  Skipped (already had active field): 5
  ❌ Errors: 0
  📋 Total processed: 150

👥 User Categories:
  🏢 Enterprise employees (active: true): 30
  👤 Non-enterprise employees (active: false): 15
  🚫 Non-enterprise users (skipped): 100

🎉 Successfully added 'active' field to 45 users!
```

## Safety Features

1. **Dry Run Mode**: Test the script without making changes
2. **Skip Existing**: Users with `active` field already set are skipped
3. **Batch Processing**: Processes users in batches to avoid overwhelming Firestore
4. **Error Handling**: Comprehensive error handling with detailed reporting
5. **Progress Tracking**: Real-time progress updates and statistics

## Impact Assessment

**Low Risk** - The script:
- Only adds a new field, doesn't modify existing data
- Skips users that already have the `active` field
- Provides detailed logging and statistics
- Supports dry-run mode for testing

## Post-Script Considerations

1. **User Authentication**: The `userController.js` already checks for `active: false` to block deactivated users
2. **API Compatibility**: Existing APIs should continue to work normally
3. **Frontend Updates**: Frontend may need updates to handle the new `active` field
4. **Monitoring**: Monitor for any unexpected behavior after the script runs

## Troubleshooting

### Common Issues

1. **"No users found"**: Check if the Firebase connection is working
2. **Permission errors**: Ensure the service account has read/write access to users collection
3. **Timeout errors**: The script processes users in batches, but very large datasets might need longer timeouts

### Rollback Strategy

If needed, you can manually remove the `active` field from users:
```javascript
// Example rollback script
const { db } = require('./firebase');
const usersSnapshot = await db.collection('users').get();
usersSnapshot.forEach(async (doc) => {
    await doc.ref.update({
        active: admin.firestore.FieldValue.delete()
    });
});
```

## Support

For issues or questions:
1. Run the test script first to identify problems
2. Check the detailed error logs in the script output
3. Verify Firebase permissions and connection
4. Use dry-run mode to test before making changes 