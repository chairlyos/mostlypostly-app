// migrations/026_stylist_welcome.js
// Tracks whether a welcome SMS has been sent to each stylist.

export function run(db) {
  try {
    db.exec(`ALTER TABLE stylists ADD COLUMN welcome_sent_at TEXT`);
  } catch { /* column already exists */ }

  console.log("✅ [Migration 026] stylists.welcome_sent_at added");
}
