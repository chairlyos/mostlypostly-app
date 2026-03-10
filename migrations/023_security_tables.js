// migrations/023_security_tables.js
// Adds security_events audit log and manager_mfa tables.
export function run(db) {
  // Audit log — every security-relevant event
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
      id          TEXT PRIMARY KEY,
      salon_id    TEXT,
      manager_id  TEXT,
      event_type  TEXT NOT NULL,
      ip_address  TEXT,
      user_agent  TEXT,
      metadata    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // MFA enrollment per manager
  db.exec(`
    CREATE TABLE IF NOT EXISTS manager_mfa (
      manager_id    TEXT PRIMARY KEY REFERENCES managers(id) ON DELETE CASCADE,
      totp_secret   TEXT NOT NULL,
      backup_codes  TEXT NOT NULL DEFAULT '[]',
      enabled_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Index for fast security event queries
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_manager ON security_events(manager_id, created_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_salon ON security_events(salon_id, created_at DESC)`);
  } catch (_) {}

  console.log("[023] Created security_events + manager_mfa tables");
}
