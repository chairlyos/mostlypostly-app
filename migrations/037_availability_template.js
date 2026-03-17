// migrations/037_availability_template.js
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(salons)`).all();
  if (cols.some(c => c.name === "availability_template")) return;
  db.prepare(`ALTER TABLE salons ADD COLUMN availability_template TEXT DEFAULT 'script'`).run();
}
