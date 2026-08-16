import db from '../db/index.js';
import crypto from 'crypto';
import { logAudit } from './auditService.js';

/**
 * Creates a new donation receipt atomically.
 */
export function createReceipt(data, creatorId) {
  const {
    yearId,
    lineId,
    buildingName,
    flatNumber,
    donorName,
    donorMobile,
    amount,
    paymentMode
  } = data;

  // Start Transaction
  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Check if year is locked
    const year = db.prepare('SELECT status, year FROM festival_years WHERE id = ?').get(yearId);
    if (!year) throw new Error('Invalid collection year.');
    if (year.status === 'LOCKED') {
      throw new Error('This collection year is locked. No changes are allowed.');
    }

    // 2. Check if daily collection is locked for the current date
    const settings = db.prepare('SELECT close_daily_collection_date FROM settings WHERE year_id = ?').get(yearId);
    if (settings && settings.close_daily_collection_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr <= settings.close_daily_collection_date) {
        throw new Error('Collection for this date is closed by Admin.');
      }
    }

    // 3. Get Line Details for Prefix
    const line = db.prepare('SELECT name, prefix FROM lines_areas WHERE id = ?').get(lineId);
    if (!line) throw new Error('Invalid line/area.');

    // 4. Get/Increment Line Counter Atomically
    let nextSerial = 1;
    const counterRow = db.prepare('SELECT current_val FROM receipt_counters WHERE year_id = ? AND line_id = ?').get(yearId, lineId);
    
    if (!counterRow) {
      db.prepare('INSERT INTO receipt_counters (year_id, line_id, current_val) VALUES (?, ?, 1)').run(yearId, lineId);
      nextSerial = 1;
    } else {
      nextSerial = counterRow.current_val + 1;
      db.prepare('UPDATE receipt_counters SET current_val = ? WHERE year_id = ? AND line_id = ?').run(nextSerial, yearId, lineId);
    }

    // 5. Format serial number: Prefix-00X
    const receiptNumber = `${line.prefix}-${String(nextSerial).padStart(3, '0')}`;

    // 6. Generate Global Unique Receipt ID: REC-YEAR-XXXXXX
    const globalCountRow = db.prepare('SELECT COUNT(*) as count FROM receipts WHERE year_id = ?').get(yearId);
    const globalSeq = (globalCountRow?.count || 0) + 1;
    const globalReceiptId = `REC-${year.year}-${String(globalSeq).padStart(6, '0')}`;

    // 7. Secure random token for public link
    const secureToken = crypto.randomBytes(16).toString('hex');

    // 8. Determine Status based on payment mode
    const status = paymentMode === 'PENDING' ? 'PENDING' : 'PAID';
    const createdAt = new Date().toISOString();
    const paidAt = status === 'PAID' ? createdAt : null;
    const paidBy = status === 'PAID' ? creatorId : null;

    // 9. Insert Receipt
    const insertStmt = db.prepare(`
      INSERT INTO receipts (
        global_receipt_id, receipt_number, year_id, line_id, building_name, flat_number,
        donor_name, donor_mobile, amount, payment_mode, status, created_by, paid_by, created_at, paid_at, secure_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      globalReceiptId,
      receiptNumber,
      yearId,
      lineId,
      buildingName || null,
      flatNumber,
      donorName,
      donorMobile,
      amount,
      paymentMode,
      status,
      creatorId,
      paidBy,
      createdAt,
      paidAt,
      secureToken
    );

    const newReceiptId = result.lastInsertRowid;

    // 10. Log to Audit
    logAudit(creatorId, 'CREATE_RECEIPT', 'RECEIPT', newReceiptId, null, {
      global_receipt_id: globalReceiptId,
      receipt_number: receiptNumber,
      amount,
      payment_mode: paymentMode,
      status
    });

    db.exec('COMMIT');

    // Return the created receipt details
    return db.prepare('SELECT * FROM receipts WHERE id = ?').get(newReceiptId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Marks a pending receipt as paid.
 */
export function markReceiptAsPaid(receiptId, collectorId, paymentMode) {
  if (paymentMode === 'PENDING') {
    throw new Error('Payment mode cannot be PENDING when marking as PAID.');
  }

  db.exec('BEGIN TRANSACTION');

  try {
    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId);
    if (!receipt) throw new Error('Receipt not found.');
    if (receipt.status !== 'PENDING') {
      throw new Error(`Receipt is already in ${receipt.status} status.`);
    }

    // Check year lock
    const year = db.prepare('SELECT status FROM festival_years WHERE id = ?').get(receipt.year_id);
    if (year?.status === 'LOCKED') throw new Error('The year is locked.');

    // Check settings lock
    const settings = db.prepare('SELECT close_daily_collection_date FROM settings WHERE year_id = ?').get(receipt.year_id);
    if (settings && settings.close_daily_collection_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr <= settings.close_daily_collection_date) {
        throw new Error('Collection for this date is closed by Admin.');
      }
    }

    const paidAt = new Date().toISOString();

    db.prepare(`
      UPDATE receipts 
      SET status = 'PAID', payment_mode = ?, paid_by = ?, paid_at = ?
      WHERE id = ?
    `).run(paymentMode, collectorId, paidAt, receiptId);

    // Audit log
    logAudit(collectorId, 'MARK_PAID', 'RECEIPT', receiptId, 
      { status: receipt.status, payment_mode: receipt.payment_mode },
      { status: 'PAID', payment_mode: paymentMode, paid_by: collectorId, paid_at: paidAt }
    );

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Cancels an existing receipt (marks as CANCELLED).
 */
export function cancelReceipt(receiptId, userId, reason) {
  if (!reason || reason.trim() === '') {
    throw new Error('Cancellation reason is required.');
  }

  db.exec('BEGIN TRANSACTION');

  try {
    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId);
    if (!receipt) throw new Error('Receipt not found.');
    if (receipt.status === 'CANCELLED') {
      throw new Error('Receipt is already cancelled.');
    }

    // Check permissions (Admin can cancel, or Worker can if year/daily lock allows, but workers usually can't cancel silently. 
    // Audit logs will catch this).
    const year = db.prepare('SELECT status FROM festival_years WHERE id = ?').get(receipt.year_id);
    if (year?.status === 'LOCKED') throw new Error('The year is locked.');

    // Check settings lock
    const settings = db.prepare('SELECT close_daily_collection_date FROM settings WHERE year_id = ?').get(receipt.year_id);
    if (settings && settings.close_daily_collection_date) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (todayStr <= settings.close_daily_collection_date) {
        throw new Error('Collection for this date is closed by Admin.');
      }
    }

    const cancelledAt = new Date().toISOString();

    db.prepare(`
      UPDATE receipts
      SET status = 'CANCELLED', cancellation_reason = ?, cancelled_by = ?, cancelled_at = ?
      WHERE id = ?
    `).run(reason, userId, cancelledAt, receiptId);

    // Audit log
    logAudit(userId, 'CANCEL_RECEIPT', 'RECEIPT', receiptId,
      { status: receipt.status, cancellation_reason: receipt.cancellation_reason },
      { status: 'CANCELLED', cancellation_reason: reason, cancelled_by: userId, cancelled_at: cancelledAt }
    );

    db.exec('COMMIT');
    return db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
