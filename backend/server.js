import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db/index.js';
import { hashPassword, comparePassword, generateToken, verifyToken } from './services/authService.js';
import { createReceipt, markReceiptAsPaid, cancelReceipt } from './services/receiptService.js';
import { sendReceiptNotification, sendAlertSMS } from './services/notificationService.js';
import { generateQRCode } from './services/qrService.js';
import { logAudit } from './services/auditService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON payloads
app.use(express.json({ limit: '10mb' }));

// Middleware: Authenticate Request
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
  
  // Re-verify user status in DB
  const user = db.prepare('SELECT status, role, name, mobile FROM users WHERE id = ?').get(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }
  if (user.status !== 'APPROVED') {
    return res.status(403).json({ error: `Access denied. Your account status is: ${user.status}` });
  }

  req.user = {
    id: decoded.id,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    status: user.status
  };
  next();
}

// Middleware: Authorize Roles
function authorize(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Worker registration
app.post('/api/auth/register', (req, res) => {
  const { name, mobile, password, lineId, profilePhoto } = req.body;

  if (!name || !mobile || !password) {
    return res.status(400).json({ error: 'Name, mobile, and PIN/password are required.' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
    if (existing) {
      return res.status(400).json({ error: 'This mobile number is already registered.' });
    }

    const hashedPassword = hashPassword(password);
    const stmt = db.prepare(`
      INSERT INTO users (role, name, mobile, password_hash, status, assigned_line_id, profile_photo)
      VALUES ('WORKER', ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
    `);
    const result = stmt.run(name, mobile, hashedPassword, lineId || null, profilePhoto || null);
    const userId = result.lastInsertRowid;

    // Log audit
    logAudit(null, 'REGISTER_WORKER', 'USER', userId, null, { name, mobile, lineId });

    // Send mock notification to admin (or worker alert)
    sendAlertSMS(mobile, 'Registration Submitted', `Hello ${name}, your registration is received and pending President approval.`);

    res.status(201).json({ message: 'Registration submitted successfully. Waiting for Admin approval.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login (Both Admin and Worker)
app.post('/api/auth/login', (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ error: 'Mobile / Login ID and PIN/password are required.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (!user) {
      return res.status(400).json({ error: 'Invalid mobile number/Login ID or PIN/password.' });
    }

    if (!comparePassword(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid mobile number/Login ID or PIN/password.' });
    }

    // Check approval status
    if (user.status !== 'APPROVED') {
      if (user.status === 'PENDING_APPROVAL') {
        return res.status(403).json({ error: 'Your account is pending admin approval. Please contact the Mandal President.' });
      } else if (user.status === 'DISABLED') {
        return res.status(403).json({ error: 'Your account is currently disabled. Please contact the Admin.' });
      } else if (user.status === 'REJECTED') {
        return res.status(403).json({ error: 'Your worker registration request was rejected by the admin.' });
      }
    }

    // Generate JWT
    const token = generateToken(user);

    // Log login
    logAudit(user.id, 'LOGIN', 'USER', user.id);

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        mobile: user.mobile,
        assignedLineId: user.assigned_line_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get session info
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});


// ==========================================
// 2. ADMIN WORKER MANAGEMENT ENDPOINTS
// ==========================================

// Get pending worker requests
app.get('/api/workers/requests', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT u.id, u.name, u.mobile, u.created_at, l.name as line_name 
      FROM users u
      LEFT JOIN lines_areas l ON u.assigned_line_id = l.id
      WHERE u.role = 'WORKER' AND u.status = 'PENDING_APPROVAL'
      ORDER BY u.created_at DESC
    `).all();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve worker requests.' });
  }
});

// Approve, Reject, Disable, Enable Worker, assign Line
app.post('/api/workers/:id/status', authenticate, authorize(['ADMIN']), (req, res) => {
  const workerId = req.params.id;
  const { status, assignedLineId } = req.body;

  if (!status || !['APPROVED', 'REJECTED', 'DISABLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status parameter.' });
  }

  let parsedLineId = null;
  if (assignedLineId !== undefined && assignedLineId !== null && assignedLineId !== '' && !isNaN(assignedLineId)) {
    parsedLineId = parseInt(assignedLineId);
  }

  try {
    const worker = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'WORKER'").get(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    db.prepare(`
      UPDATE users 
      SET status = ?, assigned_line_id = ?
      WHERE id = ?
    `).run(status, parsedLineId, workerId);

    // Audit Log
    logAudit(req.user.id, `WORKER_STATUS_${status}`, 'USER', workerId, 
      { status: worker.status, assigned_line_id: worker.assigned_line_id },
      { status, assigned_line_id: parsedLineId }
    );

    // Notify worker
    sendAlertSMS(worker.mobile, 'Account Status Updated', `Your worker account has been: ${status}`);

    res.json({ message: `Worker account status successfully set to ${status}.` });
  } catch (error) {
    console.error('Worker status update error:', error);
    res.status(500).json({ error: 'Failed to update worker status.' });
  }
});

// Reset Worker PIN/Password
app.post('/api/workers/:id/reset-pin', authenticate, authorize(['ADMIN']), (req, res) => {
  const workerId = req.params.id;
  const { newPin } = req.body;

  if (!newPin || String(newPin).trim() === '') {
    return res.status(400).json({ error: 'New PIN is required.' });
  }

  try {
    const worker = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'WORKER'").get(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    const hashedPin = hashPassword(newPin);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPin, workerId);

    // Audit log
    logAudit(req.user.id, 'WORKER_RESET_PIN', 'USER', workerId);

    sendAlertSMS(worker.mobile, 'PIN Reset Success', `Your PIN has been reset by the Admin.`);

    res.json({ message: 'Worker PIN reset successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset worker PIN.' });
  }
});

// List all workers
app.get('/api/workers/list', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const list = db.prepare(`
      SELECT u.id, u.name, u.mobile, u.status, u.profile_photo, u.created_at, u.assigned_line_id, l.name as line_name,
        (SELECT COUNT(*) FROM receipts WHERE created_by = u.id) as receipts_created,
        (SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE created_by = u.id AND status = 'PAID') as amount_collected
      FROM users u
      LEFT JOIN lines_areas l ON u.assigned_line_id = l.id
      WHERE u.role = 'WORKER'
      ORDER BY u.name ASC
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve workers list.' });
  }
});

// Public endpoint for getting lines (used in registration without auth)
app.get('/api/public/lines', (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.json([]);
    }
    const lines = db.prepare('SELECT id, name, prefix FROM lines_areas WHERE year_id = ?').all(activeYearRow.id);
    res.json(lines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve areas.' });
  }
});


// ==========================================
// 3. LINES AND BUILDINGS MANAGEMENT
// ==========================================

// Get active Year lines and building hierarchy
app.get('/api/locations/lines-buildings', authenticate, (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.json([]);
    }

    const lines = db.prepare('SELECT id, name, prefix FROM lines_areas WHERE year_id = ?').all(activeYearRow.id);
    const buildings = db.prepare(`
      SELECT b.id, b.line_id, b.name 
      FROM buildings b
      JOIN lines_areas l ON b.line_id = l.id
      WHERE l.year_id = ?
    `).all(activeYearRow.id);

    // Nested structure
    const data = lines.map(line => ({
      ...line,
      buildings: buildings.filter(b => b.line_id === line.id)
    }));

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load area configurations.' });
  }
});

// Admin: Add Line
app.post('/api/locations/line', authenticate, authorize(['ADMIN']), (req, res) => {
  const { name, prefix } = req.body;
  if (!name || !prefix) {
    return res.status(400).json({ error: 'Line/Area name and prefix are required.' });
  }

  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.status(400).json({ error: 'No active festival year defined.' });
    }

    const stmt = db.prepare('INSERT INTO lines_areas (year_id, name, prefix) VALUES (?, ?, ?)');
    const result = stmt.run(activeYearRow.id, name, prefix);

    logAudit(req.user.id, 'ADD_LINE', 'LINE', result.lastInsertRowid, null, { name, prefix });
    res.status(201).json({ message: 'Line created successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Line. Prefix or Name may already exist.' });
  }
});

// Admin: Add Building
app.post('/api/locations/building', authenticate, authorize(['ADMIN']), (req, res) => {
  const { lineId, name } = req.body;
  if (!lineId || !name) {
    return res.status(400).json({ error: 'Line assignment and building name are required.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO buildings (line_id, name) VALUES (?, ?)');
    const result = stmt.run(lineId, name);

    logAudit(req.user.id, 'ADD_BUILDING', 'BUILDING', result.lastInsertRowid, null, { lineId, name });
    res.status(201).json({ message: 'Building created successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create building. Building name may already exist in this area.' });
  }
});


// ==========================================
// 4. RECEIPT ENDPOINTS (FINANCIAL OPERATIONS)
// ==========================================

// Create Receipt (Worker action)
app.post('/api/receipts/create', authenticate, (req, res) => {
  const { lineId, buildingName, flatNumber, donorName, donorMobile, amount, paymentMode } = req.body;

  if (!lineId || !flatNumber || !donorName || !donorMobile || !amount || !paymentMode) {
    return res.status(400).json({ error: 'Please enter all mandatory donor details.' });
  }

  if (isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Please enter a valid donation amount.' });
  }

  // Validate Indian Mobile Number (10 digits)
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(donorMobile)) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }

  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.status(400).json({ error: 'No active festival year defined.' });
    }

    // Duplicate mobile warning query (Returns warning to frontend, client decides whether to proceed)
    const duplicateCheck = db.prepare(`
      SELECT r.receipt_number, r.status, y.year 
      FROM receipts r
      JOIN festival_years y ON r.year_id = y.id
      WHERE r.donor_mobile = ? AND r.year_id = ? AND r.status != 'CANCELLED'
    `).get(donorMobile, activeYearRow.id);

    if (duplicateCheck && !req.headers['x-bypass-duplicate-warning']) {
      return res.status(409).json({
        warning: true,
        message: `Donor mobile number already has a receipt (${duplicateCheck.receipt_number}) for Year ${duplicateCheck.year}.`
      });
    }

    // Insert Receipt atomically
    const receiptData = {
      yearId: activeYearRow.id,
      lineId,
      buildingName,
      flatNumber,
      donorName,
      donorMobile,
      amount: parseFloat(amount),
      paymentMode
    };

    const newReceipt = createReceipt(receiptData, req.user.id);
    
    // Get Mandal Settings for SMS Template
    const mandalSettings = db.prepare('SELECT mandal_name FROM settings WHERE year_id = ?').get(activeYearRow.id);
    
    // Send Notification Link
    const notifResult = sendReceiptNotification(newReceipt, mandalSettings?.mandal_name, req.headers.origin || 'http://localhost:5173');

    res.status(201).json({
      message: 'Receipt generated successfully.',
      receipt: newReceipt,
      notification: notifResult
    });
  } catch (error) {
    console.error('Receipt generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate receipt. Please try again.' });
  }
});

