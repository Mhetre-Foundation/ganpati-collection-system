-- Database Schema for Ganpati Mandal Collection & Receipt Management System

PRAGMA foreign_keys = ON;

-- 1. Festival Years
CREATE TABLE IF NOT EXISTS festival_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'LOCKED')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Admin and Workers)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'WORKER')),
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL, -- Serves as Login ID for both. For Workers, it's their mobile number.
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISABLED')) DEFAULT 'PENDING_APPROVAL',
    assigned_line_id INTEGER, -- Optional assignment to a line
    profile_photo TEXT, -- Path/Base64 of profile photo
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assigned_line_id) REFERENCES lines_areas(id) ON DELETE SET NULL
);

-- 3. Lines / Areas / Colonies
CREATE TABLE IF NOT EXISTS lines_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL, -- e.g., 'SR' for Shri Ram Colony
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(year_id) REFERENCES festival_years(id) ON DELETE CASCADE,
    UNIQUE(year_id, name),
    UNIQUE(year_id, prefix)
);

-- 4. Buildings (Nested under Lines/Areas)
CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(line_id) REFERENCES lines_areas(id) ON DELETE CASCADE,
    UNIQUE(line_id, name)
);

-- 5. Receipts
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    global_receipt_id TEXT UNIQUE NOT NULL, -- e.g., REC-2026-00001
    receipt_number TEXT NOT NULL, -- e.g., SR-027 (Serial per line per year)
    year_id INTEGER NOT NULL,
    line_id INTEGER NOT NULL,
    building_name TEXT, -- Optional (typed directly by worker)
    flat_number TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    donor_mobile TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'ONLINE', 'PENDING')),
    status TEXT NOT NULL CHECK(status IN ('PAID', 'PENDING', 'CANCELLED')) DEFAULT 'PENDING',
    created_by INTEGER NOT NULL, -- Worker who generated receipt
    paid_by INTEGER, -- Worker who collected the payment (can be different from creator)
    created_at DATETIME NOT NULL,
    paid_at DATETIME, -- When it was paid
    secure_token TEXT UNIQUE NOT NULL, -- Public random token (e.g. UUID)
    cancellation_reason TEXT,
    cancelled_by INTEGER,
    cancelled_at DATETIME,
    FOREIGN KEY(year_id) REFERENCES festival_years(id),
    FOREIGN KEY(line_id) REFERENCES lines_areas(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(paid_by) REFERENCES users(id),
    FOREIGN KEY(cancelled_by) REFERENCES users(id),
    UNIQUE(year_id, line_id, receipt_number) -- Prevent duplicate receipt numbers within the same line & year
);

-- 6. Receipt Counters (For atomic serial numbering per Line/Year)
CREATE TABLE IF NOT EXISTS receipt_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id INTEGER NOT NULL,
    line_id INTEGER NOT NULL,
    current_val INTEGER DEFAULT 0 NOT NULL,
    FOREIGN KEY(year_id) REFERENCES festival_years(id) ON DELETE CASCADE,
    FOREIGN KEY(line_id) REFERENCES lines_areas(id) ON DELETE CASCADE,
    UNIQUE(year_id, line_id)
);

-- 7. Audit Logs (Immutable history)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Action performer
    action TEXT NOT NULL, -- e.g., 'CREATE_RECEIPT', 'UPDATE_RECEIPT_STATUS', 'CANCEL_RECEIPT', 'USER_APPROVED', 'SETTINGS_CHANGED'
    target_type TEXT NOT NULL, -- e.g., 'RECEIPT', 'USER', 'SETTINGS', 'SETTLEMENT'
    target_id INTEGER,
    old_value TEXT, -- JSON representation or plain description
    new_value TEXT, -- JSON representation or plain description
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Cash Handovers / settlements
CREATE TABLE IF NOT EXISTS cash_handovers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    admin_id INTEGER, -- Admin who verifies
    year_id INTEGER NOT NULL,
    expected_amount REAL NOT NULL,
    submitted_amount REAL NOT NULL,
    difference REAL NOT NULL,
    explanation TEXT,
    status TEXT NOT NULL CHECK(status IN ('PENDING_VERIFICATION', 'VERIFIED')) DEFAULT 'PENDING_VERIFICATION',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    FOREIGN KEY(worker_id) REFERENCES users(id),
    FOREIGN KEY(admin_id) REFERENCES users(id),
    FOREIGN KEY(year_id) REFERENCES festival_years(id)
);

-- 9. Announcements (By Admin to all Workers)
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Notifications (System alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, -- Recipient
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. Mandal Settings (Configurations)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_id INTEGER UNIQUE NOT NULL,
    mandal_name TEXT NOT NULL DEFAULT 'Ganesh Mandal',
    mandal_logo TEXT, -- Base64 or filename
    mandal_address TEXT NOT NULL DEFAULT '',
    mandal_contact TEXT NOT NULL DEFAULT '',
    receipt_footer TEXT DEFAULT '',
    sms_gateway_url TEXT,
    whatsapp_gateway_url TEXT,
    terms_conditions TEXT,
    close_daily_collection_date TEXT, -- YYYY-MM-DD up to which editing is locked
    FOREIGN KEY(year_id) REFERENCES festival_years(id) ON DELETE CASCADE
);

-- Indices for rapid lookup performance
CREATE INDEX IF NOT EXISTS idx_receipts_donor_mobile ON receipts(donor_mobile);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_secure_token ON receipts(secure_token);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_year_id ON receipts(year_id);
CREATE INDEX IF NOT EXISTS idx_receipts_line_id ON receipts(line_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
