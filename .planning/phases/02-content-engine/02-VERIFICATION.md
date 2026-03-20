---
phase: 02-content-engine
verified: 2026-03-19T00:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 02: Content Engine Verification Report

**Phase Goal:** Build the Content Engine — auto-recycler, intelligent cadence scheduler, admin UI toggles, and database view actions — so published content gets reused and the post queue never stagnates.
**Verified:** 2026-03-19
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Auto-recycle fires only when queue depth < 3 AND no publish in last 48 hours | VERIFIED | `src/core/contentRecycler.js` lines 138-163: queue depth check `COUNT(*) >= 3` returns early; `hoursSince < 48` returns early |
| 2  | Candidates ranked by reach DESC from past 90 days | VERIFIED | `contentRecycler.js` line 187: `COALESCE(MAX(pi.reach), 0) AS best_reach`; line 194: `datetime('now', '-90 days')`; line 214: `ORDER BY best_reach DESC` |
| 3  | Posts with block_from_recycle=1 or recycled in last 45 days are excluded | VERIFIED | `contentRecycler.js` line 190: `AND p.block_from_recycle = 0`; lines 195-200: `NOT EXISTS` subquery with `datetime('now', '-45 days')` |
| 4  | Recycled post is a new DB row with recycled_from_id FK pointing to original | VERIFIED | `contentRecycler.js` lines 91-107: INSERT with `recycled_from_id = source.id` inside `db.transaction()` |
| 5  | Same post_type is not recycled twice in a row | VERIFIED | `contentRecycler.js` line 201: `AND p.post_type != ?` bound to `lastPublishedType` |
| 6  | Caption refresh only fires for Growth/Pro salons with toggle on | VERIFIED | `contentRecycler.js` line 50: `salon.caption_refresh_on_recycle && CAPTION_REFRESH_PLANS.has(salon.plan)` where `CAPTION_REFRESH_PLANS = new Set(["growth", "pro"])` |
| 7  | Manager receives SMS when auto-recycle fires | VERIFIED | `contentRecycler.js` lines 226-239: queries all manager phones and calls `sendViaTwilio()` with `.catch()` fire-and-forget |
| 8  | before_after and availability posts only recycled on mid-week days (Tue-Thu) | VERIFIED | `contentRecycler.js` lines 177-182: Luxon weekday check, `MID_WEEK = new Set([2, 3, 4])`; dynamically excludes types on non-mid-week days |
| 9  | pickNextPost selects most under-represented content type from pending queue | VERIFIED | `src/core/pickNextPost.js`: deficit scoring `target.min - current_ratio`; positive deficit = under-represented = highest priority |
| 10 | Standard posts stay within 50-60% of the 7-day rolling window | VERIFIED | `pickNextPost.js` line 19: `standard_post: { min: 0.50, max: 0.60 }` in TARGETS |
| 11 | Before/after posts skipped on non-Tue/Wed/Thu days | VERIFIED | `pickNextPost.js` lines 86-89: `if (!isMidWeek && type === 'before_after') return false` |
| 12 | Promotions capped at 2-3/week and never back-to-back | VERIFIED | `pickNextPost.js` lines 91-97: `promoCount >= 2` guard and `lastPublishedType === 'promotions'` back-to-back guard |
| 13 | Availability posts only selected on Tue/Wed/Thu | VERIFIED | `pickNextPost.js` line 86: `type === 'availability'` filtered with `!isMidWeek` |
| 14 | Reel posts do not affect distribution counts — scored -1 (bonus) | VERIFIED | `pickNextPost.js` line 46: `post_type != 'reel'` in distribution query; line 116: `return { post, score: -1 }` |
| 15 | Publishing never stalls — fallback when all candidates filtered | VERIFIED | `pickNextPost.js` lines 103-106: `if (filtered.length === 0) { filtered = posts; }` |
| 16 | Manager can toggle auto-recycle and caption refresh in Admin Manager Rules | VERIFIED | `src/routes/admin.js` line 1337: `name="auto_recycle"` select; line 1346: `name="caption_refresh_on_recycle"` select; line 1295: `showCaptionRefresh = ['growth', 'pro'].includes(salonPlan)` for plan gate |
| 17 | Manager can Recycle/Block published posts in Database view and see notice banner on dashboard | VERIFIED | `src/routes/dashboard.js`: recycle-post, toggle-block, undo-recycle handlers; `src/routes/manager.js`: `recycledThisWeek` query, `recycleBanner` HTML with dismiss |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/048_content_recycler.js` | Schema: block_from_recycle, recycled_from_id, auto_recycle, caption_refresh_on_recycle | VERIFIED | All 4 columns present with PRAGMA guards |
| `migrations/index.js` | Registers migration 048 | VERIFIED | Line 51: import + line 101: registered in array |
| `src/core/contentRecycler.js` | Exports checkAndAutoRecycle, cloneAndEnqueue | VERIFIED | Both functions exported; 8.2KB, substantive implementation |
| `src/core/contentRecycler.test.js` | Unit tests RECYC-01 through RECYC-07 | VERIFIED | 19.4KB, all tests pass (23 tests reported in SUMMARY) |
| `src/core/pickNextPost.js` | Exports pickNextPost(posts, salonId, timezone) | VERIFIED | 4.6KB; all 6 SCHED requirements covered |
| `src/core/pickNextPost.test.js` | Unit tests SCHED-01 through SCHED-06 | VERIFIED | 15.0KB, all tests pass (24 tests) |
| `src/scheduler.js` | Imports + wires both modules | VERIFIED | Lines 15-16: imports; line 186: getSalonPolicy extended; lines 328-342: recycler loop; line 391: pickNextPost call |
| `src/routes/admin.js` | auto_recycle + caption_refresh_on_recycle toggles | VERIFIED | Toggles present in form; POST handler saves both; plan gate for caption refresh |
| `src/routes/dashboard.js` | Recycle/Block/Undo actions + POST handlers | VERIFIED | cloneAndEnqueue imported; all 3 handlers present with IDOR protection |
| `src/routes/manager.js` | Auto-recycle notice banner | VERIFIED | recycledThisWeek query, recycleBanner, blue styling, dismiss handler, View in Database link |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `contentRecycler.js` | `db.js` | `import { db }` | WIRED | Line 14: `import { db } from "../../db.js"` |
| `contentRecycler.js` | `src/scheduler.js` | `import { enqueuePost, getSalonPolicy }` | WIRED | Line 15: import; enqueuePost called in `insertAndEnqueue` transaction |
| `contentRecycler.js` | `src/openai.js` | dynamic import for caption refresh | WIRED | Line 52: `await import("../openai.js")` |
| `contentRecycler.js` | `src/routes/twilio.js` | `import { sendViaTwilio }` | WIRED | Line 16: import; line 236: called for each manager phone |
| `pickNextPost.js` | `db.js` | `import { db }` | WIRED | Line 13: `import { db } from '../../db.js'` |
| `pickNextPost.js` | `src/scheduler.js` | `import { DEFAULT_PRIORITY }` | WIRED | Line 15: import; line 129: used in tiebreak sort |
| `scheduler.js` | `contentRecycler.js` | `import { checkAndAutoRecycle }` | WIRED | Line 15: import; line 335: called in recycler loop |
| `scheduler.js` | `pickNextPost.js` | `import { pickNextPost }` | WIRED | Line 16: import; line 391: called in publish loop |
| `dashboard.js` | `contentRecycler.js` | `import { cloneAndEnqueue }` | WIRED | Line 10: import; recycle-post handler calls `cloneAndEnqueue(post_id, salon_id)` |
| `admin.js` | `salons table` | `UPDATE salons SET auto_recycle = ?` | WIRED | Lines 1548-1549: UPDATE SQL includes both new columns |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RECYC-01 | 02-01 | Auto-trigger: queue < 3 AND last publish > 48hr | SATISFIED | `contentRecycler.js` dual early-return guards |
| RECYC-02 | 02-01 | Candidates: 90-day window, reach DESC | SATISFIED | `contentRecycler.js` `datetime('now', '-90 days')` + `ORDER BY best_reach DESC` |
| RECYC-03 | 02-01 | Exclude: 45-day recycled, block_from_recycle=1 | SATISFIED | `NOT EXISTS` subquery + `block_from_recycle = 0` filter |
| RECYC-04 | 02-01 | No same post_type twice in a row | SATISFIED | `AND p.post_type != ?` bound to lastPublishedType |
| RECYC-05 | 02-01 | Caption refresh (Growth/Pro + toggle) | SATISFIED | Plan check + dynamic import of generateCaption |
| RECYC-06 | 02-01 | New row with recycled_from_id FK, enqueued | SATISFIED | `db.transaction()` INSERT + `enqueuePost()` |
| RECYC-07 | 02-01 | Manager SMS on auto-recycle | SATISFIED | sendViaTwilio loop over all managers, fire-and-forget |
| RECYC-08 | 02-03 | Admin toggle auto-recycle on/off | SATISFIED | `name="auto_recycle"` select + POST handler saves to DB |
| RECYC-09 | 02-03 | Block individual posts from recycling | SATISFIED | `toggle-block` POST handler flips `block_from_recycle`, IDOR protected |
| RECYC-10 | 02-03 | Manual Recycle button in Database view | SATISFIED | `recycle-post` handler calls `cloneAndEnqueue`, IDOR protected |
| RECYC-11 | 02-04 | Dashboard notice with link + undo | SATISFIED | `recycleBanner` in manager.js; undo-recycle handler in dashboard.js |
| SCHED-01 | 02-02 | pickNextPost by content-type weight | SATISFIED | Deficit scoring from 7-day rolling distribution |
| SCHED-02 | 02-02 | 50-60% standard posts | SATISFIED | TARGETS `standard_post: { min: 0.50, max: 0.60 }` |
| SCHED-03 | 02-02 | 15-20% before/after, preferred Tue-Thu | SATISFIED | MID_WEEK filter + TARGETS `before_after: { min: 0.15, max: 0.20 }` |
| SCHED-04 | 02-02 | Promotions capped 2-3/week, no back-to-back | SATISFIED | promoCount >= 2 guard + back-to-back type check |
| SCHED-05 | 02-02 | Availability mid-week only (Tue-Thu) | SATISFIED | `!isMidWeek && type === 'availability'` filter |
| SCHED-06 | 02-02 | Reels are bonus, do not count in distribution | SATISFIED | `post_type != 'reel'` in distribution query; `score: -1` |

All 17 requirements (RECYC-01 through RECYC-11, SCHED-01 through SCHED-06) are satisfied by code in the codebase. No orphaned requirements found.

---

### Anti-Patterns Found

No blockers or stubs detected. All implementations are substantive:

- `contentRecycler.js` (8.2KB): Full async engine with real DB queries, dynamic SQL, transaction, SMS.
- `pickNextPost.js` (4.6KB): Full scoring algorithm with 3 DB queries, weekday logic, deficit sort.
- `dashboard.js` POST handlers: Real DB mutations with IDOR protection (`WHERE id = ? AND salon_id = ?`) on all three handlers.
- `admin.js` POST handler: Real UPDATE with correct parameterization.
- `manager.js` banner: Real DB count query, not hardcoded.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

---

### Test Results

**Full suite:** 63 tests, 0 failures (npx vitest run — verified programmatically).

- `contentRecycler.test.js`: 23 tests — RECYC-01 through RECYC-07 covered
- `pickNextPost.test.js`: 24 tests — SCHED-01 through SCHED-06 covered (8 describe blocks)

---

### Human Verification Required

The following items cannot be verified programmatically and require a running server:

#### 1. Admin toggle persistence

**Test:** Navigate to Admin → Manager Rules, set Auto-Recycle to Enabled, save, reload page.
**Expected:** Toggle persists as Enabled. If plan is Growth/Pro, Caption Refresh toggle also appears. If plan is Starter/trial, Caption Refresh toggle is absent from DOM.
**Why human:** Server-rendering conditional on plan tier from DB — needs a live session.

#### 2. Database view action buttons

**Test:** Open Database view with published posts. Verify Recycle and Block buttons appear on published rows. Click Block — verify button turns red and shows "Blocked". Click again — reverts. Click Recycle — verify success notice appears and new "Recycled" badge appears on the cloned post. Click Undo — verify confirmation dialog and deletion.
**Expected:** All state transitions work; non-published rows show em-dash instead of buttons.
**Why human:** Visual state and browser-side DOM interaction (confirmation dialog, button state change).

#### 3. Dashboard auto-recycle notice banner

**Test:** After auto-recycling fires (or manually recycling a post), visit the manager dashboard.
**Expected:** Blue banner appears with correct plural/singular grammar, "View in Database" link navigates to published filter, dismiss button (x) removes banner via JS.
**Why human:** Banner visibility depends on DB state and JS DOM interaction.

---

### Gaps Summary

No gaps. All truths verified, all artifacts exist and are substantive, all key links are wired, all 17 requirements satisfied, 63/63 tests pass.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
