import db from '../db/index.js';

/**
 * Log an event to the audit_logs table.
 * @param {number|null} userId - The user ID performing the action
 * @param {string} action - Action name (e.g., 'CREATE_RECEIPT', 'UPDATE_STATUS')
 * @param {string} targetType - The table name or entity type (e.g., 'RECEIPT', 'USER')
 * @param {number|null} targetId - ID of the entity acted on
 * @param {object|string|null} oldValue - Previous state (will be serialized if object)
 * @param {object|string|null} newValue - New state (will be serialized if object)
 */
export function logAudit(userId, action, targetType, targetId = null, oldValue = null, newValue = null) {
  try {
    const oldStr = oldValue && typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue;
    const newStr = newValue && typeof newValue === 'object' ? JSON.stringify(newValue) : newValue;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, target_type, target_id, old_value, new_value, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    
    stmt.run(
      userId || null,
      action,
      targetType,
      targetId || null,
      oldStr || null,
      newStr || null
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
