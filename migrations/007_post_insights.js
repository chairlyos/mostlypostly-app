// migrations/007_post_insights.js — Post insights cache table
import { db } from "../db.js";

export function run() {
  const tableExists = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='post_insights'`
  ).get();

  if (!tableExists) {
    db.exec(`
      CREATE TABLE post_insights (
        id          TEXT PRIMARY KEY,
        post_id     TEXT NOT NULL,
        salon_id    TEXT NOT NULL,
        platform    TEXT NOT NULL,  -- 'facebook' | 'instagram'
        fetched_at  TEXT NOT NULL DEFAULT (datetime('now','utc')),

        -- reach & visibility
        impressions   INTEGER DEFAULT 0,
        reach         INTEGER DEFAULT 0,

        -- engagement
        likes         INTEGER DEFAULT 0,
        comments      INTEGER DEFAULT 0,
        shares        INTEGER DEFAULT 0,
        saves         INTEGER DEFAULT 0,
        reactions     INTEGER DEFAULT 0,
        engaged_users INTEGER DEFAULT 0,

        -- clicks
        link_clicks   INTEGER DEFAULT 0,
        other_clicks  INTEGER DEFAULT 0,

        -- video
        video_views   INTEGER DEFAULT 0,

        -- computed
        engagement_rate REAL DEFAULT 0,

        UNIQUE(post_id, platform),
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );
    `);
    console.log("[007] Created post_insights table");
  }
}
