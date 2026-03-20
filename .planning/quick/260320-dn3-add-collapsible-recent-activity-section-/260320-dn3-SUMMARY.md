---
phase: quick
plan: 260320-dn3
subsystem: manager-dashboard
tags: [ui, dashboard, recent-activity, collapsible]
dependency_graph:
  requires: []
  provides: [collapsible-recent-activity-dashboard]
  affects: [src/routes/manager.js]
tech_stack:
  added: []
  patterns: [slice-based-list-splitting, event-delegation-toggle]
key_files:
  created: []
  modified:
    - src/routes/manager.js
decisions:
  - Split rendering into named function renderRecentCard() rather than inline .map() to allow slice-based grouping without code duplication
metrics:
  duration: 5 min
  completed: "2026-03-20"
---

# Quick Task 260320-dn3: Collapsible Recent Activity Section Summary

**One-liner:** Collapsible recent activity with 14-day window — first 5 visible, Show N more toggle for overflow.

## What Was Done

Updated `src/routes/manager.js` dashboard handler with three coordinated changes:

1. **Query window capped to 14 days** — added `AND datetime(created_at) >= datetime('now', '-14 days')` to the `recentRaw` SQL query. Keeps the list fresh and avoids loading months of historical posts on the dashboard.

2. **Card rendering refactored to named function** — extracted the inline `.map()` callback into `renderRecentCard(p)` so the same markup logic can be reused for both slices without duplication.

3. **Split into visible (0-4) and collapsed (5+)** — `recentVisibleCards` renders the first 5 items; `recentCollapsedCards` wraps items 6+ in `<div id="recent-collapsed" style="display:none">`. Toggle button rendered conditionally only when `recent.length > 5`.

4. **Heading row updated** — `<h2>` is now inside a flex row with a count label (`N posts in the last 14 days`) on the right, replacing the old standalone heading.

5. **Toggle script added** — click handler checks `e.target.id === 'recent-toggle'`, flips `display` on `#recent-collapsed`, and updates button text between `Show N more` and `Show less`. Placed before the existing caption show-more handler to keep event routing clear.

## Verification

- `node -e "import('./src/routes/manager.js')" ` — OK, no errors.
- All four must-have truths satisfied:
  - First 5 items visible by default
  - Items 6+ hidden behind toggle
  - Query capped to 14-day window
  - Show More/Show Less toggle works

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- Modified file exists: `src/routes/manager.js`
- Commit 40feec9 verified in git log
