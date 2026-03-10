// migrations/025_gamification.js
// Stylist gamification system — per-salon point values, double-points activation,
// shortage threshold, and a public leaderboard token for breakroom TV display.

export function run(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gamification_settings (
      id                   TEXT PRIMARY KEY,
      salon_id             TEXT NOT NULL UNIQUE,

      -- Point values per post type (NULL = use system default)
      pts_standard_post    INTEGER,
      pts_before_after     INTEGER,
      pts_availability     INTEGER,
      pts_promotions       INTEGER,
      pts_celebration      INTEGER,
      pts_product_education INTEGER,
      pts_vendor_promotion  INTEGER,

      -- Double-points / shortage nudge
      bonus_multiplier     REAL    NOT NULL DEFAULT 1.0,
      bonus_active_until   TEXT,           -- ISO datetime; NULL = no active bonus
      shortage_threshold   INTEGER NOT NULL DEFAULT 5,  -- posts queued next 7 days

      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Public leaderboard token — random UUID, manager-regeneratable
  try {
    db.exec(`ALTER TABLE salons ADD COLUMN leaderboard_token TEXT`);
  } catch { /* column already exists */ }

  console.log("✅ [Migration 025] gamification_settings created, salons.leaderboard_token added");
}
