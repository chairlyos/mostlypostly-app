---
phase: 08-calendar-views-and-controls
plan: 03
subsystem: ui
tags: [calendar, agenda, coordinator, luxon, sqlite]

# Dependency graph
requires:
  - phase: 08-02
    provides: week view fragment and switchView() orchestration already wired
provides:
  - GET /agenda returning 30-day date-grouped post list HTML fragment
  - coordinator upload form accepting ?date=YYYY-MM-DD query param
  - date pre-fill and scheduled_for update via POST /coordinator/upload
affects: [calendar-views-and-controls, coordinator-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agenda fragment uses same card-field-* classes as day panel so applyFilters()/applyCardSettings() apply without changes"
    - "openDayPanel() called from inline script in agenda fragment — fragment hands off to existing page-level function"
    - "Date pre-fill in coordinator upload: regex-validated at GET, stored as 10:00 AM salon-local converted to UTC at POST"

key-files:
  created: []
  modified:
    - src/routes/calendar.js
    - src/routes/manager.js

key-decisions:
  - "Agenda cards include data-date attribute so click handler can pass date to openDayPanel() without extra lookup"
  - "Agenda empty state is a simple paragraph (no date groups rendered) — consistent with week/day panel empty states"
  - "scheduled_for set at POST time to 10:00 AM salon-local — advisory pre-scheduling; actual scheduling occurs at manager approval"
  - "salonTzRow fetched inline in POST handler (not reused from earlier in the handler) — salonRow already fetched for AI but scoped to that block"

patterns-established:
  - "Fragment endpoints return inline <script> blocks for post-injection event wiring (same as week view)"

requirements-completed: [CAL-07, CAL-10]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 08 Plan 03: Agenda View and Coordinator Upload Date Pre-fill Summary

**Agenda view at GET /agenda renders a 30-day rolling date-grouped post list; coordinator upload form pre-fills scheduled date from ?date= param**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T22:00:00Z
- **Completed:** 2026-03-21T22:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /agenda returns a fully functional HTML fragment with posts grouped by date-header rows for the next 30 days
- Each agenda card includes thumbnail, stylist/vendor name, time, platform icons, type+status badges, and 120-char caption preview
- Agenda cards use card-field-* classes so the existing filter chips and card display settings apply without any JS changes
- Clicking an agenda card calls openDayPanel(date) to show the day panel for that date
- GET /coordinator/upload accepts ?date=YYYY-MM-DD query param and renders a pre-filled date input
- POST /coordinator/upload saves the scheduled date at 10:00 AM in the salon's timezone, enabling calendar placement

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement GET /agenda endpoint** - `711ad3d` (feat)
2. **Task 2: Add ?date=YYYY-MM-DD support to coordinator upload form** - `d799ea9` (feat)

## Files Created/Modified
- `src/routes/calendar.js` - Replaced stub GET /agenda with full 30-day date-grouped fragment implementation
- `src/routes/manager.js` - Added prefillDate logic to GET handler and scheduled_date handling to POST handler

## Decisions Made
- Agenda cards include `data-date` attribute so the inline click handler can call `openDayPanel(card.dataset.date)` without needing to recalculate the date from the post's timestamp
- Empty state (no posts in 30-day window) renders as a simple paragraph outside any date-group wrapper — consistent with other empty state patterns in the calendar
- `scheduled_for` set to 10:00 AM salon-local at POST time; this is advisory and the scheduler will reassign actual time when the post is approved and enqueued
- The `salonTzRow` query in the POST handler is a targeted `SELECT timezone` — not reusing `salonRow` which is fetched earlier in a different scope block

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 08 is now fully complete: month view (Plan 01), week view (Plan 02), and agenda view + coordinator date pre-fill (Plan 03) are all implemented
- The calendar's "+ Post for this day" link in the day panel already passes ?date= to /coordinator/upload (wired in Plan 01)
- No blockers for future phases

---
*Phase: 08-calendar-views-and-controls*
*Completed: 2026-03-21*
