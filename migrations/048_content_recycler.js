// migrations/048_content_recycler.js
// Adds content recycler columns to posts and salons tables.
//
// posts:
//   - block_from_recycle: manager can exclude individual posts from being recycled
//   - recycled_from_id: FK to the original post this was cloned from
//
// salons:
//   - auto_recycle: enables the auto-recycle engine for the salon
//   - caption_refresh_on_recycle: when 1, AI rewrites the caption on recycle (Growth/Pro only)

export function run(db) {
  const postCols = db.prepare(`PRAGMA table_info(posts)`).all().map(c => c.name);
  const salonCols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);

  if (!postCols.includes('block_from_recycle')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN block_from_recycle INTEGER DEFAULT 0`).run();
  }

  if (!postCols.includes('recycled_from_id')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN recycled_from_id TEXT`).run();
  }

  if (!salonCols.includes('auto_recycle')) {
    db.prepare(`ALTER TABLE salons ADD COLUMN auto_recycle INTEGER DEFAULT 0`).run();
  }

  if (!salonCols.includes('caption_refresh_on_recycle')) {
    db.prepare(`ALTER TABLE salons ADD COLUMN caption_refresh_on_recycle INTEGER DEFAULT 0`).run();
  }

  console.log('[Migration 048] content_recycler: added block_from_recycle, recycled_from_id to posts; auto_recycle, caption_refresh_on_recycle to salons');
}
