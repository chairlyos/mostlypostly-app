// migrations/033_celebration_styles.js
export function run(db) {
  db.exec(`ALTER TABLE salons ADD COLUMN celebration_font_styles TEXT DEFAULT '["script"]';`);
  db.exec(`ALTER TABLE salons ADD COLUMN celebration_font_index INTEGER DEFAULT 0;`);
  console.log("[033] Added celebration_font_styles and celebration_font_index to salons");
}