// Mark pending receipt as PAID
app.post('/api/receipts/:id/mark-paid', authenticate, (req, res) => {
  const receiptId = req.params.id;
  const { paymentMode } = req.body;

  if (!paymentMode || !['CASH', 'ONLINE'].includes(paymentMode)) {
    return res.status(400).json({ error: 'Please specify a valid payment mode (CASH/ONLINE).' });
  }

  try {
    const updated = markReceiptAsPaid(receiptId, req.user.id, paymentMode);
    
    const mandalSettings = db.prepare('SELECT mandal_name FROM settings WHERE year_id = ?').get(updated.year_id);
    const notifResult = sendReceiptNotification(updated, mandalSettings?.mandal_name, req.headers.origin || 'http://localhost:5173');

    res.json({
      message: 'Receipt successfully marked as PAID.',
      receipt: updated,
      notification: notifResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update payment status.' });
  }
});

// Cancel Receipt
app.post('/api/receipts/:id/cancel', authenticate, (req, res) => {
  const receiptId = req.params.id;
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'Cancellation reason is required.' });
  }

  try {
    const cancelled = cancelReceipt(receiptId, req.user.id, reason);
    res.json({ message: 'Receipt has been cancelled.', receipt: cancelled });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to cancel receipt.' });
  }
});

