# Configurable Content Placement Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Make the content_type → placement defaults (reel/story/post) configurable via the Platform Console with per-salon overrides on the Integrations page.

**Architecture:** A new `system_settings` table holds console-level placement defaults as JSON. `salons.placement_routing TEXT` holds per-salon partial overrides. A new `src/core/placementRouting.js` utility reads and merges these at runtime. The scheduler resolves placement using: manager override → salon default → system default → hardcoded fallback. The Platform Console and Integrations page each get a "Content Placement" table UI.

**Tech Stack:** Node.js/Express ESM, better-sqlite3 (synchronous, no await), Vitest, server-rendered HTML + Tailwind CSS

---

### Task 1: DB Migration 058 — system_settings table + salons.placement_routing column

**Files:**
- Create: `migrations/058_placement_routing.js`
- Modify: `migrations/index.js`

**Context:**
- Migration files follow the exact pattern of `migrations/057_content_type_placement.js` — use `db.pragma("table_info(...)")` for idempotency guards
- `migrations/index.js` imports each migration and calls them in `runMigrations()`. Add at the bottom.
- The `system_settings` table stores arbitrary key/value config. We seed it with the placement routing defaults immediately.

**Step 1: Write the failing test**

```js
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
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app
npx vitest run tests/migrations/058_placement_routing.test.js
```
Expected: FAIL — module not found

**Step 3: Create the migration file**

