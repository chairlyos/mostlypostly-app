// migrations/004_post_types.js
// Adds post classification columns, stylist profile photo, music genre,
// and salon/stylist stock photos table.

import { db } from "../db.js";

export function run() {
  // posts — post type + promotion expiry
  for (const [col, def] of [
    ["post_type",             "TEXT DEFAULT 'standard_post'"],
    ["promotion_expires_at",  "TEXT"],
    ["platform_targets",      "TEXT"],  // ensure exists (may already be there)
  ]) {
    const exists = db.prepare(
      `SELECT 1 FROM pragma_table_info('posts') WHERE name = ?`
    ).get(col);
    if (!exists) {
      db.exec(`ALTER TABLE posts ADD COLUMN ${col} ${def};`);
      console.log(`[004] Added posts.${col}`);
    }
  }

  // stylists — stock photo + music preference
  for (const [col, def] of [
    ["photo_url",             "TEXT"],
    ["preferred_music_genre", "TEXT"],
  ]) {
    const exists = db.prepare(
      `SELECT 1 FROM pragma_table_info('stylists') WHERE name = ?`
    ).get(col);
    if (!exists) {
      db.exec(`ALTER TABLE stylists ADD COLUMN ${col} ${def};`);
      console.log(`[004] Added stylists.${col}`);
    }
  }

  // stock_photos — salon-wide and stylist-specific background images
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_photos (
      id          TEXT PRIMARY KEY,
      salon_id    TEXT NOT NULL,
      stylist_id  TEXT,
      label       TEXT,
      url         TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (salon_id)   REFERENCES salons(slug),
      FOREIGN KEY (stylist_id) REFERENCES stylists(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_salon ON stock_photos(salon_id);
    CREATE INDEX IF NOT EXISTS idx_stock_stylist ON stock_photos(stylist_id);
  `);
  console.log("[004] Ensured stock_photos table");
}
