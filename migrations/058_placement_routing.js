// migrations/058_placement_routing.js
// Adds:
//   system_settings table — key/value store for console-level config
//   salons.placement_routing TEXT — per-salon content_type→placement overrides
//
// system_settings is seeded with the canonical placement defaults (mirrors
// DEFAULT_PLACEMENT in src/core/contentType.js — keep in sync manually).

export function run(db) {
  // ── system_settings table ─────────────────────────────────────
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`
  ).all();

  if (tables.length === 0) {
    db.prepare(`
      CREATE TABLE system_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TEXT
      )
    `).run();
  }

  // Seed placement_routing defaults (only if row doesn't exist)
  const existing = db.prepare(
    `SELECT key FROM system_settings WHERE key = 'placement_routing'`
  ).get();

  if (!existing) {
    const defaults = {
      standard_post:        "post",
      before_after:         "reel",
      education:            "reel",
      vendor_product:       "story",
      vendor_promotion:     "story",
      reviews:              "post",
      celebration:          "post",
      stylist_availability: "story",
    };
    db.prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`
    ).run("placement_routing", JSON.stringify(defaults), new Date().toISOString());
  }

  // ── salons.placement_routing column ──────────────────────────
  const salonCols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);
  if (!salonCols.includes("placement_routing")) {
    db.prepare(`ALTER TABLE salons ADD COLUMN placement_routing TEXT`).run();
  }

  console.log("[Migration 058] placement_routing: system_settings table + salons.placement_routing added");
}
