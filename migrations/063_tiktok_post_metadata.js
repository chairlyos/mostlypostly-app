// migrations/063_tiktok_post_metadata.js
export function run(db) {
  db.prepare(`ALTER TABLE posts ADD COLUMN tiktok_privacy_level TEXT`).run();
  db.prepare(`ALTER TABLE posts ADD COLUMN tiktok_allow_comment INTEGER`).run();
  db.prepare(`ALTER TABLE posts ADD COLUMN tiktok_allow_duet INTEGER`).run();
  db.prepare(`ALTER TABLE posts ADD COLUMN tiktok_allow_stitch INTEGER`).run();
  db.prepare(`ALTER TABLE posts ADD COLUMN tiktok_commercial INTEGER DEFAULT 0`).run();
  console.log("  + posts.tiktok_privacy_level, tiktok_allow_comment, tiktok_allow_duet, tiktok_allow_stitch, tiktok_commercial");
}
