---
phase: 02-content-engine
plan: "01"
subsystem: content-recycler
tags: [recycler, scheduler, tdd, sqlite, sms]
dependency_graph:
  requires: []
  provides: [contentRecycler.checkAndAutoRecycle, contentRecycler.cloneAndEnqueue, migration-048]
  affects: [src/scheduler.js, migrations/index.js]
tech_stack:
  added: []
  patterns: [db.transaction for atomic clone+enqueue, dynamic SQL parameterization for weekday filter, fire-and-forget SMS with .catch()]
key_files:
  created:
    - migrations/048_content_recycler.js
    - src/core/contentRecycler.js
    - src/core/contentRecycler.test.js
  modified:
    - migrations/index.js
    - src/scheduler.js
decisions:
  - "cloneAndEnqueue is a shared helper used by both auto-recycle and any future manual recycle route — exported separately for reuse"
  - "Dynamic SQL for weekday exclusion: excludeTypes array built from MID_WEEK Set, appended only when non-empty (backwards-compatible)"
  - "sendViaTwilio called with .catch() (fire-and-forget) — SMS failure never blocks recycle from completing"
  - "generateCaption dynamically imported (not static) to avoid circular deps with openai.js at module load time"
metrics:
  duration_seconds: 291
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 5
---

# Phase 02 Plan 01: Content Recycler Foundation Summary

Content recycler foundation with SQLite migration, core logic module, and scheduler integration — auto-recycles top-performing posts (by reach DESC) when queue depth < 3 AND no publish in last 48 hours, with mid-week filtering, caption refresh for Growth/Pro, and manager SMS notification.

## What Was Built

### Migration 048 (`migrations/048_content_recycler.js`)
Adds 4 columns guarded by PRAGMA table_info:
- `posts.block_from_recycle INTEGER DEFAULT 0` — per-post opt-out
- `posts.recycled_from_id TEXT` — FK to original post
- `salons.auto_recycle INTEGER DEFAULT 0` — salon-level enable toggle
- `salons.caption_refresh_on_recycle INTEGER DEFAULT 0` — AI rewrite toggle

### contentRecycler.js (`src/core/contentRecycler.js`)
Core recycler module with two exported functions:

**`cloneAndEnqueue(postId, salonId)`** — shared helper:
- Looks up source post, gets salon policy
- Optional caption refresh (Growth/Pro + toggle, dynamic import of generateCaption, try/catch fallback)
- Generates new UUID, increments salon_post_number
- Atomic `db.transaction()`: INSERT new row with `recycled_from_id`, then `enqueuePost()` if `auto_publish`
- Returns new post id or null on failure

**`checkAndAutoRecycle(salonId)`** — auto-recycle engine:
- Returns early if `!salon.auto_recycle`
- Returns early if queue depth >= 3
- Returns early if last publish < 48 hours ago
- Gets last published type to exclude (RECYC-04)
- Checks salon-local weekday via Luxon; non-mid-week (Mon/Fri/Sat/Sun) excludes `before_after`/`availability`
- Dynamic SQL with COALESCE reach, 90-day window, 45-day recycled exclusion, `NOT EXISTS` subquery
- Calls `cloneAndEnqueue()` on winner
- SMS all managers via `sendViaTwilio` (fire-and-forget with `.catch()`)

### scheduler.js (`src/scheduler.js`)
Three additive changes:
1. `import { checkAndAutoRecycle } from './core/contentRecycler.js'`
2. `getSalonPolicy` SELECT now includes `auto_recycle, caption_refresh_on_recycle, auto_publish`
3. Auto-recycle loop after `expireStalePosts()`, before tenant publish loop — queries all salons with `auto_recycle = 1`, calls `checkAndAutoRecycle(slug)` with per-salon error isolation

### Tests (`src/core/contentRecycler.test.js`)
23 unit tests covering RECYC-01 through RECYC-07. All dependencies mocked (db, scheduler, twilio, openai). Tests use vi.mock() with per-call `.mockReturnValueOnce()` for deterministic DB call sequencing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock for sendViaTwilio needed resolved promise**
- **Found during:** TDD GREEN phase — RECYC-07 SMS test
- **Issue:** `sendViaTwilio` mock returned `undefined` by default. Code calls `.catch()` on the result (fire-and-forget pattern). When mock returns `undefined`, `.catch()` throws TypeError, swallowing the second SMS call.
- **Fix:** Added `sendViaTwilio.mockResolvedValue(undefined)` in the RECYC-07 SMS test, and used `{ all: vi.fn() }` direct stmt mock (not `makeStmt`) for managers query since `makeStmt` wraps arrays differently.
- **Files modified:** `src/core/contentRecycler.test.js`
- **Commit:** `f3bf002` (included in Task 1 GREEN commit after fix)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| migrations/048_content_recycler.js | FOUND |
| src/core/contentRecycler.js | FOUND |
| src/core/contentRecycler.test.js | FOUND |
| test(02-01) commit 807c88e | FOUND |
| feat(02-01) migration commit f3bf002 | FOUND |
| feat(02-01) scheduler commit b731569 | FOUND |
| 23/23 unit tests pass | VERIFIED |
