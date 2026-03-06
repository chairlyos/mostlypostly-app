// migrations/006_brand_palette.js — Add brand_palette column to salons
import { db } from "../db.js";

export function run() {
  const exists = db.prepare(
    `SELECT 1 FROM pragma_table_info('salons') WHERE name = 'brand_palette'`
  ).get();
  if (!exists) {
    db.exec(`ALTER TABLE salons ADD COLUMN brand_palette TEXT;`);
    console.log("[006] Added salons.brand_palette");
  }
}
