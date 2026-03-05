// migrations/003_stylist_portal_tokens.js
// Creates the stylist_portal_tokens table for secure temp edit links.

export function run(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS stylist_portal_tokens (
      id         TEXT PRIMARY KEY,
      post_id    TEXT NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `).run();
  console.log("  + stylist_portal_tokens table");
}
