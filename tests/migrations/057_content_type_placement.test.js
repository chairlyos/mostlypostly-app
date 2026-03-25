import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { run } from "../../migrations/057_content_type_placement.js";

describe("migration 057", () => {
  let db;
  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE posts (
        id TEXT PRIMARY KEY,
        salon_id TEXT,
        post_type TEXT
      );
      CREATE TABLE vendor_campaigns (
        id INTEGER PRIMARY KEY,
        vendor_name TEXT,
        campaign_name TEXT
      );
    `);
  });

  it("adds content_type, placement, placement_overridden to posts", () => {
    run(db);
    const info = db.pragma("table_info(posts)");
    const cols = info.map((c) => c.name);
    expect(cols).toContain("content_type");
    expect(cols).toContain("placement");
    expect(cols).toContain("placement_overridden");
  });

  it("defaults placement_overridden to 0", () => {
    run(db);
    db.exec(`INSERT INTO posts (id, salon_id) VALUES ('p1', 's1')`);
    const row = db.prepare("SELECT placement_overridden FROM posts WHERE id='p1'").get();
    expect(row.placement_overridden).toBe(0);
  });

  it("adds content_type to vendor_campaigns", () => {
    run(db);
    const info = db.pragma("table_info(vendor_campaigns)");
    const cols = info.map((c) => c.name);
    expect(cols).toContain("content_type");
  });

  it("is idempotent on re-run", () => {
    run(db);
    expect(() => run(db)).not.toThrow();
  });
});