```js
// migrations/058_placement_routing.js
// Adds:
//   system_settings table — key/value store for console-level config
//   salons.placement_routing TEXT — per-salon content_type→placement overrides
//
// system_settings is seeded with the canonical placement defaults (mirrors
// DEFAULT_PLACEMENT in src/core/contentType.js — keep in sync manually).

export function run(db) {
  // ── system_settings table ─────────────────────────────────────
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`
  ).all();

  if (tables.length === 0) {
    db.prepare(`
      CREATE TABLE system_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TEXT
      )
    `).run();
  }

  // Seed placement_routing defaults (only if row doesn't exist)
  const existing = db.prepare(
    `SELECT key FROM system_settings WHERE key = 'placement_routing'`
  ).get();

  if (!existing) {
    const defaults = {
      standard_post:       "post",
      before_after:        "reel",
      education:           "reel",
      vendor_product:      "story",
      vendor_promotion:    "story",
      reviews:             "post",
      celebration:         "post",
      stylist_availability: "story",
    };
    db.prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`
    ).run("placement_routing", JSON.stringify(defaults), new Date().toISOString());
  }

  // ── salons.placement_routing column ──────────────────────────
  const salonCols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);
  if (!salonCols.includes("placement_routing")) {
    db.prepare(`ALTER TABLE salons ADD COLUMN placement_routing TEXT`).run();
  }

  console.log("[Migration 058] placement_routing: system_settings table + salons.placement_routing added");
}
```

**Step 4: Register in migrations/index.js**

At the bottom of `migrations/index.js`, add:
```js
import { run as run058 } from "./058_placement_routing.js";
```
And in the `runMigrations` function array, add `run058` after `run057`.

**Step 5: Run tests**

```bash
npx vitest run tests/migrations/058_placement_routing.test.js
```
Expected: PASS (4 tests)

**Step 6: Run full suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 7: Commit**

```bash
git add migrations/058_placement_routing.js migrations/index.js tests/migrations/058_placement_routing.test.js
git commit -m "feat(placement-routing): migration 058 — system_settings table + salons.placement_routing"
```

---

### Task 2: Core utility — src/core/placementRouting.js

**Files:**
- Create: `src/core/placementRouting.js`
- Create: `tests/core/placementRouting.test.js`

**Context:**
- `DEFAULT_PLACEMENT` is exported from `src/core/contentType.js` — import it as the hardcoded fallback
- `db` is the better-sqlite3 singleton from `db.js` at the project root
- This module must never throw — all JSON parse errors should fall back silently

**Step 1: Write failing tests**

```js
// tests/core/placementRouting.test.js
import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";

// We test the pure functions directly without importing the real db singleton
// by re-implementing the logic under test in a testable form.
// The actual module uses the real db — here we test the merge logic in isolation.

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
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/placementRouting.test.js
```
Expected: FAIL — module not found

**Step 3: Create src/core/placementRouting.js**

```js
// src/core/placementRouting.js
// Configurable content_type → placement routing.
//
// Resolution order for any post:
//   1. post.placement_overridden = 1 → use stored post.placement (manager set it)
//   2. salons.placement_routing[contentType] → salon-level override
//   3. system_settings key='placement_routing' → console-level defaults
//   4. DEFAULT_PLACEMENT from contentType.js → hardcoded fallback

import { DEFAULT_PLACEMENT } from "./contentType.js";
import db from "../../db.js";

const VALID_PLACEMENTS = new Set(["reel", "story", "post"]);

/**
 * Read the system-level placement routing from system_settings.
 * Falls back to DEFAULT_PLACEMENT if the table doesn't exist or the row is missing.
 *
 * @param {import('better-sqlite3').Database} [dbOverride] — optional DB for testing
 * @returns {Object} complete content_type → placement map
 */
export function getSystemPlacementRouting(dbOverride) {
  const database = dbOverride || db;
  try {
    const row = database.prepare(
      `SELECT value FROM system_settings WHERE key = 'placement_routing'`
    ).get();
    if (!row) return { ...DEFAULT_PLACEMENT };
    const parsed = JSON.parse(row.value);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULT_PLACEMENT };
    // Merge with defaults so any missing keys are covered
    return { ...DEFAULT_PLACEMENT, ...Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => VALID_PLACEMENTS.has(v))
    )};
  } catch {
    return { ...DEFAULT_PLACEMENT };
  }
}

/**
 * Overlay a salon's partial placement_routing JSON on top of the system defaults.
 *
 * @param {Object} systemDefaults — result of getSystemPlacementRouting()
 * @param {string|null} salonJson — raw JSON from salons.placement_routing
 * @returns {Object} complete content_type → placement map
 */
export function mergePlacementRouting(systemDefaults, salonJson) {
  if (!salonJson) return systemDefaults;

  let override;
  try {
    override = JSON.parse(salonJson);
  } catch {
    return systemDefaults;
  }

  if (typeof override !== "object" || Array.isArray(override)) return systemDefaults;

  const merged = { ...systemDefaults };
  for (const [contentType, placement] of Object.entries(override)) {
    // Only override known content types with valid placement values
    if (contentType in systemDefaults && VALID_PLACEMENTS.has(placement)) {
      merged[contentType] = placement;
    }
  }
  return merged;
}

/**
 * Single call point for the scheduler and manager approval UI.
 * Returns the resolved placement for a given content type given the salon's config.
 *
 * Does NOT check post.placement_overridden — that is the caller's responsibility.
 *
 * @param {import('better-sqlite3').Database|null} dbOverride — optional DB for testing
 * @param {Object} salon — must include salon.placement_routing (from getSalonPolicy)
 * @param {string} contentType — e.g. "before_after", "standard_post"
 * @returns {"reel"|"story"|"post"}
 */
export function resolveContentPlacement(dbOverride, salon, contentType) {
  const systemDefaults = getSystemPlacementRouting(dbOverride);
  const merged = mergePlacementRouting(systemDefaults, salon?.placement_routing ?? null);
  return merged[contentType] || "post";
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/core/placementRouting.test.js
```
Expected: PASS (all tests)

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 6: Commit**

```bash
git add src/core/placementRouting.js tests/core/placementRouting.test.js
git commit -m "feat(placement-routing): add placementRouting.js core utility"
```

---

### Task 3: Platform Console — Content Placement Defaults section

**Files:**
- Modify: `src/routes/vendorAdmin.js`

**Context:**
- The Platform Console is at `/internal/vendors` — router is in `src/routes/vendorAdmin.js`
- The existing "Set Standard Routing" section is at line ~982 in the GET handler HTML
- Add the new section BEFORE the "Set Standard Routing" section (placement routing is more prominent)
- Two new routes needed: `POST /set-placement-routing` (save to system_settings) — add near line 242 after the existing POST routes
- The GET handler at line ~244 needs to also load the current placement routing from `system_settings`
- Import `resolveContentPlacement`, `getSystemPlacementRouting`, `mergePlacementRouting` from `../core/placementRouting.js`

**Step 1: Add import to vendorAdmin.js**

At the top of `src/routes/vendorAdmin.js`, add alongside the existing platformRouting import:
```js
import { getSystemPlacementRouting } from "../core/placementRouting.js";
```

**Step 2: Add POST /set-placement-routing route**

After the existing `router.post("/set-standard-routing", ...)` block (around line 242), add:

```js
// ── POST /set-placement-routing — Save content_type→placement defaults to system_settings ─
router.post("/set-placement-routing", requireSecret, requirePin, (req, res) => {
  const CONTENT_TYPES = [
    "standard_post", "before_after", "education",
    "vendor_product", "vendor_promotion", "reviews",
    "celebration", "stylist_availability",
  ];
  const VALID = ["reel", "story", "post"];

  const routing = {};
  for (const ct of CONTENT_TYPES) {
    const val = req.body[`placement_${ct}`];
    routing[ct] = VALID.includes(val) ? val : "post";
  }

  const json = JSON.stringify(routing);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('placement_routing', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(json, now);

  // If push-to-all checkbox was checked, also write to every salon
  if (req.body.push_to_all === "1") {
    db.prepare(`UPDATE salons SET placement_routing = NULL`).run();
    console.log(`[vendorAdmin] Cleared all salon placement_routing overrides (push_to_all)`);
  }

  console.log(`[vendorAdmin] Updated system placement_routing:`, json);
  res.redirect(`/internal/vendors${qs(req)}&placement_routing_saved=1`);
});
```

**Step 3: Load current placement routing in the GET handler**

In the GET `/` handler (around line 289, after `currentRouting` is loaded), add:

```js
const currentPlacementRouting = getSystemPlacementRouting(db);
const placementRoutingSaved = req.query.placement_routing_saved === "1";
```

**Step 4: Add Content Placement Defaults section to the HTML**

In the GET handler HTML, add this new section BEFORE the existing `<!-- Set Standard Routing -->` div (around line 982):

```js
// Add flash message near the top of the console if placement_routing_saved
${placementRoutingSaved ? `
  <div class="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
    Content placement defaults saved.
  </div>` : ""}

<!-- Content Placement Defaults -->
<div class="border rounded-2xl bg-white overflow-hidden mt-8">
  <div class="px-6 py-4 border-b">
    <h2 class="font-bold">Content Placement Defaults</h2>
    <p class="text-xs text-gray-500 mt-0.5">Set the default placement (Reel, Story, Post/Grid) for each content type. Salons can override individually from their Integrations page.</p>
  </div>
  <div class="px-6 py-5">
    <form method="POST" action="/internal/vendors/set-placement-routing${qs(req)}">
      <table class="text-sm w-full mb-4">
        <thead>
          <tr class="text-xs text-gray-500 uppercase tracking-wide border-b">
            <th class="text-left pb-2 font-medium">Content Type</th>
            <th class="text-left pb-2 font-medium pl-4">Default Placement</th>
          </tr>
        </thead>
        <tbody>
          ${[
            ["standard_post",        "Standard Post"],
            ["before_after",         "Before & After"],
            ["education",            "Education / Tutorial"],
            ["vendor_product",       "Vendor Product"],
            ["vendor_promotion",     "Vendor Promotion"],
            ["reviews",              "Review / Testimonial"],
            ["celebration",          "Celebration"],
            ["stylist_availability", "Stylist Availability"],
          ].map(([ct, label]) => {
            const current = currentPlacementRouting[ct] || "post";
            return `
              <tr class="border-b border-gray-100 last:border-0">
                <td class="py-2 pr-6 font-medium text-gray-700">${label}</td>
                <td class="py-2 pl-4">
                  <select name="placement_${ct}"
                    class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
                    <option value="post"${current === "post" ? " selected" : ""}>Post / Grid</option>
                    <option value="reel"${current === "reel" ? " selected" : ""}>Reel</option>
                    <option value="story"${current === "story" ? " selected" : ""}>Story</option>
                  </select>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="flex items-center gap-4 pt-2 border-t border-gray-100">
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" name="push_to_all" value="1"
            class="rounded border-gray-300">
          Clear all salon overrides (reset everyone to these defaults)
        </label>
        <button type="submit"
          class="ml-auto px-4 py-2 bg-mpAccent text-white text-sm font-semibold rounded-lg hover:bg-mpAccentDark">
          Save Defaults
        </button>
      </div>
    </form>
  </div>
</div>
```

**Step 5: Manual test**

Navigate to `/internal/vendors?secret=...&pin=...` and verify:
- "Content Placement Defaults" section appears with 8 rows and correct current values
- Changing a select and clicking Save updates the system_settings row
- "Clear all salon overrides" checkbox clears `placement_routing` on all salons when checked

**Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 7: Commit**

```bash
git add src/routes/vendorAdmin.js
git commit -m "feat(placement-routing): add Content Placement Defaults section to Platform Console"
```

---

### Task 4: Salon Integrations — Content Placement card

**Files:**
- Modify: `src/routes/integrations.js`

**Context:**
- `integrations.js` already imports `mergeRoutingDefaults` from `platformRouting.js` — add import of `getSystemPlacementRouting` and `mergePlacementRouting` from `placementRouting.js`
- The existing `GET /` handler (around line 100) already loads `routing` for the platform routing card — add parallel loading for placement routing
- Add the new card AFTER the existing Content Routing card (after line 606) and BEFORE the "Coming Soon" Vagaro card
- The collapsible toggle system uses `['fb', 'gmb', 'zenoti', 'tiktok', 'routing']` at line 634 — add `'placement'` to this array
- New POST route: `POST /manager/integrations/placement-routing` — add alongside existing `POST /routing-update` (after line 697)

**Step 1: Add import**

At the top of `src/routes/integrations.js`, alongside the existing platformRouting import, add:
```js
import { getSystemPlacementRouting, mergePlacementRouting } from "../core/placementRouting.js";
```

**Step 2: Load placement routing in GET handler**

In the GET handler, after the `routing`/`routingSaved` lines (~line 108), add:
```js
// Content Placement card data
const systemPlacement = getSystemPlacementRouting();
const salonPlacementJson = salon.placement_routing ?? null;
const resolvedPlacement = mergePlacementRouting(systemPlacement, salonPlacementJson);
const salonPlacementOverrides = salonPlacementJson ? (() => {
  try { return JSON.parse(salonPlacementJson); } catch { return {}; }
})() : {};
const placementSaved = req.query.placement === 'saved';
```

Also add to the `alertHtml` block:
```js
} else if (placementSaved) {
  alertHtml = `<div class="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">Content placement updated.</div>`;
```

**Step 3: Add Content Placement card to HTML**

After the closing `</div>` of the Content Routing card (after line 606), add:

```js
<!-- ── Content Placement ────────────────────────────────── -->
<div class="rounded-2xl border border-mpBorder bg-mpCard shadow-sm overflow-hidden mb-4">
  <button type="button"
    id="toggle-btn-placement"
    class="w-full flex justify-between items-center p-6 text-left hover:bg-mpBg transition-colors cursor-pointer">
    <div>
      <h2 class="text-base font-semibold text-mpCharcoal">Content Placement</h2>
      <p class="text-sm text-mpMuted mt-0.5">Set which format each content type defaults to — Reel, Story, or Post/Grid.</p>
    </div>
    ${chevron('placement')}
  </button>

  <div id="card-placement" data-open="false" class="border-t border-mpBorder px-6 pb-6">
    <p class="text-xs text-mpMuted pt-4 pb-3">These settings control the recommended placement for each content type. Changes apply to future posts. The manager can still override placement on individual posts at approval time.</p>

    <form method="POST" action="/manager/integrations/placement-routing">
      <table class="w-full text-sm mb-4">
        <thead>
          <tr>
            <th class="text-left py-2 pr-4 font-medium text-mpMuted">Content Type</th>
            <th class="text-left py-2 px-4 font-medium text-mpMuted">Placement</th>
            <th class="py-2 px-4 font-medium text-mpMuted"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-mpBorder">
          ${[
            ["standard_post",        "Standard Post"],
            ["before_after",         "Before & After"],
            ["education",            "Education / Tutorial"],
            ["vendor_product",       "Vendor Product"],
            ["vendor_promotion",     "Vendor Promotion"],
            ["reviews",              "Review / Testimonial"],
            ["celebration",          "Celebration"],
            ["stylist_availability", "Stylist Availability"],
          ].map(([ct, label]) => {
            const current = resolvedPlacement[ct] || "post";
            const isCustom = ct in salonPlacementOverrides && VALID_PLACEMENTS.has(salonPlacementOverrides[ct]);
            const systemVal = systemPlacement[ct] || "post";
            return `
              <tr>
                <td class="py-2 pr-4 font-medium text-mpCharcoal">${label}</td>
                <td class="py-2 px-4">
                  <select name="placement_${ct}"
                    class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                    <option value="post"${current === "post" ? " selected" : ""}>Post / Grid</option>
                    <option value="reel"${current === "reel" ? " selected" : ""}>Reel</option>
                    <option value="story"${current === "story" ? " selected" : ""}>Story</option>
                  </select>
                </td>
                <td class="py-2 px-4 text-xs">
                  ${isCustom
                    ? `<span class="inline-flex items-center rounded-full bg-mpAccentLight px-2 py-0.5 text-mpAccent font-semibold">Custom</span>`
                    : `<span class="text-mpMuted">Using system default</span>`
                  }
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="flex items-center justify-between pt-2 border-t border-mpBorder">
        <form method="POST" action="/manager/integrations/placement-routing/reset" class="inline">
          <button type="submit"
            class="text-sm text-mpMuted hover:text-red-600 transition-colors">
            Reset to system defaults
          </button>
        </form>
        <button type="submit"
          class="rounded-full bg-mpAccent px-5 py-2 text-sm font-semibold text-white hover:bg-mpCharcoalDark transition-colors">
          Save Placement
        </button>
      </div>
    </form>
  </div>
</div>
```

Also add `'placement'` to the toggle array in the `<script>` block (line ~634):
```js
['fb', 'gmb', 'zenoti', 'tiktok', 'routing', 'placement'].forEach(function(id) {
```

You'll also need to define `VALID_PLACEMENTS` at the top of the GET handler (alongside the routing card data):
```js
const VALID_PLACEMENTS = new Set(["reel", "story", "post"]);
```

**Step 4: Add POST /placement-routing route**

After the existing `router.post("/routing-update", ...)` block (after line 697), add:

```js
// ─────────────────────────────────────────────────────────────────
// POST /manager/integrations/placement-routing — save per-salon placement routing
// ─────────────────────────────────────────────────────────────────
router.post("/placement-routing", (req, res) => {
  const salon_id = req.manager?.salon_id;

  const CONTENT_TYPES = [
    "standard_post", "before_after", "education",
    "vendor_product", "vendor_promotion", "reviews",
    "celebration", "stylist_availability",
  ];
  const VALID = ["reel", "story", "post"];

  // Build partial override — only store keys that differ from system defaults
  // (Always store all keys for simplicity; merge logic handles the rest)
  const routing = {};
  for (const ct of CONTENT_TYPES) {
    const val = req.body[`placement_${ct}`];
    if (VALID.includes(val)) routing[ct] = val;
  }

  db.prepare(
    `UPDATE salons SET placement_routing = ? WHERE slug = ?`
  ).run(JSON.stringify(routing), salon_id);

  res.redirect("/manager/integrations?placement=saved");
});

// ─────────────────────────────────────────────────────────────────
// POST /manager/integrations/placement-routing/reset — clear salon placement override
// ─────────────────────────────────────────────────────────────────
router.post("/placement-routing/reset", (req, res) => {
  const salon_id = req.manager?.salon_id;
  db.prepare(`UPDATE salons SET placement_routing = NULL WHERE slug = ?`).run(salon_id);
  res.redirect("/manager/integrations?placement=saved");
});
```

**Step 5: Also load `salon.placement_routing` in the GET handler salon query**

The GET handler loads the salon record — verify `placement_routing` is included. Find where the salon row is fetched and confirm the SELECT includes `placement_routing`. If the salon is loaded via a `SELECT *`, it's automatic. If it's an explicit column list, add `placement_routing`.

**Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 7: Commit**

```bash
git add src/routes/integrations.js
git commit -m "feat(placement-routing): add Content Placement card to salon Integrations page"
```

---

### Task 5: Scheduler — resolve placement from routing config

**Files:**
- Modify: `src/scheduler.js`

**Context:**
- `getSalonPolicy()` is at line 177 — it SELECT includes `platform_routing` already (line 198); add `placement_routing` to the same SELECT
- `resolvedPlacement` at line 428: `post.placement || deriveFromPostType(postType)`
- The new logic: if `post.placement_overridden = 1`, use stored placement. Otherwise, call `resolveContentPlacement(null, salon, contentType)` — passing `null` for dbOverride so it uses the real db singleton inside `placementRouting.js`
- Import `resolveContentPlacement` from `./core/placementRouting.js`

**Step 1: Add import to scheduler.js**

Find the existing imports at the top of `src/scheduler.js`. Add:
```js
import { resolveContentPlacement } from './core/placementRouting.js';
```

**Step 2: Add placement_routing to getSalonPolicy SELECT**

In `getSalonPolicy()` at line ~198, the SELECT already has `platform_routing`. Add `placement_routing` on the next line:

```js
        platform_routing,
        placement_routing
```

**Step 3: Update resolvedPlacement logic**

At line 428, find:
```js
const resolvedPlacement = post.placement || deriveFromPostType(postType);
```

Replace with:
```js
// Resolution order:
//   1. Manager explicitly overrode placement at approval time → use stored value
//   2. Configurable routing: salon override → system default → hardcoded fallback
const resolvedPlacement = post.placement_overridden
  ? (post.placement || deriveFromPostType(postType))
  : resolveContentPlacement(null, salon, post.content_type || postType);
```

**Step 4: Run full test suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 5: Commit**

```bash
git add src/scheduler.js
git commit -m "feat(placement-routing): scheduler resolves placement from configurable routing"
```

---

### Task 6: Manager approval card — placement source label

**Files:**
- Modify: `src/routes/manager.js`

**Context:**
- Line 353: `<p id="mp-placement-label-${esc(p.id)}" class="text-xs text-gray-400 mt-1">${!p.placement_overridden ? "Recommended by MostlyPostly" : ""}</p>`
- The GET handler at line ~294 loads `resolvedContentType` and `resolvedPlacement`
- We need to know whether the placement came from a salon override or system default
- Import `getSystemPlacementRouting`, `mergePlacementRouting` from `../core/placementRouting.js`

**Step 1: Add import to manager.js**

At the top of `src/routes/manager.js`, add:
```js
import { getSystemPlacementRouting, mergePlacementRouting } from "../core/placementRouting.js";
```

**Step 2: Load placement routing in the GET /manager handler**

In the section that loads pending posts (around line 285, in the GET /manager handler), load the placement routing once before the posts loop:

```js
// Load placement routing for label logic
const systemPlacementDefaults = getSystemPlacementRouting();
const salonRow = db.prepare("SELECT placement_routing FROM salons WHERE slug = ?").get(req.manager.salon_id);
const resolvedSalonPlacement = mergePlacementRouting(systemPlacementDefaults, salonRow?.placement_routing ?? null);
const salonPlacementOverrides = (() => {
  try { return JSON.parse(salonRow?.placement_routing || "{}"); } catch { return {}; }
})();
```

**Step 3: Update the placement source label per post**

In the post card template, replace line 353:
```js
<p id="mp-placement-label-${esc(p.id)}" class="text-xs text-gray-400 mt-1">${!p.placement_overridden ? "Recommended by MostlyPostly" : ""}</p>
```

With:
```js
${(() => {
  if (p.placement_overridden) return `<p id="mp-placement-label-${esc(p.id)}" class="text-xs text-gray-400 mt-1"></p>`;
  const ct = p.content_type || "standard_post";
  const isCustom = ct in salonPlacementOverrides;
  const labelText = isCustom ? "Your salon default" : "Recommended by MostlyPostly";
  return `<p id="mp-placement-label-${esc(p.id)}" class="text-xs text-gray-400 mt-1">${labelText}</p>`;
})()}
```

**Step 4: Run full test suite**

```bash
npx vitest run
```
Expected: no regressions

**Step 5: Commit**

```bash
git add src/routes/manager.js
git commit -m "feat(placement-routing): approval card label reflects placement source"
```

---

### Task 7: Update CLAUDE.md and FEATURES.md

**Files:**
- Modify: `/Users/troyhardister/chairlyos/mostlypostly/CLAUDE.md`
- Modify: `/Users/troyhardister/chairlyos/mostlypostly/FEATURES.md`

**Step 1: Update CLAUDE.md**

In the Key Source Files → Core Logic table, add:
```
| `src/core/placementRouting.js` | Configurable content_type→placement routing — `getSystemPlacementRouting(db)`, `mergePlacementRouting(systemDefaults, salonJson)`, `resolveContentPlacement(db, salon, contentType)`. Reads from `system_settings` key='placement_routing'. |
```

In Key Patterns & Conventions, add:
```
- **Placement routing cascade**: `post.placement_overridden=1` → `salons.placement_routing` → `system_settings key='placement_routing'` → `DEFAULT_PLACEMENT` in `contentType.js`. Configured at Platform Console (system level) and `/manager/integrations` (salon level). Never hardcode placement decisions in new features — always call `resolveContentPlacement()`.
- **system_settings table**: Key/value store for console-level config. Currently stores `placement_routing` JSON. Read via `getSystemPlacementRouting()` from `placementRouting.js`.
```

In the Database Schema section, add `system_settings` table description.

**Step 2: Add FEAT-059 to FEATURES.md**

Add a row:
```
| FEAT-059 | Configurable Content Placement Routing | done | High | Console-level defaults + salon-level overrides for content_type→placement routing; system_settings table; placementRouting.js; scheduler integration |
```

And add a full FEAT-059 section at the bottom of FEATURES.md.

**Step 3: Commit**

```bash
cd /Users/troyhardister/chairlyos/mostlypostly
git add CLAUDE.md FEATURES.md
git commit -m "docs: add FEAT-059 configurable placement routing to CLAUDE.md and FEATURES.md"
```
