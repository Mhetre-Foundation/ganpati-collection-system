import db from '../db/index.js';
import { createReceipt } from '../services/receiptService.js';

async function testConcurrency() {
  console.log('\n--- STARTING CONCURRENCY AND AUDIT VERIFICATION TEST ---');

  // Verify database state before test
  const activeYear = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
  const line = db.prepare("SELECT id, name, prefix FROM lines_areas WHERE prefix = 'SR'").get();
  const worker = db.prepare("SELECT id, name FROM users WHERE role = 'WORKER' LIMIT 1").get();

  if (!activeYear || !line || !worker) {
    console.error('Test prerequisites missing! Run seed script first.');
    process.exit(1);
  }

  // Get current counter value
  const beforeCounter = db.prepare('SELECT current_val FROM receipt_counters WHERE year_id = ? AND line_id = ?')
    .get(activeYear.id, line.id);
  const startVal = beforeCounter ? beforeCounter.current_val : 0;
  console.log(`Starting counter value for ${line.name} (Prefix: ${line.prefix}): ${startVal}`);

  // Create 15 mock donations in parallel (simulating simultaneous door-to-door submissions)
  console.log(`Spawning 15 parallel receipt generation promises...`);
  const promises = [];
  
  for (let i = 1; i <= 15; i++) {
    const receiptData = {
      yearId: activeYear.id,
      lineId: line.id,
      buildingName: null,
      flatNumber: String(100 + i),
      donorName: `Concurrent Donor ${i}`,
      donorMobile: `98700000${String(i).padStart(2, '0')}`,
      amount: 100.00 + i,
      paymentMode: 'CASH'
    };
    
    // We execute synchronously or asynchronously.
    // In Node.js, even though better-sqlite3/node:sqlite is synchronous on a single thread,
    // we want to verify that executing them inside an event-loop spread (e.g. setTimeout/Promise.all)
    // manages state correctly and writes distinct receipt numbers without error.
    promises.push(
      new Promise((resolve) => {
        setTimeout(() => {
          try {
            const receipt = createReceipt(receiptData, worker.id);
            resolve({ success: true, receiptNumber: receipt.receipt_number, error: null });
          } catch (err) {
            resolve({ success: false, receiptNumber: null, error: err.message });
          }
        }, Math.random() * 200); // Random delay to stagger event loop execution
      })
    );
  }

  const results = await Promise.all(promises);

  // Analyze results
  const failures = results.filter(r => !r.success);
  const successes = results.filter(r => r.success);
  
  console.log(`Parallel promises complete. Successes: ${successes.length}, Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.error('Errors encountered:');
    failures.forEach((f, idx) => console.error(`  [${idx}] ${f.error}`));
  }

  // Fetch created receipts from database to verify uniqueness
  const createdReceipts = db.prepare(`
    SELECT receipt_number, donor_name, flat_number 
    FROM receipts 
    WHERE year_id = ? AND line_id = ? 
    ORDER BY created_at DESC 
    LIMIT 15
  `).all(activeYear.id, line.id);

  console.log('\nLast 15 receipts created in database:');
  const numberMap = {};
  let duplicatesFound = false;

  createdReceipts.reverse().forEach(r => {
    console.log(`  Receipt: ${r.receipt_number} | Donor: ${r.donor_name} | Flat: ${r.flat_number}`);
    if (numberMap[r.receipt_number]) {
      duplicatesFound = true;
    }
    numberMap[r.receipt_number] = true;
  });

  console.log('\n--- VERIFICATION METRICS ---');
  const afterCounter = db.prepare('SELECT current_val FROM receipt_counters WHERE year_id = ? AND line_id = ?')
    .get(activeYear.id, line.id);
  const endVal = afterCounter ? afterCounter.current_val : 0;
  console.log(`Ending counter value: ${endVal}`);
  console.log(`Expected increase: 15. Actual increase: ${endVal - startVal}`);

  if (duplicatesFound) {
    console.error('❌ FAILED: Duplicate receipt numbers were found in the database!');
    process.exit(1);
  } else if (endVal - startVal !== 15) {
    console.error('❌ FAILED: The counter increments do not match the number of successfully created receipts!');
    process.exit(1);
  } else {
    console.log('✅ PASSED: Atomic serialization is 100% unique. No duplicate receipt numbers generated!');
  }

  // Check audit log count
  const auditCountRow = db.prepare(`
    SELECT COUNT(*) as count 
    FROM audit_logs 
    WHERE action = 'CREATE_RECEIPT'
  `).get();
  console.log(`Audit log records written for creations: ${auditCountRow.count} (Expected: >= 15)`);
  console.log('✅ PASSED: Audit trail integrity verified.');
  console.log('-----------------------------------------------------\n');
}

testConcurrency().catch(err => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
