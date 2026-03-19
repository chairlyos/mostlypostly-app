// migrations/043_utm_tracking.js
// utm_clicks table for tracking booking link clicks from social posts
// Also adds avg_ticket_value to salons and product_value to vendor_brands

export function run(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS utm_clicks (
      id           TEXT PRIMARY KEY,
      token        TEXT NOT NULL UNIQUE,
      salon_id     TEXT NOT NULL,
      post_id      TEXT,
      click_type   TEXT NOT NULL,
      vendor_name  TEXT,
      utm_content  TEXT,
      utm_term     TEXT,
      destination  TEXT NOT NULL,
      clicked_at   TEXT,
      ip_hash      TEXT,
      created_at   TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_utm_clicks_salon ON utm_clicks(salon_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_utm_clicks_token ON utm_clicks(token)
  `).run();

  const salonCols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);
  if (!salonCols.includes("avg_ticket_value")) {
    db.prepare(`ALTER TABLE salons ADD COLUMN avg_ticket_value INTEGER DEFAULT 95`).run();
  }

  const brandCols = db.prepare(`PRAGMA table_info(vendor_brands)`).all().map(c => c.name);
  if (!brandCols.includes("product_value")) {
    db.prepare(`ALTER TABLE vendor_brands ADD COLUMN product_value INTEGER DEFAULT 45`).run();
  }

  console.log("[Migration 043] utm_clicks table, indexes, avg_ticket_value, product_value applied");
}
