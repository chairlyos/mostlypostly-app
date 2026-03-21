---
phase: 07-content-calendar-view
plan: 03
subsystem: ui
tags: [calendar, sortablejs, csp, helmet, drag-drop]

# Dependency graph
requires:
  - phase: 07-content-calendar-view
    provides: "Phase 07 Plan 02 — calendar day panel with approve/deny/post-now actions and SortableJS drag wiring"
provides:
  - "CSP allowlist includes cdn.jsdelivr.net — SortableJS loads on /manager/calendar and /manager/queue"
  - "SortableJS animation:0 eliminates pill position shift on drag initialization"
  - "Remove link on approved day-panel posts returns to /manager/calendar via return=calendar param"
affects:
  - 07-content-calendar-view

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "return=calendar query param convention — all cancel/action links in calendar context append this param; handler checks req.query.return === 'calendar' to redirect back"

key-files:
  created: []
  modified:
    - server.js
    - src/routes/calendar.js
    - src/routes/manager.js

key-decisions:
  - "animation:0 (not animation:150) — SortableJS animation param controls item enter/leave transitions during init, not drag feedback; setting 0 prevents layout shift on page render after approval"
  - "cdn.jsdelivr.net added to CSP scriptSrc — single allowlist entry unblocks SortableJS on both calendar and post queue pages simultaneously"

patterns-established:
  - "return=calendar pattern: all action hrefs in /manager/calendar day panel append &return=calendar; each manager.js GET handler checks req.query.return === 'calendar' before deciding redirect target"

requirements-completed:
  - CAL-04
  - CAL-05

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 07 Plan 03: Gap Closure (CSP + Pill Shift + Remove Return) Summary

**Three surgical UAT gap fixes: CSP unblocks SortableJS CDN on calendar and queue, animation:0 eliminates pill shift on approve, Remove link returns to calendar instead of /manager**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T20:02:15Z
- **Completed:** 2026-03-21T20:03:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `https://cdn.jsdelivr.net` to Helmet CSP `scriptSrc` — unblocks SortableJS on both `/manager/calendar` and `/manager/queue` without any other CSP changes
- Changed SortableJS `animation: 150` to `animation: 0` in calendar.js — eliminates the layout shift that caused newly-approved post pills to visually jump on panel reload
- Added `&return=calendar` to the Remove href for `manager_approved` posts in the day panel, and updated GET `/cancel-post` in manager.js to redirect to `/manager/calendar` when `req.query.return === 'calendar'`

## Task Commits

1. **Task 1: Fix CSP to allow SortableJS CDN** - `06f3f4c` (fix)
2. **Task 2: Fix pill shift (animation:0) and Remove return-to-calendar** - `92512ef` (fix)

## Files Created/Modified

- `server.js` - Added `https://cdn.jsdelivr.net` to Helmet CSP scriptSrc array
- `src/routes/calendar.js` - Changed SortableJS `animation: 150` to `animation: 0`; appended `&return=calendar` to Remove href for `manager_approved` posts
- `src/routes/manager.js` - Updated GET `/cancel-post` to check `req.query.return === 'calendar'` and redirect accordingly (matches pattern already used by approve, post-now, deny, retry-post)

## Decisions Made

- `animation: 0` chosen over removing the animation param entirely — explicit 0 is clearest intent; SortableJS drag feedback is provided by ghostClass, not the animation param
- No other CSP directives touched — only scriptSrc needed cdn.jsdelivr.net; single, minimal change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three UAT gaps closed — Phase 07 calendar feature is fully functional
- SortableJS drag works on both calendar and post queue
- No regressions in adjacent features (post queue reorder still functional, same CDN fix applies)

---
*Phase: 07-content-calendar-view*
*Completed: 2026-03-21*
