// tests/core/placementRouting.test.js
import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";

import {
  getSystemPlacementRouting,
  mergePlacementRouting,
  resolveContentPlacement,
} from "../../src/core/placementRouting.js";

const DEFAULTS = {
  standard_post: "post", before_after: "reel", education: "reel",
  vendor_product: "story", vendor_promotion: "story", reviews: "post",
  celebration: "post", stylist_availability: "story",
};

// ── mergePlacementRouting ─────────────────────────────────────
describe("mergePlacementRouting", () => {
  it("null salonJson returns system defaults unchanged", () => {
    const result = mergePlacementRouting(DEFAULTS, null);
    expect(result).toEqual(DEFAULTS);
  });

  it("partial salon override only overrides specified keys", () => {
    const result = mergePlacementRouting(DEFAULTS, JSON.stringify({ before_after: "post" }));
    expect(result.before_after).toBe("post");     // overridden
    expect(result.standard_post).toBe("post");    // unchanged
    expect(result.education).toBe("reel");        // unchanged
  });

  it("unknown content_type key in salonJson is ignored", () => {
    const result = mergePlacementRouting(DEFAULTS, JSON.stringify({ unknown_type: "reel" }));
    expect(result).toEqual(DEFAULTS); // no extra keys
    expect(result.unknown_type).toBeUndefined();
  });

  it("malformed salonJson falls back to system defaults", () => {
    const result = mergePlacementRouting(DEFAULTS, "not-json");
    expect(result).toEqual(DEFAULTS);
  });

  it("invalid placement value is ignored (non-string or not reel/story/post)", () => {
    const result = mergePlacementRouting(DEFAULTS, JSON.stringify({ standard_post: "invalid" }));
    // invalid placement should be ignored — keep system default
    expect(result.standard_post).toBe("post");
  });
});

// ── getSystemPlacementRouting ─────────────────────────────────
describe("getSystemPlacementRouting", () => {
  it("returns hardcoded fallback when system_settings table does not exist", () => {
    const emptyDb = new Database(":memory:");
    const result = getSystemPlacementRouting(emptyDb);
    expect(result).toEqual(DEFAULTS);
  });

  it("returns seeded defaults from system_settings", () => {
    const testDb = new Database(":memory:");
    testDb.prepare(`CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`).run();
    testDb.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?)`).run(
      "placement_routing",
      JSON.stringify({ ...DEFAULTS, before_after: "post" })
    );
    const result = getSystemPlacementRouting(testDb);
    expect(result.before_after).toBe("post");
    expect(result.standard_post).toBe("post");
  });

  it("returns hardcoded fallback when row is missing", () => {
    const testDb = new Database(":memory:");
    testDb.prepare(`CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`).run();
    const result = getSystemPlacementRouting(testDb);
    expect(result).toEqual(DEFAULTS);
  });
});

// ── resolveContentPlacement ───────────────────────────────────
describe("resolveContentPlacement", () => {
  let testDb;
  beforeAll(() => {
    testDb = new Database(":memory:");
    testDb.prepare(`CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`).run();
    testDb.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?)`).run(
      "placement_routing", JSON.stringify(DEFAULTS)
    );
  });

  it("returns system default when salon has no override", () => {
    const salon = { placement_routing: null };
    expect(resolveContentPlacement(testDb, salon, "before_after")).toBe("reel");
  });

  it("returns salon override when set", () => {
    const salon = { placement_routing: JSON.stringify({ before_after: "post" }) };
    expect(resolveContentPlacement(testDb, salon, "before_after")).toBe("post");
  });

  it("returns hardcoded fallback for unknown content type", () => {
    const salon = { placement_routing: null };
    expect(resolveContentPlacement(testDb, salon, "unknown_type")).toBe("post"); // DEFAULT fallback
  });
});
