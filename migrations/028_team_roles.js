// migrations/028_team_roles.js
// Adds stylist_id FK to managers (links portal accounts to stylist records)

export function run(db) {
  try {
    db.prepare("ALTER TABLE managers ADD COLUMN stylist_id TEXT REFERENCES stylists(id)").run();
  } catch (_) {}
  console.log("✅ [Migration 028] stylist_id added to managers");
}