// Search Receipts (Mobile, Receipt Number, Donor Name, Flat Number)
app.get('/api/receipts/search', authenticate, (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
    const wildcard = `%${query}%`;
    const searchResults = db.prepare(`
      SELECT r.id, r.global_receipt_id, r.receipt_number, r.flat_number, r.donor_name, r.donor_mobile,
             r.amount, r.payment_mode, r.status, r.created_at, r.paid_at, r.secure_token,
             y.year, l.name as line_name, r.building_name,
             u_c.name as creator_name, u_p.name as collector_name
      FROM receipts r
      JOIN festival_years y ON r.year_id = y.id
      JOIN lines_areas l ON r.line_id = l.id
      LEFT JOIN users u_c ON r.created_by = u_c.id
      LEFT JOIN users u_p ON r.paid_by = u_p.id
      WHERE r.donor_mobile LIKE ? 
         OR r.receipt_number LIKE ? 
         OR r.donor_name LIKE ? 
         OR (r.flat_number LIKE ? AND r.receipt_number LIKE ?)
      ORDER BY y.year DESC, r.created_at DESC
    `).all(wildcard, wildcard, wildcard, wildcard, wildcard);

    res.json(searchResults);
  } catch (error) {
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// Worker: Get own receipts history
app.get('/api/receipts/my-receipts', authenticate, (req, res) => {
  const { period } = req.query; // 'today', 'week', 'month', 'all'
  const workerId = req.user.id;

  try {
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "AND date(r.created_at) = date('now', 'localtime')";
    } else if (period === 'week') {
      dateFilter = "AND date(r.created_at) >= date('now', '-7 days', 'localtime')";
    } else if (period === 'month') {
      dateFilter = "AND date(r.created_at) >= date('now', '-30 days', 'localtime')";
    }

    const receipts = db.prepare(`
      SELECT r.id, r.global_receipt_id, r.receipt_number, r.flat_number, r.donor_name, r.donor_mobile,
             r.amount, r.payment_mode, r.status, r.created_at, r.paid_at, r.secure_token,
             l.name as line_name, r.building_name
      FROM receipts r
      JOIN lines_areas l ON r.line_id = l.id
      WHERE r.created_by = ? ${dateFilter}
      ORDER BY r.created_at DESC
    `).all(workerId);

    // Summary calculations
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN status='PAID' THEN amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status='PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status='PAID' AND payment_mode='CASH' THEN amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN status='PAID' AND payment_mode='ONLINE' THEN amount ELSE 0 END), 0) as online_amount
      FROM receipts r
      WHERE r.created_by = ? ${dateFilter}
    `).get(workerId);

    res.json({ receipts, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve collections history.' });
  }
});


// ==========================================
// 5. PUBLIC RECEIPT VERIFICATION (QR LINK)
// ==========================================
app.get('/api/receipts/public/:token', async (req, res) => {
  const token = req.params.token;

  try {
    const receipt = db.prepare(`
      SELECT r.id, r.global_receipt_id, r.receipt_number, r.flat_number, r.donor_name, r.donor_mobile,
             r.amount, r.payment_mode, r.status, r.created_at, r.paid_at, r.secure_token,
             r.cancellation_reason, r.cancelled_at,
             y.year, l.name as line_name, r.building_name,
             u_c.name as creator_name, u_p.name as collector_name,
             u_can.name as canceller_name
      FROM receipts r
      JOIN festival_years y ON r.year_id = y.id
      JOIN lines_areas l ON r.line_id = l.id
      LEFT JOIN users u_c ON r.created_by = u_c.id
      LEFT JOIN users u_p ON r.paid_by = u_p.id
      LEFT JOIN users u_can ON r.cancelled_by = u_can.id
      WHERE r.secure_token = ?
    `).get(token);

    if (!receipt) {
      return res.status(404).json({ error: 'Invalid receipt verification link.' });
    }

    // Mask donor mobile for privacy
    const maskedMobile = receipt.donor_mobile.replace(/.(?=.{4})/g, 'X');

    // Get Mandal settings for layout
    const settings = db.prepare('SELECT mandal_name, mandal_logo, mandal_address, mandal_contact, receipt_footer, terms_conditions FROM settings WHERE year_id = ?').get(receipt.id ? db.prepare('SELECT year_id FROM receipts WHERE secure_token = ?').get(token).year_id : 0);

    // Generate Verification Link QR code
    const host = req.headers.host;
    const protocol = req.secure ? 'https' : 'http';
    const qrText = `${protocol}://${host}/receipt/${token}`;
    const qrCodeBase64 = await generateQRCode(qrText);

    res.json({
      receipt: {
        ...receipt,
        donor_mobile: maskedMobile
      },
      settings,
      qrCode: qrCodeBase64
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});


// ==========================================
// 6. CASH SETTLEMENTS (HANDOVERS)
// ==========================================

// Worker: Request Settlement/Handover
app.post('/api/settlements/handover', authenticate, (req, res) => {
  const workerId = req.user.id;
  const { submittedAmount, explanation } = req.body;

  if (isNaN(submittedAmount) || parseFloat(submittedAmount) <= 0) {
    return res.status(400).json({ error: 'Please enter a valid handover amount.' });
  }

  try {
    const activeYear = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYear) return res.status(400).json({ error: 'No active year found.' });

    // Calculate expected CASH collection for this worker (Cash collected and not yet settled/handed over)
    // Wait! Let's calculate expected CASH amount as: Total CASH Receipts created by worker where status is PAID.
    // However, to make it robust, we calculate expected CASH collected by worker which is NOT already locked in a VERIFIED settlement.
    // For simplicity: Expected Cash = Sum of PAID CASH receipts created by worker - Sum of already VERIFIED submitted amounts.
    const paidCashRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as expected 
      FROM receipts 
      WHERE paid_by = ? AND status = 'PAID' AND payment_mode = 'CASH' AND year_id = ?
    `).get(workerId, activeYear.id);

    const alreadySettledRow = db.prepare(`
      SELECT COALESCE(SUM(expected_amount), 0) as settled 
      FROM cash_handovers 
      WHERE worker_id = ? AND year_id = ?
    `).get(workerId, activeYear.id);

    const expectedCashAmount = paidCashRow.expected - alreadySettledRow.settled;

    const diff = parseFloat(submittedAmount) - expectedCashAmount;

    const stmt = db.prepare(`
      INSERT INTO cash_handovers (worker_id, year_id, expected_amount, submitted_amount, difference, explanation, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION')
    `);
    const result = stmt.run(workerId, activeYear.id, expectedCashAmount, parseFloat(submittedAmount), diff, explanation || null);

    // Audit log
    logAudit(workerId, 'SUBMIT_SETTLEMENT', 'SETTLEMENT', result.lastInsertRowid, null, {
      expected: expectedCashAmount,
      submitted: parseFloat(submittedAmount),
      difference: diff
    });

    res.status(201).json({ message: 'Cash settlement request submitted successfully. Awaiting Admin verification.' });
  } catch (error) {
    res.status(500).json({ error: 'Handover submission failed.' });
  }
});

// Admin: Get settlements list
app.get('/api/settlements/list', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const handovers = db.prepare(`
      SELECT h.id, h.expected_amount, h.submitted_amount, h.difference, h.explanation, h.status, h.created_at, h.verified_at,
             w.name as worker_name, w.mobile as worker_mobile,
             a.name as admin_name
      FROM cash_handovers h
      JOIN users w ON h.worker_id = w.id
      LEFT JOIN users a ON h.admin_id = a.id
      ORDER BY h.status DESC, h.created_at DESC
    `).all();
    res.json(handovers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settlements.' });
  }
});

// Admin: Verify settlement
app.post('/api/settlements/:id/verify', authenticate, authorize(['ADMIN']), (req, res) => {
  const settlementId = req.params.id;

  try {
    const handover = db.prepare('SELECT * FROM cash_handovers WHERE id = ?').get(settlementId);
    if (!handover) return res.status(404).json({ error: 'Settlement record not found.' });
    if (handover.status === 'VERIFIED') return res.status(400).json({ error: 'Settlement is already verified.' });

    const verifiedAt = new Date().toISOString();
    db.prepare(`
      UPDATE cash_handovers 
      SET status = 'VERIFIED', admin_id = ?, verified_at = ?
      WHERE id = ?
    `).run(req.user.id, verifiedAt, settlementId);

    // Audit log
    logAudit(req.user.id, 'VERIFY_SETTLEMENT', 'SETTLEMENT', settlementId,
      { status: 'PENDING_VERIFICATION' },
      { status: 'VERIFIED', verified_by: req.user.id, verified_at: verifiedAt }
    );

    res.json({ message: 'Cash handover successfully verified and locked.' });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed.' });
  }
});


// ==========================================
// 7. ADMIN DASHBOARD & ANALYTICS ENDPOINTS
// ==========================================

// Analytics dashboard totals
app.get('/api/admin/dashboard-summary', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.json({ totalReceipts: 0, totalExpected: 0, paid: 0, pending: 0, cash: 0, online: 0 });
    }

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_receipts,
        COALESCE(SUM(amount), 0) as total_expected,
        COALESCE(SUM(CASE WHEN status='PAID' THEN amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status='PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status='PAID' AND payment_mode='CASH' THEN amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN status='PAID' AND payment_mode='ONLINE' THEN amount ELSE 0 END), 0) as online_amount
      FROM receipts
      WHERE year_id = ? AND status != 'CANCELLED'
    `).get(activeYearRow.id);

    res.json({
      totalReceipts: summary.total_receipts,
      totalExpected: summary.total_expected,
      paid: summary.paid_amount,
      pending: summary.pending_amount,
      cash: summary.cash_amount,
      online: summary.online_amount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compile dashboard summary.' });
  }
});

// Daily Collections Breakdown
app.get('/api/admin/daily-collection', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) return res.json([]);

    const list = db.prepare(`
      SELECT date(r.created_at) as date, w.name as worker_name,
             COUNT(*) as receipts_count,
             COALESCE(SUM(CASE WHEN r.status='PAID' THEN r.amount ELSE 0 END), 0) as paid_amount,
             COALESCE(SUM(CASE WHEN r.status='PENDING' THEN r.amount ELSE 0 END), 0) as pending_amount
      FROM receipts r
      JOIN users w ON r.created_by = w.id
      WHERE r.year_id = ? AND r.status != 'CANCELLED'
      GROUP BY date(r.created_at), w.id
      ORDER BY date DESC, paid_amount DESC
    `).all(activeYearRow.id);

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load daily collection analytics.' });
  }
});

// Worker Performance Breakdown
app.get('/api/admin/worker-performance', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) return res.json([]);

    const performance = db.prepare(`
      SELECT w.name, 
             COUNT(r.id) as receipts_created,
             COALESCE(SUM(CASE WHEN r.status='PAID' THEN r.amount ELSE 0 END), 0) as paid_amount,
             COALESCE(SUM(CASE WHEN r.status='PENDING' THEN r.amount ELSE 0 END), 0) as pending_amount,
             COALESCE(SUM(CASE WHEN r.status='PAID' AND r.payment_mode='CASH' THEN r.amount ELSE 0 END), 0) as cash_amount,
             COALESCE(SUM(CASE WHEN r.status='PAID' AND r.payment_mode='ONLINE' THEN r.amount ELSE 0 END), 0) as online_amount,
             SUM(CASE WHEN r.status='PENDING' THEN 1 ELSE 0 END) as pending_receipts_count
      FROM users w
      LEFT JOIN receipts r ON r.created_by = w.id AND r.year_id = ? AND r.status != 'CANCELLED'
      WHERE w.role = 'WORKER' AND w.status = 'APPROVED'
      GROUP BY w.id
      ORDER BY paid_amount DESC
    `).all(activeYearRow.id);

    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load worker performance.' });
  }
});

