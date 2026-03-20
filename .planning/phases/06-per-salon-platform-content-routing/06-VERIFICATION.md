---
phase: 06-per-salon-platform-content-routing
verified: 2026-03-20T19:30:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 06: Per-Salon Platform Content Routing Verification Report

**Phase Goal:** Per-salon platform content routing — managers can control which post types publish to which platforms (FB, IG, GMB, TikTok) per salon.
**Verified:** 2026-03-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A salon can store per-post-type, per-platform routing rules as JSON in the DB | VERIFIED | `migrations/051_platform_routing.js` adds `platform_routing TEXT` column; idempotent guard via `PRAGMA table_info` |
| 2 | `getSalonPolicy()` can read platform_routing without breaking existing salons (defaults all-enabled) | VERIFIED | `platform_routing` in SELECT at line 197 of `scheduler.js`; `isEnabledFor()` returns `true` when `platform_routing` is NULL |
| 3 | `isEnabledFor(salon, postType, platform)` returns true for any combo not explicitly set to false | VERIFIED | `platformRouting.js` line 84: `return val !== false` — undefined and missing keys are treated as true |
| 4 | Migration is idempotent — running twice does not throw | VERIFIED | Guard: `if (!salonCols.includes('platform_routing'))` wraps the ALTER TABLE |
| 5 | Manager can see a Content Routing card on the Integrations page | VERIFIED | `integrations.js` lines 519–559: full collapsible card with `<h2>Content Routing</h2>` |
| 6 | The card shows a toggle grid: rows = post types, columns = platforms | VERIFIED | `buildRoutingRows()` at line 144 generates 8 post types × 4 platform columns (Facebook, Instagram, Google, TikTok) |
| 7 | Each toggle reflects current saved state; toggling saves that change | VERIFIED | `routing` computed from `mergeRoutingDefaults(salon.platform_routing)` at line 60; `onchange="this.form.submit()"` on each checkbox; POST handler writes full JSON to DB |
| 8 | Platforms not connected show toggle greyed out | VERIFIED | `buildRoutingRows()` disables FB if `!hasFb`; IG if `!fbConnected`; GMB if not connected or non-growth/pro plan; TikTok if not connected or ineligible post type |
| 9 | Saving routing changes shows a flash confirmation | VERIFIED | `routingSaved` flag at line 61; alert rendered at line 123: "Content routing updated." |
| 10 | Scheduler skips Facebook publish when `isEnabledFor` returns false | VERIFIED | Lines 521, 559, 570 of `scheduler.js`: `if (isEnabledFor(salon, postType, 'facebook'))` guards each FB publish call |
| 11 | Scheduler skips Instagram publish when `isEnabledFor` returns false | VERIFIED | Lines 534, 549, 562, 574 of `scheduler.js`: `if (isEnabledFor(salon, postType, 'instagram'))` guards each IG publish call |
| 12 | Scheduler skips GMB publish when `isEnabledFor` returns false | VERIFIED | Line 612 of `scheduler.js`: `gmbEligible` includes `&& isEnabledFor(salon, postType, 'gmb')` |
| 13 | Scheduler skips TikTok publish when `isEnabledFor` returns false | VERIFIED | Line 649 of `scheduler.js`: `tiktokEligible` includes `&& isEnabledFor(salon, postType, 'tiktok')` |
| 14 | Platform Console shows a Global Routing Defaults card | VERIFIED | `vendorAdmin.js` lines 935–979: "Global Routing Defaults" card with per-salon reset; `POST /reset-routing` sets `platform_routing = NULL` |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/051_platform_routing.js` | Adds platform_routing TEXT column to salons | VERIFIED | 19 lines; idempotent ALTER TABLE; registered as `run051` in `migrations/index.js` line 54/107 |
| `src/core/platformRouting.js` | Exports `isEnabledFor`, `DEFAULT_ROUTING`, `mergeRoutingDefaults` | VERIFIED | 86 lines; all three named exports present; full edge-case handling (null, malformed JSON, unknown post types) |
| `migrations/index.js` | Migration 051 registered | VERIFIED | `import { run as run051 }` at line 54; registered in array at line 107 |
| `src/routes/integrations.js` | Content Routing card + POST routing-update route | VERIFIED | Card at lines 519–559; `buildRoutingRows()` helper at lines 143–194; POST handler at lines 623–650; flash at line 123 |
| `src/scheduler.js` | `isEnabledFor()` guards on all publish paths + `platform_routing` in SELECT | VERIFIED | 11 occurrences total (1 import + 1 SELECT column + 9 guard calls); `gmbEligible` and `tiktokEligible` both extend with routing check |
| `src/routes/vendorAdmin.js` | Global Routing Defaults section in Platform Console | VERIFIED | `DEFAULT_ROUTING` + `mergeRoutingDefaults` imported at line 25; `POST /reset-routing` at line 204; card HTML at lines 935–979; `salonsWithRouting` query at line 308 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/scheduler.js` | `src/core/platformRouting.js` | `import { isEnabledFor }` line 18 | WIRED | Used 9 times in publish guards; `platform_routing` in SELECT at line 197 |
| `src/routes/integrations.js` | `src/core/platformRouting.js` | `import { DEFAULT_ROUTING, mergeRoutingDefaults }` line 15 | WIRED | `mergeRoutingDefaults` called at line 60 to compute routing state for card render |
| `POST /manager/integrations/routing-update` | `salons.platform_routing` | `JSON.stringify(routing)` at line 647 | WIRED | Full 8×4 routing object serialized and stored; redirect with `?routing=saved` |
| `src/routes/vendorAdmin.js` | `src/core/platformRouting.js` | `import { DEFAULT_ROUTING, mergeRoutingDefaults }` line 25 | WIRED | `mergeRoutingDefaults` called at line 956 to compute disabled rules for display |
| `POST /internal/vendors/reset-routing` | `salons.platform_routing` | `UPDATE salons SET platform_routing = NULL` line 207 | WIRED | requireSecret + requirePin guards; `routing_reset` flash on redirect |

