// migrations/047_salon_vendor_frequency_cap.js
// Adds per-salon per-vendor frequency cap to salon_vendor_feeds.
// NULL = use campaign default (frequency_cap on vendor_campaigns).
// When set, this overrides the campaign default for that salon, bounded by vendor_brands.platform_max_cap.
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(salon_vendor_feeds)`).all().map(c => c.name);

  if (!cols.includes('frequency_cap'))
    db.prepare(`ALTER TABLE salon_vendor_feeds ADD COLUMN frequency_cap INTEGER`).run();

  console.log('[Migration 047] salon_vendor_frequency_cap: added frequency_cap to salon_vendor_feeds');
}
