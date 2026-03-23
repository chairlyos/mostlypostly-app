---
status: diagnosed
trigger: "In the calendar day panel, there is no Deny button for pending posts — only a Remove button. Clicking Remove navigates to the main dashboard instead of staying on the calendar."
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Focus

hypothesis: The day panel renders a "Deny" button correctly for pending posts, but the "Remove" link on manager_approved posts calls /manager/cancel-post which hard-redirects to /manager with no return-to-calendar support. The Deny button and inline form for pending posts are already implemented. The Remove issue is in /manager/cancel-post itself.
test: N/A — confirmed by reading code
expecting: N/A
next_action: Return diagnosis to caller

## Symptoms

expected: A "Deny" button appears on pending posts in the day panel; clicking it reveals inline deny reason form without navigating away; after submitting, user stays on the calendar. Remove button on approved posts should also stay on calendar.
actual: Remove button navigates away to main dashboard.
errors: No JS error — wrong redirect URL.
reproduction: Open calendar day panel, click Remove on a manager_approved post.
started: Unknown / likely since calendar feature shipped.

## Eliminated

- hypothesis: Deny button is absent from calendar day panel
  evidence: calendar.js lines 366-385 render Deny button + inline hidden form for manager_pending posts. The inline form posts to /manager/deny with hidden input name="return" value="calendar". /manager/deny at line 847-848 of manager.js already handles return=calendar correctly.
  timestamp: 2026-03-21

## Evidence

- timestamp: 2026-03-21
  checked: src/routes/calendar.js lines 365-402
  found: manager_pending posts DO get both "Approve", "Deny", and "Post Now" action links, plus an inline hidden deny form (lines 376-385). The deny form correctly passes name="return" value="calendar" and posts to /manager/deny.
  implication: Deny is already implemented in the calendar. The bug report's first claim (no Deny button) may be stale or referring to a different issue.

- timestamp: 2026-03-21
  checked: src/routes/calendar.js lines 386-393 (manager_approved actions)
  found: manager_approved posts render: "Post Now" link with &return=calendar, and "Remove" link pointing to /manager/cancel-post?post=<id> — NO return parameter appended.
  implication: Remove on approved posts will hit /manager/cancel-post, which always redirects to /manager regardless.

- timestamp: 2026-03-21
  checked: src/routes/manager.js line 745-753 (GET /cancel-post handler)
  found: Handler reads req.query.post, cancels the post, then unconditionally redirects to `/manager?salon=<salon_id>`. There is NO req.query.return handling — unlike /manager/approve (line 664, 699), /manager/post-now (line 721), /manager/retry-post (line 770), and /manager/deny (line 818, 847) which all check for return=calendar.
  implication: This is the root cause of the redirect-away bug. The Remove link and the handler both lack return-to-calendar support.

## Resolution

root_cause: Two independent issues:
  1. (Minor / may already be fixed in current code) calendar.js line 366-385 — Deny button IS present for manager_pending posts with a working inline form. If the user sees "Remove" instead of "Deny", they may be looking at a manager_approved post (which correctly shows Remove, not Deny).
  2. (Confirmed bug) calendar.js line 392 — the "Remove" link for manager_approved posts does NOT pass a return=calendar query param. AND manager.js line 753 — GET /cancel-post unconditionally redirects to /manager, with no req.query.return check. Every other action handler (approve, post-now, deny, retry) has this check; cancel-post was missed.

fix: Two-part fix:
  Part 1 — calendar.js line 392: Change the Remove href from
    /manager/cancel-post?post=<id>
  to
    /manager/cancel-post?post=<id>&return=calendar

  Part 2 — manager.js GET /cancel-post handler (line 753): Change the unconditional redirect from
    return res.redirect(`/manager?salon=...`);
  to respect the return param:
    const returnTo = req.query.return === "calendar" ? "/manager/calendar" : "/manager";
    return res.redirect(returnTo);

verification: Not yet applied (diagnose-only mode)
files_changed: []
