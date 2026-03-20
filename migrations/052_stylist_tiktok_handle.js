// migrations/052_stylist_tiktok_handle.js
// Adds tiktok_handle column to stylists table.
//
// stylists:
//   - tiktok_handle: TEXT — TikTok @username for the stylist (optional)

export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(stylists)`).all().map(c => c.name);
  if (!cols.includes('tiktok_handle')) {
    db.prepare(`ALTER TABLE stylists ADD COLUMN tiktok_handle TEXT`).run();
  }
  console.log('[Migration 052] stylists: added tiktok_handle TEXT');
}