// Admin Master Receipts list (Server side filters and pagination)
app.get('/api/admin/master-receipts', authenticate, authorize(['ADMIN']), (req, res) => {
  const { lineId, buildingId, status, paymentMode, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) return res.json({ receipts: [], total: 0 });

    let sqlWhere = 'WHERE r.year_id = ?';
    const params = [activeYearRow.id];

    if (lineId) {
      sqlWhere += ' AND r.line_id = ?';
      params.push(lineId);
    }
    if (req.query.buildingName) {
      sqlWhere += ' AND r.building_name LIKE ?';
      params.push(`%${req.query.buildingName}%`);
    }
    if (status) {
      sqlWhere += ' AND r.status = ?';
      params.push(status);
    }
    if (paymentMode) {
      sqlWhere += ' AND r.payment_mode = ?';
      params.push(paymentMode);
    }
    if (search) {
      sqlWhere += ' AND (r.donor_name LIKE ? OR r.donor_mobile LIKE ? OR r.receipt_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get Total Count
    const totalRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM receipts r
      ${sqlWhere}
    `).get(...params);

    // Get Data
    const dataParams = [...params, parseInt(limit), offset];
    const receipts = db.prepare(`
      SELECT r.id, r.global_receipt_id, r.receipt_number, r.flat_number, r.donor_name, r.donor_mobile,
             r.amount, r.payment_mode, r.status, r.created_at, r.paid_at, r.secure_token, r.cancellation_reason,
             l.name as line_name, r.building_name,
             u_c.name as creator_name, u_p.name as collector_name, u_can.name as canceller_name
      FROM receipts r
      JOIN lines_areas l ON r.line_id = l.id
      LEFT JOIN users u_c ON r.created_by = u_c.id
      LEFT JOIN users u_p ON r.paid_by = u_p.id
      LEFT JOIN users u_can ON r.cancelled_by = u_can.id
      ${sqlWhere}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...dataParams);

    res.json({
      receipts,
      total: totalRow.count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve master receipts.' });
  }
});


// ==========================================
// 8. AUDIT LOGS ENDPOINT
// ==========================================
app.get('/api/admin/audit-logs', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.id, a.action, a.target_type, a.target_id, a.old_value, a.new_value, a.timestamp,
             u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 200
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit log trail.' });
  }
});


