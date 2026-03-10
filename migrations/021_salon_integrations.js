// migrations/021_salon_integrations.js
export function run(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS salon_integrations (
        id              TEXT PRIMARY KEY,
        salon_id        TEXT NOT NULL REFERENCES salons(slug) ON DELETE CASCADE,
        platform        TEXT NOT NULL CHECK(platform IN ('zenoti','vagaro','boulevard','mindbody')),
        api_key         TEXT,
        webhook_secret  TEXT,
        center_id       TEXT,
        sync_enabled    INTEGER NOT NULL DEFAULT 1,
        connected_at    TEXT,
        last_event_at   TEXT,
        UNIQUE(salon_id, platform)
      )
    `);
    console.log("[021] Created salon_integrations table");
  } catch (e) {
    if (!e.message.includes("already exists")) throw e;
  }
}
