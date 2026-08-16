import db from './index.js';
import { hashPassword } from '../services/authService.js';
import crypto from 'crypto';

function runSeed() {
  console.log('Seeding database...');

  // Start transaction
  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Clear existing data
    db.exec('DELETE FROM audit_logs');
    db.exec('DELETE FROM receipts');
    db.exec('DELETE FROM receipt_counters');
    db.exec('DELETE FROM cash_handovers');
    db.exec('DELETE FROM announcements');
    db.exec('DELETE FROM notifications');
    db.exec('DELETE FROM settings');
    db.exec('DELETE FROM buildings');
    db.exec('DELETE FROM lines_areas');
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM festival_years');

    // Reset sqlite autoincrement sequences
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('festival_years','users','lines_areas','buildings','receipts','receipt_counters','cash_handovers','announcements','notifications','settings','audit_logs')");

    // 2. Insert Festival Years
    const insertYear = db.prepare('INSERT INTO festival_years (year, status) VALUES (?, ?)');
    const year2025Id = insertYear.run(2025, 'LOCKED').lastInsertRowid;
    const year2026Id = insertYear.run(2026, 'ACTIVE').lastInsertRowid;

    // 3. Insert Users
    const insertUser = db.prepare(`
      INSERT INTO users (role, name, mobile, password_hash, status, assigned_line_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const adminHash = hashPassword('admin123');
    const workerHash = hashPassword('worker123');

    // Create Admin
    const adminId = insertUser.run('ADMIN', 'President Admin', '9999999999', adminHash, 'APPROVED', null).lastInsertRowid;

    // Create Lines first to assign workers
    const insertLine = db.prepare('INSERT INTO lines_areas (year_id, name, prefix) VALUES (?, ?, ?)');
    const srLineId = insertLine.run(year2026Id, 'Shri Ram Colony', 'SR').lastInsertRowid;
    const gnLineId = insertLine.run(year2026Id, 'Ganesh Nagar', 'GN').lastInsertRowid;
    const snLineId = insertLine.run(year2026Id, 'Shivaji Nagar', 'SN').lastInsertRowid;

    // Historical lines for 2025
    const srLine2025Id = insertLine.run(year2025Id, 'Shri Ram Colony', 'SR').lastInsertRowid;

    // Create Workers
    const workerAId = insertUser.run('WORKER', 'Sanket Patil', '8888888888', workerHash, 'APPROVED', srLineId).lastInsertRowid;
    const workerBId = insertUser.run('WORKER', 'Rahul Shinde', '7777777777', workerHash, 'APPROVED', gnLineId).lastInsertRowid;
    const workerCId = insertUser.run('WORKER', 'Amol Gawde', '6666666666', workerHash, 'PENDING_APPROVAL', null).lastInsertRowid;
    const workerDId = insertUser.run('WORKER', 'Vijay Kale', '5555555555', workerHash, 'DISABLED', snLineId).lastInsertRowid;

    // 4. Insert Buildings
    const insertBuilding = db.prepare('INSERT INTO buildings (line_id, name) VALUES (?, ?)');
    
    // Shri Ram Colony buildings
    const srBldA = insertBuilding.run(srLineId, 'Building A').lastInsertRowid;
    const srBldB = insertBuilding.run(srLineId, 'Building B').lastInsertRowid;
    const srBldC = insertBuilding.run(srLineId, 'Building C').lastInsertRowid;

    // Ganesh Nagar buildings
    const gnBldX = insertBuilding.run(gnLineId, 'Wing X').lastInsertRowid;
    const gnBldY = insertBuilding.run(gnLineId, 'Wing Y').lastInsertRowid;

    // 5. Initialize Counters
    const insertCounter = db.prepare('INSERT INTO receipt_counters (year_id, line_id, current_val) VALUES (?, ?, ?)');
    insertCounter.run(year2026Id, srLineId, 5); // Worker A has created 5 receipts
    insertCounter.run(year2026Id, gnLineId, 3); // Worker B has created 3 receipts
    insertCounter.run(year2026Id, snLineId, 0);

    // 6. Insert Receipts for 2026
    const insertReceipt = db.prepare(`
      INSERT INTO receipts (
        global_receipt_id, receipt_number, year_id, line_id, building_name, flat_number,
        donor_name, donor_mobile, amount, payment_mode, status, created_by, paid_by, created_at, paid_at, secure_token,
        cancellation_reason, cancelled_by, cancelled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dateToday = new Date().toISOString();
    const dateYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dateTwoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Shri Ram Colony Receipts
    insertReceipt.run(
      'REC-2026-000001', 'SR-001', year2026Id, srLineId, 'Building A', '101',
      'Arjun Ghule', '9876543210', 501.00, 'CASH', 'PAID', workerAId, workerAId, dateTwoDaysAgo, dateTwoDaysAgo,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    insertReceipt.run(
      'REC-2026-000002', 'SR-002', year2026Id, srLineId, 'Building A', '102',
      'Mahesh Deshmukh', '9123456780', 1001.00, 'ONLINE', 'PAID', workerAId, workerAId, dateYesterday, dateYesterday,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    insertReceipt.run(
      'REC-2026-000003', 'SR-003', year2026Id, srLineId, 'Building B', '204',
      'Suresh Rane', '9988776655', 501.00, 'PENDING', 'PENDING', workerAId, null, dateYesterday, null,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    insertReceipt.run(
      'REC-2026-000004', 'SR-004', year2026Id, srLineId, 'Building C', '502',
      'Dinesh Kadam', '9555666777', 251.00, 'CASH', 'CANCELLED', workerAId, null, dateToday, null,
      crypto.randomBytes(16).toString('hex'), 'Incorrect amount entered', workerAId, dateToday
    );

    insertReceipt.run(
      'REC-2026-000005', 'SR-005', year2026Id, srLineId, 'Building B', '305',
      'Rajesh Mane', '9000111222', 151.00, 'CASH', 'PAID', workerAId, workerAId, dateToday, dateToday,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    // Ganesh Nagar Receipts
    insertReceipt.run(
      'REC-2026-000006', 'GN-001', year2026Id, gnLineId, 'Wing X', '401',
      'Rahul Patil', '9876543210', 501.00, 'PENDING', 'PENDING', workerBId, null, dateYesterday, null,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    insertReceipt.run(
      'REC-2026-000007', 'GN-002', year2026Id, gnLineId, 'Wing Y', '12',
      'Karan Jadhav', '9777666555', 10001.00, 'ONLINE', 'PAID', workerBId, workerBId, dateYesterday, dateYesterday,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    // This receipt was created as PENDING by Worker B, and marked as PAID by Worker A!
    insertReceipt.run(
      'REC-2026-000008', 'GN-003', year2026Id, gnLineId, 'Wing X', '202',
      'Shrikant Joshi', '9444555666', 2001.00, 'CASH', 'PAID', workerBId, workerAId, dateYesterday, dateToday,
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    // 7. Insert historical 2025 receipts for Customer History test (same mobile 9876543210)
    insertReceipt.run(
      'REC-2025-000001', 'SR-012', year2025Id, srLine2025Id, null, '101',
      'Arjun Ghule', '9876543210', 501.00, 'CASH', 'PAID', workerAId, workerAId, '2025-09-10T14:32:00.000Z', '2025-09-10T14:32:00.000Z',
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    insertReceipt.run(
      'REC-2025-000002', 'SR-034', year2025Id, srLine2025Id, null, '401',
      'Rahul Patil', '9876543210', 251.00, 'CASH', 'PAID', workerBId, workerBId, '2025-09-11T11:20:00.000Z', '2025-09-11T11:20:00.000Z',
      crypto.randomBytes(16).toString('hex'), null, null, null
    );

    // 8. Insert Settlements (Cash handovers)
    const insertSettlement = db.prepare(`
      INSERT INTO cash_handovers (worker_id, admin_id, year_id, expected_amount, submitted_amount, difference, explanation, status, created_at, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Worker A has submitted cash yesterday
    insertSettlement.run(
      workerAId, adminId, year2026Id, 501.00, 501.00, 0.00, 'Yesterday cash collection submitted', 'VERIFIED', dateYesterday, dateYesterday
    );
    // Worker A has a pending settlement for today
    insertSettlement.run(
      workerAId, null, year2026Id, 2152.00, 2150.00, -2.00, 'Short of 2 rupees change', 'PENDING_VERIFICATION', dateToday, null
    );

    // 9. Announcements
    const insertAnnouncement = db.prepare('INSERT INTO announcements (admin_id, message, created_at) VALUES (?, ?, ?)');
    insertAnnouncement.run(adminId, 'आज संध्याकाळी ९ वाजता सर्व कार्यकर्त्यांनी जमा झालेली रोख रक्कम (Cash) अध्यक्षांकडे जमा करावी.', dateYesterday);
    insertAnnouncement.run(adminId, 'Daily collection target: Please cover all flats in Shri Ram Colony Building B today.', dateToday);

    // 10. Notifications
    const insertNotification = db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)');
    insertNotification.run(workerAId, 'Welcome to Mandal App', 'Your worker registration has been approved. You can start collecting donations.');
    insertNotification.run(workerBId, 'Welcome to Mandal App', 'Your worker registration has been approved. You can start collecting donations.');

    // 11. Settings
    const insertSettings = db.prepare(`
      INSERT INTO settings (year_id, mandal_name, mandal_logo, mandal_address, mandal_contact, receipt_footer, terms_conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertSettings.run(
      year2026Id,
      'Shree Siddhivinayak Ganpati Mandal',
      null, // logo
      'S.V. Road, Near Ram Mandir, Mumbai - 400050',
      '022-26402324 / 9876543210',
      'गणपती बाप्पा मोरया! मंगलमूर्ती मोरया!',
      'Thank you for your generous contribution. The funds will be utilized for community welfare programs during the Ganpati Festival 2026.'
    );

    insertSettings.run(
      year2025Id,
      'Shree Siddhivinayak Ganpati Mandal',
      null,
      'S.V. Road, Near Ram Mandir, Mumbai - 400050',
      '022-26402324 / 9876543210',
      'गणपती बाप्पा मोरया! मंगलमूर्ती मोरया!',
      'Thank you for your contribution in 2025.'
    );

    // 12. Log seeds to Audit
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, old_value, new_value, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    auditStmt.run(adminId, 'SYSTEM_INIT', 'SYSTEM', 1, null, 'Database seeded with default settings and testing accounts', dateToday);

    db.exec('COMMIT');
    console.log('Database seeded successfully!');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

runSeed();