// ==========================================
// 9. ANNOUNCEMENTS ENDPOINTS
// ==========================================

// Post Announcement
app.post('/api/admin/announcements', authenticate, authorize(['ADMIN']), (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Announcement message cannot be empty.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO announcements (admin_id, message) VALUES (?, ?)');
    const result = stmt.run(req.user.id, message);

    logAudit(req.user.id, 'CREATE_ANNOUNCEMENT', 'ANNOUNCEMENT', result.lastInsertRowid, null, { message });

    res.status(201).json({ message: 'Announcement broadcasted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
});

// View Announcements
app.get('/api/announcements', authenticate, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT a.id, a.message, a.created_at, u.name as admin_name 
      FROM announcements a
      JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});


// ==========================================
// 9.5. DATABASE BACKUPS
// ==========================================
let lastBackupTime = null;
let lastBackupStatus = 'NO_BACKUP_YET';

// Get backup status
app.get('/api/admin/backup/status', authenticate, authorize(['ADMIN']), (req, res) => {
  res.json({
    lastBackup: lastBackupTime ? new Date(lastBackupTime).toLocaleString() : 'Never',
    status: lastBackupStatus
  });
});

// Run local file-system backup (copy database_v2.sqlite)
app.post('/api/api/admin/backup/run', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const srcPath = path.resolve(__dirname, '../database_v2.sqlite');
    const destPath = path.resolve(__dirname, '../database_v2.backup.sqlite');
    
    // Copy file
    fs.copyFileSync(srcPath, destPath);
    
    lastBackupTime = new Date().toISOString();
    lastBackupStatus = 'SUCCESS';
    
    logAudit(req.user.id, 'DATABASE_BACKUP', 'SYSTEM', 1, null, 'Database backup file copied successfully to database_v2.backup.sqlite');
    
    res.json({ message: 'Backup created successfully on the server.' });
  } catch (error) {
    console.error('Backup failed:', error);
    lastBackupStatus = 'FAILED';
    res.status(500).json({ error: 'Failed to copy database file. Check disk permissions.' });
  }
});

