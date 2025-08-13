/*
 Purge Activity Logs Script

 Usage examples:
   node scripts/purgeActivityLogs.js --percent=80 --execute
   node scripts/purgeActivityLogs.js --percent=60 --enterpriseId=x-spark-test --execute
   node scripts/purgeActivityLogs.js               (dry-run)

 Notes:
 - Defaults to deleting 80% of documents in the `activityLogs` collection.
 - By default runs in DRY RUN mode. Pass --execute (or --yes) to actually delete.
 - Deletions are processed oldest-first by `timestamp` in batches of up to 500.
*/

const { db, admin } = require('../firebase');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    percent: 80,
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

async function getTotalLogsCount(enterpriseId) {
  try {
    let query = db.collection('activityLogs');
    if (enterpriseId) {
      query = query.where('details.enterpriseId', '==', enterpriseId);
    }
    if (typeof query.count === 'function') {
      const snap = await query.count().get();
      return snap.data().count;
    }
  } catch (e) {}

  let total = 0;
  let base = db.collection('activityLogs');
  if (enterpriseId) {
    base = base.where('details.enterpriseId', '==', enterpriseId);
  }
  let page = base.orderBy('timestamp', 'asc').limit(1000);
  let lastDoc = null;
  for (;;) {
    const snap = await page.get();
    total += snap.size;
    if (snap.empty || snap.size < 1000) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    page = base.orderBy('timestamp', 'asc').startAfter(lastDoc).limit(1000);
  }
  return total;
}

async function deleteOldestLogs(targetDeleteCount, enterpriseId) {
  const BATCH_LIMIT = 500;
  const PAGE_SIZE = 500;
  let deleted = 0;
  let lastDoc = null;

  while (deleted < targetDeleteCount) {
    let baseQuery = db.collection('activityLogs');
    if (enterpriseId) {
      baseQuery = baseQuery.where('details.enterpriseId', '==', enterpriseId);
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
      break;
    }
  }

  return deleted;
}

(async () => {
  try {
    const { percent, execute, enterpriseId } = parseArgs();
    console.log('— Purge Activity Logs —');
    console.log(`Scope: collection=activityLogs${enterpriseId ? `, enterpriseId=${enterpriseId}` : ''}`);

    const total = await getTotalLogsCount(enterpriseId);
    const targetDelete = Math.floor((percent / 100) * total);

    console.log(`Total activity logs found: ${total}`);
    console.log(`Target delete (${percent}%): ${targetDelete}`);

    if (!execute) {
      console.log('DRY RUN: No deletions performed. Re-run with --execute to purge.');
      process.exit(0);
    }

    if (targetDelete <= 0) {
      console.log('Nothing to delete based on current percentage/filters.');
      process.exit(0);
    }

    const deleted = await deleteOldestLogs(targetDelete, enterpriseId);
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







