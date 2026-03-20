// migrations/049_coordinator_submitted_by.js
// Adds submitted_by column to the posts table.
//
// posts:
//   - submitted_by: FK → managers.id — records which coordinator submitted the post
//                   on behalf of a stylist. NULL for all existing and stylist-submitted posts.

export function run(db) {
  const postCols = db.prepare(`PRAGMA table_info(posts)`).all().map(c => c.name);

  if (!postCols.includes('submitted_by')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN submitted_by TEXT REFERENCES managers(id)`).run();
  }

  console.log('[Migration 049] coordinator_submitted_by: added submitted_by to posts');
}
