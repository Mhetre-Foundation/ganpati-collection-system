import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

export default db;
