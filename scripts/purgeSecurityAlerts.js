/*
 Purge Security Alerts Script

 Usage examples:
   node scripts/purgeSecurityAlerts.js --percent=97 --execute
   node scripts/purgeSecurityAlerts.js --percent=80 --enterpriseId=x-spark-test --execute
   node scripts/purgeSecurityAlerts.js               (dry-run, shows what would happen)

 Notes:
 - Defaults to deleting 97% of documents in the `securityAlerts` collection.
 - By default runs in DRY RUN mode. Pass --execute (or --yes) to actually delete.
 - Deletions are processed oldest-first by `timestamp` in batches of up to 500.
*/

const { db, admin } = require('../firebase');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    percent: 97,
    execute: false,
    enterpriseId: undefined,
  };

  for (const arg of args) {
    if (arg.startsWith('--percent=')) {
      const val = Number(arg.split('=')[1]);
      if (!Number.isFinite(val) || val <= 0 || val >= 100) {
        throw new Error('Invalid --percent value. Use a number between 1 and 99.');
      }
      result.percent = val;
    } else if (arg === '--execute' || arg === '--yes') {
      result.execute = true;
    } else if (arg.startsWith('--enterpriseId=')) {
      result.enterpriseId = arg.split('=')[1];
    }
  }

  return result;
}

async function getTotalAlertsCount(enterpriseId) {
  // Prefer count() aggregation if supported
  try {
    let query = db.collection('securityAlerts');
    if (enterpriseId) {
      query = query.where('enterpriseId', '==', enterpriseId);
    }
    // Aggregation queries require Firebase Admin SDK with count support
    if (typeof query.count === 'function') {
      const snap = await query.count().get();
      return snap.data().count;
    }
  } catch (e) {
    // Fallthrough to manual count
  }

  // Fallback: manual count (paginated for safety)
  let total = 0;
  let query = db.collection('securityAlerts');
  if (enterpriseId) {
    query = query.where('enterpriseId', '==', enterpriseId);
  }
  let page = query.orderBy('timestamp', 'asc').limit(1000);
  let lastDoc = null;
  for (;;) {
    const snap = await page.get();
    total += snap.size;
    if (snap.empty || snap.size < 1000) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    page = query.orderBy('timestamp', 'asc').startAfter(lastDoc).limit(1000);
  }
  return total;
}

async function deleteOldestAlerts(targetDeleteCount, enterpriseId) {
  const BATCH_LIMIT = 500;
  const PAGE_SIZE = 500; // read size aligned with batch limit
  let deleted = 0;
  let lastDoc = null;

  while (deleted < targetDeleteCount) {
    let baseQuery = db.collection('securityAlerts');
    if (enterpriseId) {
      baseQuery = baseQuery.where('enterpriseId', '==', enterpriseId);
    }
    let query = baseQuery.orderBy('timestamp', 'asc').limit(Math.min(PAGE_SIZE, targetDeleteCount - deleted));
    if (lastDoc) {
      query = baseQuery.orderBy('timestamp', 'asc').startAfter(lastDoc).limit(Math.min(PAGE_SIZE, targetDeleteCount - deleted));
    }

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      ops += 1;
      deleted += 1;
      lastDoc = doc;
      if (ops === BATCH_LIMIT || deleted >= targetDeleteCount) {
        break;
      }
    }
    await batch.commit();
    console.log(`✅ Deleted batch: ${ops} (total deleted: ${deleted}/${targetDeleteCount})`);

    if (snap.size < Math.min(PAGE_SIZE, targetDeleteCount - (deleted - ops))) {
      // No more docs to delete
      break;
    }
  }

  return deleted;
}

(async () => {
  try {
    const { percent, execute, enterpriseId } = parseArgs();
    console.log('— Purge Security Alerts —');
    console.log(`Scope: collection=securityAlerts${enterpriseId ? `, enterpriseId=${enterpriseId}` : ''}`);

    const total = await getTotalAlertsCount(enterpriseId);
    const targetDelete = Math.floor((percent / 100) * total);

    console.log(`Total alerts found: ${total}`);
    console.log(`Target delete (${percent}%): ${targetDelete}`);

    if (!execute) {
      console.log('DRY RUN: No deletions performed. Re-run with --execute to purge.');
      process.exit(0);
    }

    if (targetDelete <= 0) {
      console.log('Nothing to delete based on current percentage/filters.');
      process.exit(0);
    }

    const deleted = await deleteOldestAlerts(targetDelete, enterpriseId);
    console.log('— Result —');
    console.log(`Requested delete: ${targetDelete}`);
    console.log(`Actually deleted: ${deleted}`);
    console.log(`Remaining approximate: ${total - deleted}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Purge failed:', error.message);
    process.exit(1);
  }
})();











