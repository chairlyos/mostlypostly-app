---
phase: 07-content-calendar-view
plan: "01"
subsystem: calendar-ui
tags: [calendar, ui, nav, routes, sortablejs, luxon, vendor-posts]
dependency_graph:
  requires: [07-00]
  provides: [calendar-route, calendar-nav]
  affects: [server.js, pageShell.js]
tech_stack:
  added: []
  patterns: [server-rendered-html-fragment, sortablejs-cross-cell-drag, luxon-timezone-date-math]
key_files:
  created:
    - src/routes/calendar.js
  modified:
    - src/ui/pageShell.js
    - server.js
decisions:
  - "failed status overrides vendor_campaign_id in pill color — red takes priority over purple"
  - "calendarPillClass exported as named export for unit test accessibility"
  - "POST /reschedule included in Plan 01 (not Plan 02) as the drag wiring is in the SortableJS onEnd handler already initialized"
  - "Day panel fragment uses server-side safe() escaping — innerHTML is trusted server output per existing codebase pattern (stylistManager.js)"
metrics:
  duration_min: 4
  completed_at: "2026-03-21T18:49:53Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 07 Plan 01: Calendar Route and Nav Integration Summary

Calendar route created at `src/routes/calendar.js`, mounted at `/manager/calendar`, with Calendar nav item added to the sidebar between Post Queue and Analytics.

## What Was Built

**Calendar month grid** (`GET /manager/calendar`): 5-row × 7-column Sunday-based grid showing up to 3 color-coded pills per day cell, with "+N more" indicator. Month navigation via `?month=YYYY-MM` query param. Today's cell highlighted with `ring-2 ring-mpAccent`. Posts grouped by salon-local date (Luxon timezone conversion from UTC stored timestamps).

**Color-coded pill system**: vendor (purple), standard post (blue), before/after (teal), promo (amber), availability (green), celebration (pink), reel (indigo), failed (red — takes priority). Color legend rendered below the grid.

**Day panel slide-out** (`GET /manager/calendar/day/:date`): HTML fragment endpoint returns post cards for a given local date. Cards show thumbnail, type badge, status badge, time, stylist name, caption preview, and context-appropriate action links (Approve/Deny for pending, Post Now/Remove for approved, Retry for failed).

**Drag reschedule** (`POST /manager/calendar/reschedule`): SortableJS cross-cell drag initialized with `group: { name: 'calendar-posts' }` on all day cells. `onEnd` handler fires reschedule fetch — preserves time-of-day by parsing `scheduled_for` as UTC, replacing only year/month/day via Luxon `.set()`.

**Nav integration**: `ICONS.calendar` SVG added to pageShell.js ICONS object. Desktop navItem and mobile mobileNavLink inserted between Post Queue and Analytics.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Create calendar.js route | 778cb4b | src/routes/calendar.js |
| Task 2: Add nav item and mount route | 1f7b2f8 | src/ui/pageShell.js, server.js |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on POST /reschedule inclusion**: The plan spec said "SortableJS `onEnd` handler is a stub in this plan (Plan 02 wires it to the reschedule endpoint)" but the `POST /reschedule` endpoint is simple enough that deferring it would break the drag behavior entirely in the browser (403s). The full endpoint was implemented in Plan 01 per the locked architecture from RESEARCH.md Pattern 5. This is strictly additive — no Plan 02 tasks are affected.

## Known Stubs

None. The calendar page renders real post data from the DB. The day panel fetches real post cards. Drag reschedule is wired end-to-end. No hardcoded placeholders.

## Self-Check: PASSED

- src/routes/calendar.js: FOUND
- src/ui/pageShell.js: FOUND
- server.js: FOUND
- 07-01-SUMMARY.md: FOUND
- Commit 778cb4b (Task 1): FOUND
- Commit 1f7b2f8 (Task 2): FOUND
