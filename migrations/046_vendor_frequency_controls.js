// migrations/046_vendor_frequency_controls.js
// Adds platform-level frequency control columns to vendor_brands:
// - min_gap_days: minimum days between vendor posts per salon (floor, default 3)
// - platform_max_cap: maximum posts/month per campaign a salon can set (ceiling, default 6)
export function run(db) {
  const brandCols = db.prepare(`PRAGMA table_info(vendor_brands)`).all().map(c => c.name);

  if (!brandCols.includes('min_gap_days'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN min_gap_days INTEGER DEFAULT 3`).run();

  if (!brandCols.includes('platform_max_cap'))
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN platform_max_cap INTEGER DEFAULT 6`).run();

  console.log('[Migration 046] vendor_frequency_controls: added min_gap_days and platform_max_cap to vendor_brands');
}
