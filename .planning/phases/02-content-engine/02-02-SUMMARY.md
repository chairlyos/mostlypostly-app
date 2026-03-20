---
phase: 02-content-engine
plan: 02
subsystem: scheduler
tags: [tdd, scheduling, content-cadence, distribution]
dependency_graph:
  requires: []
  provides: [pickNextPost]
  affects: [src/scheduler.js]
tech_stack:
  added: []
  patterns: [TDD, vitest mocking, rolling-window distribution scoring]
key_files:
  created:
    - src/core/pickNextPost.js
    - src/core/pickNextPost.test.js
  modified:
    - src/scheduler.js
key_decisions:
  - "Reel posts excluded from 7-day distribution query (post_type != 'reel') and scored -1 as bonus content"
  - "Fallback to full posts array when all candidates are filtered — publishing never stalls"
  - "Deficit scoring: target.min - current ratio; positive = under-represented = higher priority"
  - "DEFAULT_PRIORITY from scheduler.js used as tiebreaker (no duplication)"
metrics:
  duration: 181
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 3
---

# Phase 02 Plan 02: Cadence Scheduler (pickNextPost) Summary

**One-liner:** 7-day rolling distribution scorer that enforces 50-60% standard / 15-20% before_after / promotion caps / mid-week availability with a deficit-based priority algorithm.

## What Was Built

`pickNextPost(posts, salonId, timezone)` — a standalone, fully tested module that replaces the static `due.sort(getPriorityIndex)` call in `runSchedulerOnce()`. It queries 3 DB views (distribution, last published, promo count), applies weekday and cap filters, scores each candidate by deficit from target ratio, and returns the optimal post.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement pickNextPost with full TDD coverage | c07aa96 | src/core/pickNextPost.js, src/core/pickNextPost.test.js |
| 2 | Wire pickNextPost into scheduler.js publish loop | f84b5ef | src/scheduler.js |

## Test Coverage

24 tests across 8 describe blocks:

- **pickNextPost** (SCHED-01): null on empty array, returns post, selects under-represented type
- **standard distribution** (SCHED-02): picks standard when at 29%, picks before_after when standard at 71%
- **before_after weekday** (SCHED-03): filtered on Mon/Fri, eligible on Tue
- **promotion cap** (SCHED-04): filtered at 2+/week, back-to-back guard, allows at 1/week
- **availability midweek** (SCHED-05): eligible Tue/Wed/Thu, filtered Mon/Sat/Sun
- **reel bonus** (SCHED-06): score -1, excluded from distribution, never stalls
- **never stall**: fallback to full posts when all candidates filtered

## Key Decisions Made

1. **Reel exclusion from distribution**: The SQL query uses `post_type != 'reel'` in the subquery — reels don't skew the 7-day window that determines what content type to prioritize next.

2. **Never-stall fallback**: If filtering (weekday rules + promo caps) eliminates all candidates, `pickNextPost` falls back to the full unfiltered `posts` array. The scheduler loop must never stop due to content-type scarcity.

3. **Deficit scoring over binary priority**: Instead of a static priority list, each type is scored by `target.min - current_ratio`. Positive score = under-represented = gets picked first. DEFAULT_PRIORITY breaks ties only.

4. **DEFAULT_PRIORITY tiebreaker**: Imported from `scheduler.js` — no duplication of the priority list.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/core/pickNextPost.js` exists
- [x] `src/core/pickNextPost.test.js` exists
- [x] `src/scheduler.js` contains `import { pickNextPost }` and `pickNextPost(due, salonId`
- [x] All 24 tests pass (`npx vitest run src/core/pickNextPost.test.js` exits 0)
- [x] Old `due.sort(getPriorityIndex)` block removed from scheduler.js
- [x] Task commits exist: c07aa96, f84b5ef

## Self-Check: PASSED
