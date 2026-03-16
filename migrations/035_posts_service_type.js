// migrations/035_posts_service_type.js
export function run(db) {
  // db.exec is better-sqlite3 API — safe, no user input involved
  db.prepare(`ALTER TABLE posts ADD COLUMN service_type TEXT`).run();
  console.log("[035] Added service_type to posts");
}
