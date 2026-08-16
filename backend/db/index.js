import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../database_v2.sqlite');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON');

// Initialize schema
const schemaPath = path.resolve(__dirname, './schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Auto-seed default admin if database is brand new (no users)
try {
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (usersCount === 0) {
    console.log('New database detected. Auto-seeding default Admin account...');
    db.exec('BEGIN TRANSACTION');
    
    // 1. Insert Festival Year 2026
    const yearId = db.prepare("INSERT INTO festival_years (year, status) VALUES (?, ?)").run(2026, 'ACTIVE').lastInsertRowid;
    
    // 2. Insert Default Admin User
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (role, name, mobile, password_hash, status, assigned_line_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('ADMIN', 'President Admin', '9999999999', adminHash, 'APPROVED', null);
    
    // 3. Insert default settings
    db.prepare(`
      INSERT INTO settings (year_id, mandal_name, mandal_address, mandal_contact, receipt_footer, terms_conditions)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      yearId,
      'Shree Siddhivinayak Ganpati Mandal',
      'S.V. Road, Near Ram Mandir, Mumbai - 400050',
      '022-26402324 / 9876543210',
      'गणपती बाप्पा मोरया! मंगलमूर्ती मोरया!',
      'Thank you for your generous contribution. The funds will be utilized for community welfare programs.'
    );

    db.exec('COMMIT');
    console.log('Database auto-seeded successfully!');
  }
} catch (err) {
  if (db.inTransaction) db.exec('ROLLBACK');
  console.error('Database auto-seeding failed:', err);
}

export default db;
