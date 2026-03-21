---
phase: 08-calendar-views-and-controls
plan: 02
subsystem: ui
tags: [calendar, week-view, sortablejs, fragment, client-side-js]

requires:
  - phase: 08-calendar-views-and-controls
    plan: 01
    provides: view toggle, filter bar, card settings, stub GET /week endpoint, #calendar-view-body swap container

provides:
  - GET /week fragment: 7-column Sun-Sat grid with all posts for the requested week
  - Week navigation (prev/next) via data-week-nav buttons, fetch-based fragment swap
  - SortableJS drag-to-reschedule wired on week cells
  - Day cell click opens day panel (window.openDayPanel)
  - window.applyFilters and window.applyCardSettings exposed for fragment re-apply
  - switchView() updated to pass ?week= param when switching to week view

affects: [08-03-agenda-view]

tech-stack:
  added: []
  patterns:
    - "GET /week returns HTML fragment (not full page); swapped into #calendar-view-body by switchView() in main IIFE"
    - "Week nav buttons carry data-week-nav=YYYY-MM-DD; click handler fetches new week fragment and re-applies filters/card settings"
    - "Inline <script> block at end of fragment initializes SortableJS and wires day-cell click — same pattern as month-view inline script"
    - "window.applyFilters and window.applyCardSettings assigned just before function declarations so fragment scripts can call them after DOM swap"
    - "Luxon weekday 7 = Sunday; weekStart calculated as now.minus({ days: now.weekday }) when weekday != 7"

key-files:
  created: []
  modified:
    - src/routes/calendar.js

key-decisions:
  - "window.applyFilters assigned before function body — placed as first statement of applyFilters definition block; same for applyCardSettings"
  - "Inline <script> inside fragment closes with <\/script> (escaped forward slash) to avoid premature template literal end in JS string"
  - "Week cells show time badge for scheduled/pending posts (not just published) — more useful context in the denser week grid than month view"
  - "No 3-post limit in week cells — plan explicitly requires showing ALL posts per day"

requirements-completed:
  - CAL-06

duration: 6min
completed: 2026-03-21
---

# Phase 08 Plan 02: Week View Summary

**Week view fragment at GET /week returns a 7-column Sun-Sat grid with all posts, week nav arrows, SortableJS drag-to-reschedule on each cell, and day-panel click — same mini-card style as month view**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T21:33:01Z
- **Completed:** 2026-03-21T21:39:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced stub GET /week (single-line placeholder) with full 209-line implementation
- Fragment includes navigation row with prev/next week buttons carrying data-week-nav attributes
- 7-column grid with day-of-week headers ("Sun 3/22" format) and cells at min-h-[200px]
- Post mini-cards identical to month view: color bar, type label, stylist, caption preview, platform icons — same data-post-type/data-status attributes so existing filter logic works without changes
- SortableJS Sortable.create() called on each week cell inside the fragment's inline script
- Day cell click calls window.openDayPanel() — consistent with month view behavior
- Exposed window.applyFilters and window.applyCardSettings from the main page IIFE so the week fragment's script can re-apply them after DOM swap
- Updated switchView() to carry ?week= query param when switching to week view so the correct week loads on toggle

## Task Commits

1. **Task 1: Implement GET /week endpoint** - `81f860c` (feat)

## Files Created/Modified

- `src/routes/calendar.js` — replaced stub /week handler with full implementation; exposed applyFilters/applyCardSettings to window; updated switchView() week param handling

## Decisions Made

- window.applyFilters/applyCardSettings assigned as first statement inside the function definition block (just before the function body) — hoists the window reference immediately when the IIFE runs
- Week cells show scheduled time badge for all non-published posts (manager_approved and manager_pending) in addition to the published checkmark — the denser week grid benefits from more temporal context than month view
- No post count limit per day cell (plan requirement: no "+N more" truncation in week view, unlike 3-post limit in month view)
- Inline script tag in the template literal uses `<\/script>` to avoid JavaScript string parsing issues with `</script>` inside a template literal

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - the GET /week endpoint is fully implemented.

## User Setup Required

None.

## Next Phase Readiness

- Phase 08 Plan 03 (Agenda View) can follow the same fragment pattern: GET /agenda returns HTML, swapped into #calendar-view-body, window.applyFilters/applyCardSettings re-applied after swap
- The day panel click pattern (window.openDayPanel) is available for agenda cards

---
*Phase: 08-calendar-views-and-controls*
*Completed: 2026-03-21*
