// migrations/010_stylist_profiles.js
// Adds extended stylist profile fields: split name, tone variant, birthday,
// hire date (anniversary), bio, profile URL, and celebrations toggle.

export function run(db) {
  const cols = [
    ["first_name",          "TEXT"],
    ["last_name",           "TEXT"],
    ["tone_variant",        "TEXT"],
    ["birthday_mmdd",       "TEXT"],   // MM-DD  e.g. "03-15"
    ["hire_date",           "TEXT"],   // YYYY-MM-DD for anniversary calc
    ["bio",                 "TEXT"],
    ["profile_url",         "TEXT"],   // link to stylist page on salon site
    ["celebrations_enabled","INTEGER DEFAULT 1"],
  ];

  for (const [col, def] of cols) {
    try {
      db.exec(`ALTER TABLE stylists ADD COLUMN ${col} ${def}`);
      console.log(`[010] Added stylists.${col}`);
    } catch (err) {
      if (!err.message.includes("duplicate column")) throw err;
    }
  }

  // Back-fill first_name / last_name from existing name column where possible
  db.prepare(`
    UPDATE stylists
    SET
      first_name = TRIM(SUBSTR(name, 1, INSTR(name || ' ', ' ') - 1)),
      last_name  = TRIM(SUBSTR(name, INSTR(name || ' ', ' ') + 1))
    WHERE first_name IS NULL AND name IS NOT NULL AND name != ''
  `).run();

  console.log("✅ [Migration 010] stylist_profiles columns applied");
}
