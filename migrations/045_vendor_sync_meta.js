// migrations/045_vendor_sync_meta.js
// Adds vendor sync tracking columns to vendor_campaigns and vendor_brands.
// Also adds UNIQUE index for dedup on (vendor_name, campaign_name, release_date).
export function run(db) {
  // --- vendor_campaigns ---
  const campaignCols = db.prepare(`PRAGMA table_info(vendor_campaigns)`).all().map(c => c.name);

  if (!campaignCols.includes('release_date'))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN release_date TEXT`).run();

  if (!campaignCols.includes('caption_body'))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN caption_body TEXT`).run();

  if (!campaignCols.includes('source'))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN source TEXT DEFAULT 'manual'`).run();

  // Dedup index — IF NOT EXISTS makes this safe to re-run
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_dedup
    ON vendor_campaigns(vendor_name, campaign_name, release_date)
  `).run();

  // --- vendor_brands ---
  const brandCols = db.prepare(`PRAGMA table_info(vendor_brands)`).all().map(c => c.name);

  if (!brandCols.includes('last_sync_at'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN last_sync_at TEXT`).run();

  if (!brandCols.includes('last_sync_count'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN last_sync_count INTEGER DEFAULT 0`).run();

  if (!brandCols.includes('last_sync_error'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN last_sync_error TEXT`).run();

  if (!brandCols.includes('product_value'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN product_value INTEGER DEFAULT 45`).run();

  console.log('[Migration 045] vendor_sync_meta: added sync columns');
}
