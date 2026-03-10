// migrations/024_vendor_post_log.js
// Tracks vendor campaign posts per salon per month for frequency_cap enforcement.
// Also adds vendor_campaign_id to posts table for traceability.

export function run(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_post_log (
      id              TEXT PRIMARY KEY,
      salon_id        TEXT NOT NULL,
      campaign_id     TEXT NOT NULL,
      post_id         TEXT NOT NULL,
      posted_month    TEXT NOT NULL, -- YYYY-MM — for monthly cap tracking
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_vendor_post_log_salon_campaign_month
    ON vendor_post_log (salon_id, campaign_id, posted_month)`);

  // Add vendor_campaign_id to posts for traceability (ignored if already exists)
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN vendor_campaign_id TEXT`);
  } catch { /* column already exists */ }

  console.log("✅ [Migration 024] vendor_post_log created, posts.vendor_campaign_id added");
}