// Download database_v2.sqlite directly
app.get('/api/admin/backup/download', authenticate, authorize(['ADMIN']), (req, res) => {
  try {
    const dbFilePath = path.resolve(__dirname, '../database_v2.sqlite');
    res.download(dbFilePath, `mandal_db_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download database file.' });
  }
});

// Reset System / Clear Demo Data (danger zone)
app.post('/api/admin/reset-system', authenticate, authorize(['ADMIN']), (req, res) => {
  const adminId = req.user.id;
  
  db.exec('BEGIN TRANSACTION');
  try {
    // 1. Delete all cash handovers
    db.prepare('DELETE FROM cash_handovers').run();
    // 2. Delete all receipts
    db.prepare('DELETE FROM receipts').run();
    // 3. Delete all receipt counters
    db.prepare('DELETE FROM receipt_counters').run();
    // 4. Delete all buildings
    db.prepare('DELETE FROM buildings').run();
    // 5. Delete all lines/areas
    db.prepare('DELETE FROM lines_areas').run();
    // 6. Delete all announcements
    db.prepare('DELETE FROM announcements').run();
    // 7. Delete all notifications
    db.prepare('DELETE FROM notifications').run();
    
    // 8. Delete all users who are NOT the current admin!
    db.prepare('DELETE FROM users WHERE id != ?').run(adminId);
    
    // 9. Reset admin user assigned line just in case
    db.prepare('UPDATE users SET assigned_line_id = NULL').run();
    
    // 10. Reset counter values in sqlite_sequence
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('cash_handovers', 'receipts', 'receipt_counters', 'buildings', 'lines_areas', 'announcements', 'notifications')").run();
    
    db.exec('COMMIT');
    
    logAudit(adminId, 'SYSTEM_RESET', 'SYSTEM', null, null, { message: 'All demo data cleared successfully.' });
    
    res.json({ message: 'All demo data and mock records cleared successfully. System is now ready for production.' });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('System reset failed:', error);
    res.status(500).json({ error: 'Failed to reset system database. ' + error.message });
  }
});


// ==========================================
// 10. SYSTEM SETTINGS
// ==========================================

// Load public & auth settings configuration
app.get('/api/settings/config', (req, res) => {
  try {
    const activeYearRow = db.prepare("SELECT id, year FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) {
      return res.json({
        year: 2026,
        mandal_name: 'Ganesh Mandal',
        mandal_address: '',
        mandal_contact: ''
      });
    }

    const config = db.prepare('SELECT * FROM settings WHERE year_id = ?').get(activeYearRow.id);
    res.json({
      ...config,
      year: activeYearRow.year,
      year_id: activeYearRow.id
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve settings config.' });
  }
});

// Update Settings
app.post('/api/settings/update', authenticate, authorize(['ADMIN']), (req, res) => {
  const { mandalName, mandalLogo, mandalAddress, mandalContact, receiptFooter, termsConditions, closeDailyCollectionDate } = req.body;

  try {
    const activeYearRow = db.prepare("SELECT id FROM festival_years WHERE status = 'ACTIVE'").get();
    if (!activeYearRow) return res.status(400).json({ error: 'No active year found.' });

    const existing = db.prepare('SELECT * FROM settings WHERE year_id = ?').get(activeYearRow.id);

    if (!existing) {
      db.prepare(`
        INSERT INTO settings (year_id, mandal_name, mandal_logo, mandal_address, mandal_contact, receipt_footer, terms_conditions, close_daily_collection_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        activeYearRow.id,
        mandalName || 'Ganesh Mandal',
        mandalLogo || null,
        mandalAddress || '',
        mandalContact || '',
        receiptFooter || '',
        termsConditions || '',
        closeDailyCollectionDate || null
      );
    } else {
      db.prepare(`
        UPDATE settings 
        SET mandal_name = ?, mandal_logo = COALESCE(?, mandal_logo), mandal_address = ?, mandal_contact = ?, 
            receipt_footer = ?, terms_conditions = ?, close_daily_collection_date = ?
        WHERE year_id = ?
      `).run(
        mandalName || existing.mandal_name,
        mandalLogo || null,
        mandalAddress || existing.mandal_address,
        mandalContact || existing.mandal_contact,
        receiptFooter || existing.receipt_footer,
        termsConditions || existing.terms_conditions,
        closeDailyCollectionDate || null,
        activeYearRow.id
      );
    }

    logAudit(req.user.id, 'UPDATE_SETTINGS', 'SETTINGS', activeYearRow.id, existing, req.body);

    res.json({ message: 'System configurations updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save system settings.' });
  }
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend assets in production
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback to index.html for React routing on non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running securely on http://localhost:${PORT}`);
});
