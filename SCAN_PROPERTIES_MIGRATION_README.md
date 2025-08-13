# Scan Properties Consolidation Migration

## Overview

This migration consolidates all scan-related properties across all cards in the database to use a consistent `scanCount` property. Previously, different cards used different property names for tracking scan counts:

- `scans` - Used in some cards
- `scanCount` - Used in some cards (this is the standard we're consolidating to)
- `numberOfScan` - Used in one card

## Problem

The inconsistent naming of scan properties was causing issues in the frontend and API responses, where some cards would show scan counts and others wouldn't, depending on which property name was used.

## Solution

### 1. Migration Script

The migration script (`migrations/consolidate-scan-properties.js`) will:

1. **Find all cards** with `scans` property and move the value to `scanCount`
2. **Find all cards** with `numberOfScan` property and move the value to `scanCount`
3. **Remove the old properties** (`scans` and `numberOfScan`) to avoid confusion
4. **Preserve existing `scanCount` values** - if a card already has `scanCount`, it won't be overwritten
5. **Process in batches** to handle large datasets efficiently
6. **Provide detailed logging** of all changes made

### 2. API Updates

The enterprise controller (`controllers/enterprise/departmentsController.js`) has been updated to:

- **Explicitly exclude old scan properties** from API responses
- **Use destructuring** to remove `scans` and `numberOfScan` before returning card data
- **Ensure consistent response format** across all card endpoints

## Files Modified

### New Files
- `migrations/consolidate-scan-properties.js` - Main migration script
- `test-scan-properties.js` - Test script to check current state
- `SCAN_PROPERTIES_MIGRATION_README.md` - This documentation

### Modified Files
- `controllers/enterprise/departmentsController.js` - Updated to exclude old scan properties

## Running the Migration

### Step 1: Check Current State

First, run the test script to see the current state of scan properties:

```bash
node test-scan-properties.js
```

This will show you:
- How many cards have each type of scan property
- Examples of cards with old properties
- Whether migration is needed

### Step 2: Run the Migration

If the test shows cards with old properties, run the migration:

```bash
node migrations/consolidate-scan-properties.js
```

The migration will:
- Process all card documents in batches
- Move scan values to `scanCount`
- Remove old properties
- Provide detailed logging
- Run verification after completion

### Step 3: Verify Results

The migration script automatically runs verification after completion, but you can also run it manually:

```bash
node test-scan-properties.js
```

## Migration Logic

### Priority Order
1. **Existing `scanCount`** - If a card already has `scanCount`, keep that value
2. **`scans` property** - Move value to `scanCount` if `scanCount` doesn't exist or is 0
3. **`numberOfScan` property** - Move value to `scanCount` if `scanCount` doesn't exist or is 0

### Example Transformations

**Before:**
```json
{
  "name": "John Doe",
  "scans": 15,
  "scanCount": 0
}
```

**After:**
```json
{
  "name": "John Doe",
  "scanCount": 15
}
```

**Before:**
```json
{
  "name": "Jane Smith",
  "numberOfScan": 8
}
```

**After:**
```json
{
  "name": "Jane Smith",
  "scanCount": 8
}
```

## Safety Features

### Batch Processing
- Processes cards in batches of 500 (Firestore limit)
- Commits changes incrementally
- Provides progress updates

### Error Handling
- Continues processing even if individual cards fail
- Logs all errors for review
- Doesn't lose data if migration fails

### Verification
- Automatic verification after migration
- Manual verification script available
- Reports any remaining old properties

## Rollback Plan

If needed, you can rollback by:
1. Restoring from database backup
2. The migration doesn't delete data, only renames properties
3. All original values are preserved in `scanCount`

## Post-Migration

After successful migration:

1. **All cards will use `scanCount`** consistently
2. **API responses will be clean** without old properties
3. **Frontend will display scan counts** correctly for all cards
4. **New scans will increment `scanCount`** as expected

## Monitoring

Monitor the following after migration:
- Card scan counts display correctly in frontend
- API responses don't include old scan properties
- New scans increment the correct property
- No errors in scan tracking functionality

## Support

If you encounter issues:
1. Check the migration logs for detailed information
2. Run the verification script to identify problems
3. Review the database directly if needed
4. Contact the development team for assistance
