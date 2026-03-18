// migrations/040_vendor_brands.js
export function run(db) {
  // vendor_brands — one row per brand, source of truth for brand-level config
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vendor_brands (
      vendor_name          TEXT PRIMARY KEY,
      brand_hashtags       TEXT DEFAULT '[]',
      categories           TEXT DEFAULT '[]',
      allow_client_renewal INTEGER DEFAULT 1,
      created_at           TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Back-fill one row per distinct vendor_name already in vendor_campaigns
  const existing = db.prepare(`SELECT DISTINCT vendor_name FROM vendor_campaigns`).all();
  const upsert = db.prepare(`INSERT OR IGNORE INTO vendor_brands (vendor_name) VALUES (?)`);
  for (const { vendor_name } of existing) {
    upsert.run(vendor_name);
  }

  // Add category + product_hashtag to vendor_campaigns (idempotent)
  const campaignCols = db.prepare(`PRAGMA table_info(vendor_campaigns)`).all().map(c => c.name);
  if (!campaignCols.includes("category"))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN category TEXT`).run();
  if (!campaignCols.includes("product_hashtag"))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN product_hashtag TEXT`).run();

  // Add affiliate_url + category_filters to salon_vendor_feeds (idempotent)
  const feedCols = db.prepare(`PRAGMA table_info(salon_vendor_feeds)`).all().map(c => c.name);
  if (!feedCols.includes("affiliate_url"))
    db.prepare(`ALTER TABLE salon_vendor_feeds ADD COLUMN affiliate_url TEXT`).run();
  if (!feedCols.includes("category_filters"))
    db.prepare(`ALTER TABLE salon_vendor_feeds ADD COLUMN category_filters TEXT DEFAULT '[]'`).run();

  console.log("[Migration 040] vendor_brands created, vendor_campaigns + salon_vendor_feeds updated");
}
