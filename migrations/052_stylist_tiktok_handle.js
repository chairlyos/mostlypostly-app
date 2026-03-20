// migrations/052_stylist_tiktok_handle.js
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(stylists)`).all().map(c => c.name);
  if (!cols.includes('tiktok_handle')) {
    db.prepare(`ALTER TABLE stylists ADD COLUMN tiktok_handle TEXT`).run();
  }
  console.log('[Migration 052] stylists: added tiktok_handle TEXT');
}
