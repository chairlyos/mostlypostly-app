---
phase: quick
plan: 260322-sl4
subsystem: dashboard
tags: [timezone, dashboard, recent-activity, upcoming-promos]
dependency_graph:
  requires: []
  provides: [timezone-aware dashboard timestamps]
  affects: [manager dashboard GET route]
tech_stack:
  added: []
  patterns: [luxon setZone for UTC→local conversion]
key_files:
  modified:
    - src/routes/manager.js
decisions:
  - Read timezone from salonRow in the same SELECT that fetches plan/phone — avoids a second DB query
metrics:
  duration: 3 min
  completed: 2026-03-22
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260322-sl4: Fix Recent Activity Showing Incorrect Local Time — Summary

**One-liner:** Dashboard recent activity and upcoming promo timestamps now convert from UTC to salon's configured timezone via luxon `.setZone(tz)`.

## What Was Done

### Task 1: Fix timezone-aware formatting in dashboard GET route

Four targeted edits to `src/routes/manager.js`:

1. Added `timezone` to the `salonRow` SELECT query (line 161) so the dashboard handler fetches it in the same query as plan/phone.
2. Defined `const tz = salonRow?.timezone || "America/Indiana/Indianapolis"` immediately after the query — fallback matches the pattern used elsewhere in the file.
3. Updated `fmt()` helper to call `.setZone(tz)` before `.toFormat()` — recent activity cards now display local time.
4. Updated the upcoming promos inline formatter to call `.setZone(tz)` before `.toFormat()` — promo scheduled times now display local time.

No new imports were needed — luxon `DateTime` was already imported at the top of the file.

## Verification

- Node import check passed (exit 0, no syntax errors)
- All four changes confirmed via grep after editing

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/routes/manager.js` modified: FOUND
- Commit `4a34237`: FOUND
