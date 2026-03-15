// migrations/031_platform_issues.js
// Tracks issues flagged by stylists via SMS (e.g. "WRONG" reply to no-availability message).
// Visible in the Platform Console so MostlyPostly staff can investigate and inform managers.
export function run(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_issues (
      id          TEXT PRIMARY KEY,
      salon_id    TEXT NOT NULL,
      stylist_id  TEXT,
      stylist_name TEXT,
      stylist_phone TEXT,
      issue_type  TEXT NOT NULL DEFAULT 'availability_incorrect',
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TEXT NOT NULL,
      resolved_at TEXT,
      notes       TEXT
    )
  `);
  console.log("[031] Created platform_issues table");
}
