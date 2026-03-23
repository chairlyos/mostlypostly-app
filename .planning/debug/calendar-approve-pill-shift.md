---
status: diagnosed
trigger: "When clicking Approve on a post card in the calendar day panel, the post pill in the day cell shifts/moves briefly"
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Focus

hypothesis: The Approve link is a full-page `<a href>` navigation that triggers a complete page reload via redirect. SortableJS is initialized on every `.calendar-day-cell` at page load. During the navigation away + return (redirect chain), the browser briefly reflows the calendar DOM before SortableJS re-attaches, and the pill render order can shift because SortableJS uses `animation: 150` and moves DOM nodes.
test: traced code path from Approve click → server redirect → page reload
expecting: confirmed full-page reload cycle is the mechanism
next_action: DONE — diagnosis complete

## Symptoms

expected: Post pill in the day cell stays stable when Approve is clicked in the day panel
actual: Pill briefly shifts/moves position
errors: none (visual regression only)
reproduction: Open calendar, click a day with a pending post, click Approve in the day panel
started: unknown — likely always present

## Eliminated

- hypothesis: The day panel fetch itself causes the shift
  evidence: The shift is in the *calendar grid cell*, not inside the day panel. The panel only sets contentEl.innerHTML which is separate from the grid.
  timestamp: 2026-03-21

- hypothesis: A CSS transition or animation on the pill itself causes the shift
  evidence: Pills have no transition classes. The shift is structural (reflow), not animated.
  timestamp: 2026-03-21

## Evidence

- timestamp: 2026-03-21
  checked: calendar.js line 366–370 — Approve action HTML
  found: Approve is rendered as a plain `<a href="/manager/approve?post=...&return=calendar">` — a full anchor navigation, not a fetch.
  implication: Clicking Approve causes a full page navigation to /manager/approve, which runs the async handleManagerApproval, then does `res.redirect("/manager/calendar")` (line 699–700). This is a two-hop redirect: /manager/approve → /manager/calendar.

- timestamp: 2026-03-21
  checked: manager.js lines 651–701 — /manager/approve handler
  found: Handler is async (awaits handleManagerApproval + optional Twilio SMS). On success it redirects to /manager/calendar. The full calendar page re-renders from scratch.
  implication: The entire page DOM is torn down and rebuilt. SortableJS is re-initialized on every cell.

- timestamp: 2026-03-21
  checked: calendar.js lines 282–305 — SortableJS initialization
  found: `Sortable.create(cell, { animation: 150, ghostClass: 'opacity-40', ... })` is called on every `.calendar-day-cell` at DOMContentLoaded. `animation: 150` means SortableJS applies a CSS transition to pill DOM nodes during its initialization sweep.
  implication: When the page reloads after the redirect, SortableJS re-attaches to all cells. During its init, it measures and animates items into their layout positions. The 150ms animation window is the visible "shift."

- timestamp: 2026-03-21
  checked: calendar.js lines 155–165 — pill rendering
  found: Pills are rendered server-side. Only `manager_approved` posts with `scheduled_for` get `data-draggable="true"`. After approval, the post status changes from `manager_pending` to `manager_approved`, so the newly approved pill now gets `data-draggable="true"` AND becomes subject to SortableJS animation — it wasn't before approval.
  implication: The specific pill that was just approved gets a NEW draggable attribute on the reload. SortableJS treats it as a newly-sortable item and animates it into place, which is the visible shift.

## Resolution

root_cause: SortableJS `animation: 150` runs its placement animation on all draggable pills during initialization after each full-page reload. The pill that was just approved is newly draggable (status changed from manager_pending → manager_approved, so it gains data-draggable="true"), making it subject to SortableJS's enter animation on the reload triggered by the Approve redirect. The shift is SortableJS animating the pill into its sorted position from wherever the browser initially painted it.

fix: Set `animation: 0` on the SortableJS initialization in calendar.js (line 285). This eliminates the initialization animation entirely, which is not needed for grid-cell reordering — the drag ghost already provides sufficient visual feedback. Alternatively, the Approve link could be converted to a fetch+JSON action that updates the post status server-side and patches the day panel HTML in place without a page reload, which would also eliminate the grid reflow.

verification: not yet verified — diagnosis only

files_changed: []
