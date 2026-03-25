// tests/migrations/058_placement_routing.test.js
import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { run } from "../../migrations/058_placement_routing.js";

let db;
beforeAll(() => {
  db = new Database(":memory:");
  // create salons stub so ALTER TABLE works
  db.prepare(`CREATE TABLE IF NOT EXISTS salons (slug TEXT PRIMARY KEY, name TEXT)`).run();
  run(db);
});

describe("migration 058", () => {
  it("creates system_settings table", () => {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`).all();
    expect(tables.length).toBe(1);
  });
  it("seeds placement_routing row in system_settings", () => {
    const row = db.prepare(`SELECT value FROM system_settings WHERE key='placement_routing'`).get();
    expect(row).toBeDefined();
    const parsed = JSON.parse(row.value);
    expect(parsed.standard_post).toBe("post");
    expect(parsed.before_after).toBe("reel");
    expect(parsed.education).toBe("reel");
    expect(parsed.vendor_product).toBe("story");
    expect(parsed.vendor_promotion).toBe("story");
    expect(parsed.reviews).toBe("post");
    expect(parsed.celebration).toBe("post");
    expect(parsed.stylist_availability).toBe("story");
  });
  it("adds placement_routing column to salons", () => {
    const cols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);
    expect(cols).toContain("placement_routing");
  });
  it("is idempotent — running twice does not throw", () => {
    expect(() => run(db)).not.toThrow();
  });
});
