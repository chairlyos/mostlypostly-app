---
phase: 05-guest-care-and-support-staff
plan: 01
subsystem: database
tags: [sqlite, migrations, coordinator, posts, better-sqlite3]

# Dependency graph
requires: []
provides:
  - submitted_by TEXT column on posts table (FK to managers.id)
  - savePost() accepts and stores submitted_by from stylist payload
  - lookupStylist() returns isCoordinator: boolean on result.stylist
affects:
  - 05-02 (coordinator SMS routing — depends on isCoordinator flag)
  - 05-03 (leaderboard scoring — depends on submitted_by attribution)
  - src/core/messageRouter.js (will branch on isCoordinator)
  - src/scheduler.js (submitted_by passed through enqueuePost)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration guard pattern: PRAGMA table_info + includes() check before ALTER TABLE"
    - "Coordinator detection: separate SELECT role query after manager phone match rather than extending the JOIN"

key-files:
  created:
    - migrations/049_coordinator_submitted_by.js
  modified:
    - src/core/storage.js
    - migrations/index.js
    - src/core/salonLookup.js

key-decisions:
  - "Separate SELECT role query for coordinator detection — avoids altering the existing manager JOIN shape; one extra synchronous DB hit is acceptable"
  - "submitted_by defaults NULL — fully backward compatible; all existing and stylist-submitted posts unaffected"
  - "isCoordinator guarded by isManager && — stylists can never accidentally receive coordinator flag"

patterns-established:
  - "Pattern: coordinator detection uses _isCoordinator on the raw row, then isCoordinator on the public stylist object — keeps the private DB field separate from the API contract"

requirements-completed: [COORD-01, COORD-02, COORD-03]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 05 Plan 01: Coordinator DB Foundation Summary

**submitted_by FK on posts plus isCoordinator flag in lookupStylist — complete data-layer plumbing for all downstream coordinator features**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T15:30:10Z
- **Completed:** 2026-03-20T15:32:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 049 adds `submitted_by TEXT REFERENCES managers(id)` to the posts table with an idempotency guard
- `savePost()` wires `stylist?.submitted_by || null` through the `insertPostStmt` payload — coordinators can attribute posts; NULL for all other submitters
- `lookupStylist()` detects coordinator role via a targeted `SELECT role FROM managers` query and surfaces `isCoordinator: boolean` on the returned stylist object

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 049 and wire submitted_by into savePost** - `83e6395` (feat)
2. **Task 2: Add coordinator detection to lookupStylist** - `ba5a569` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `migrations/049_coordinator_submitted_by.js` - Adds `submitted_by TEXT REFERENCES managers(id)` to posts with idempotency guard
- `migrations/index.js` - Registers migration 049 in the ordered migration list
- `src/core/storage.js` - Adds `submitted_by` to `insertPostStmt` columns and VALUES; wires through `savePost()` payload
- `src/core/salonLookup.js` - Coordinator role check after manager phone match; `isCoordinator` property on returned stylist object

## Decisions Made
- Separate `SELECT role FROM managers` query for coordinator detection rather than extending the existing JOIN — avoids changing the JOIN shape and keeps the diff minimal
- `submitted_by` defaults to NULL — backward compatible with all existing post saves; only coordinator-submitted posts will have a value
- `isCoordinator` guarded by `isManager &&` — the stylist (non-manager) path never sets `_isCoordinator` on the row, so non-managers always get `false`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration runs automatically on next server start.

## Next Phase Readiness
- All three coordinator primitives are in place: `submitted_by` column, `savePost` wiring, `isCoordinator` flag
- Phase 05-02 (coordinator SMS routing) can now branch on `result.stylist.isCoordinator` from `lookupStylist()`
- Phase 05-03 (leaderboard scoring) can query `submitted_by` to attribute coordinator activity

---
*Phase: 05-guest-care-and-support-staff*
*Completed: 2026-03-20*
