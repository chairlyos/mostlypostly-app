// migrations/056_vendor_campaigns_dedup.js
//
// Root cause: migration 045 added UNIQUE(vendor_name, campaign_name, release_date)
// as a dedup guard, but SQLite treats NULL != NULL in UNIQUE constraints. CSV-imported
// campaigns have no release_date, so every re-upload of the same CSV bypasses the guard
// and creates duplicate rows — breaking the round-robin alternation logic in vendorScheduler.js.
//
// Fix:
//   1. Remove duplicate campaigns (release_date IS NULL), keeping the oldest per
//      (vendor_name, campaign_name). Cleans up orphaned vendor_post_log rows too.
//   2. Add a partial UNIQUE index covering only release_date IS NULL rows, which
//      INSERT OR IGNORE in the CSV upload route will now correctly respect.

export function run(db) {
  // ── Step 1: Find duplicate campaign IDs to remove ───────────────────────────
  // Window function ranks rows within each (vendor_name, campaign_name) group by
  // created_at ASC. Any row with rank > 1 is a duplicate — delete it.
  const toDelete = db.prepare(`
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY vendor_name, campaign_name
               ORDER BY created_at ASC
             ) AS rn
      FROM vendor_campaigns
      WHERE release_date IS NULL
    )
    WHERE rn > 1
  `).all().map(r => r.id);

  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => "?").join(",");

    // Clean vendor_post_log first (references campaign_id)
    db.prepare(`DELETE FROM vendor_post_log WHERE campaign_id IN (${placeholders})`).run(...toDelete);

    // Clean any posts that reference a duplicate campaign (shouldn't exist, but be safe)
    db.prepare(`DELETE FROM posts WHERE vendor_campaign_id IN (${placeholders})`).run(...toDelete);

    // Delete the duplicates
    db.prepare(`DELETE FROM vendor_campaigns WHERE id IN (${placeholders})`).run(...toDelete);

    console.log(`[Migration 056] Removed ${toDelete.length} duplicate vendor campaign(s): ${toDelete.join(", ")}`);
  } else {
    console.log("[Migration 056] No duplicate vendor campaigns found");
  }

  // ── Step 2: Partial UNIQUE index for release_date IS NULL rows ───────────────
  // INSERT OR IGNORE in the CSV upload route will now skip rows that match an
  // existing (vendor_name, campaign_name) pair with no release_date.
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_dedup_no_release
    ON vendor_campaigns(vendor_name, campaign_name)
    WHERE release_date IS NULL
  `).run();

  console.log("[Migration 056] vendor_campaigns_dedup: partial unique index added");
}
