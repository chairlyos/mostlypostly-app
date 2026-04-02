// migrations/060_vendor_starts_at.js
// Adds starts_at column to vendor_campaigns.
// NULL = active immediately (no change to existing rows).

export function run(db) {
  const cols = db.pragma("table_info(vendor_campaigns)").map((c) => c.name);
  if (!cols.includes("starts_at")) {
    db.exec(`ALTER TABLE vendor_campaigns ADD COLUMN starts_at TEXT`);
    console.log("[Migration 060] Added starts_at to vendor_campaigns");
  } else {
    console.log("[Migration 060] starts_at already exists, skipping");
  }
}
