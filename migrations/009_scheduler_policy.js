// migrations/009_scheduler_policy.js
// Adds per-platform daily caps, content priority, and stylist fairness config to salons table.

export function run(db) {
  const cols = [
    "ALTER TABLE salons ADD COLUMN ig_feed_daily_max   INTEGER DEFAULT 5",
    "ALTER TABLE salons ADD COLUMN fb_feed_daily_max   INTEGER DEFAULT 4",
    "ALTER TABLE salons ADD COLUMN tiktok_daily_max    INTEGER DEFAULT 3",
    "ALTER TABLE salons ADD COLUMN fairness_window_min INTEGER DEFAULT 180",
    "ALTER TABLE salons ADD COLUMN content_priority    TEXT",
    "ALTER TABLE salons ADD COLUMN content_mix         TEXT",
  ];
  for (const sql of cols) {
    try {
      db.exec(sql);
    } catch (err) {
      if (!err.message.includes("duplicate column")) throw err;
    }
  }
  console.log("✅ [Migration 009] scheduler_policy columns applied");
}