---

## Requirements Coverage

No `requirements:` fields declared in any plan frontmatter for this phase — phase was self-contained schema + UI + enforcement work with no external requirement IDs.

---

## Anti-Patterns Found

No blockers or stubs found. Specific checks run:

- `buildRoutingRows()` — all 8 post types render actual toggle cells wired to form fields; no placeholders
- `routing-update` POST handler — reads all 32 form fields (8×4), builds real JSON, writes to DB; no static return
- `isEnabledFor()` — no `return true` stub; actual merge and lookup against `platform_routing` JSON
- `gmbEligible` / `tiktokEligible` — routing check is a genuine `&&` condition, not commented out
- Flash banner — conditional on `req.query.routing === 'saved'`; not always shown

---

## Human Verification Required

### 1. Toggle Grid Visual Behavior

**Test:** Log in as a manager on a salon where Facebook is connected but TikTok is not. Navigate to `/manager/integrations` and open the Content Routing card.
**Expected:** Facebook and Instagram toggles are interactive. TikTok column is greyed and unclickable. Google column is greyed if on Starter plan.
**Why human:** CSS disabled states (opacity + pointer-events-none) and tooltip behavior require browser rendering to verify.

### 2. Immediate Save UX on Toggle Change

**Test:** Click a toggle in the Content Routing card. Observe page behavior.
**Expected:** Page immediately resubmits the form and reloads with "Content routing updated." flash banner. The toggled cell retains its new state.
**Why human:** `onchange="this.form.submit()"` behavior and flash banner visibility require browser interaction to verify end-to-end.

### 3. Scheduler Enforcement Under Real Publish

**Test:** On a test salon with GMB connected, disable GMB for `standard_post` via the Content Routing card. Then trigger a standard post to publish via the scheduler.
**Expected:** Post publishes to Facebook and Instagram but NOT to GMB. No GMB error logged — the scheduler should silently skip the GMB publish due to routing.
**Why human:** Requires a real scheduler tick with a queued post and connected GMB account.

---

## Gaps Summary

No gaps. All 14 observable truths verified against the actual codebase. All 6 key artifacts exist, are substantive, and are wired to their dependents. All 6 documented commits verified in git history (`740d5b5`, `3077824`, `2514240`, `7b252f3`, `bc4253b`, `d017eb6`). No stubs or placeholders detected.

---

_Verified: 2026-03-20T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
