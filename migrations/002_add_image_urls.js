// migrations/002_add_image_urls.js
// Adds image_urls (JSON array) to posts for multi-image / carousel support.

export function run(db) {
  const exists = db.prepare(`PRAGMA table_info(posts)`).all().some(c => c.name === "image_urls");
  if (!exists) {
    db.prepare(`ALTER TABLE posts ADD COLUMN image_urls TEXT`).run();
    console.log("  + posts.image_urls");
  }
}
