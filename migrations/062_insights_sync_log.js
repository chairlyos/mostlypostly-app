// migrations/062_insights_sync_log.js
export function run(db) {
  db.prepare(`ALTER TABLE salons ADD COLUMN last_sync_at TEXT`).run();
  db.prepare(`ALTER TABLE salons ADD COLUMN last_sync_result TEXT`).run();
  console.log("  + salons.last_sync_at, last_sync_result");
}
