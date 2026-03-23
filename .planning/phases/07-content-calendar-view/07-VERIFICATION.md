---
phase: 07-content-calendar-view
verified: 2026-03-21T21:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: true
  previous_status: passed
  previous_score: 6/6
  note: "Previous 'passed' was written before UAT ran. UAT found 3 real gaps (CSP blocking SortableJS, pill shift, Remove redirect). Gap-closure plan 03 applied all three fixes. This re-verification confirms all fixes exist in the codebase and all original truths still hold."
  gaps_closed:
    - "SortableJS loads without CSP violation on /manager/calendar and /manager/queue"
    - "Approved posts in calendar day cells can be dragged to a new day (SortableJS unblocked)"
    - "Post pill does not shift when Approve is clicked (animation: 0)"
    - "Remove button on approved day-panel post returns to /manager/calendar (return=calendar param)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /manager/calendar — open browser DevTools console — confirm no CSP violation for cdn.jsdelivr.net"
    expected: "Console shows no CSP errors; SortableJS loads cleanly from cdn.jsdelivr.net"
    why_human: "CSP fix is code-verified but runtime browser enforcement requires live browser execution"
  - test: "Drag an approved post pill to a different day cell on the calendar"
    expected: "Pill moves visually to new cell; POST /manager/calendar/reschedule fires; refreshing calendar shows post on the new date at the same time-of-day"
    why_human: "SortableJS drag interaction, CDN load at runtime, and DB persistence require browser + live data"
  - test: "Click Approve on a manager_pending post in the day panel"
    expected: "Post approves and browser returns to /manager/calendar; no pill position shift on reload"
    why_human: "Redirect behavior and visual absence of layout shift require live session and browser rendering"
  - test: "Click Remove on a manager_approved post in the day panel"
    expected: "Browser returns to /manager/calendar, not /manager"
    why_human: "Redirect path requires live session"
  - test: "Navigate to /manager/queue and drag-sort posts"
    expected: "SortableJS drag-sort works on post queue (same CSP fix unblocks both pages simultaneously)"
    why_human: "Post queue is a regression test for the CSP fix — requires browser + live data"
---

# Phase 7: Content Calendar View — Re-Verification Report

**Phase Goal:** Managers can see all scheduled and published posts on a visual 4-week calendar, click any day to preview posts in a slide-out panel, approve/deny/post-now directly from the panel, and drag-drop posts to reschedule them (FEAT-018)
**Verified:** 2026-03-21T21:00:00Z
**Status:** human_needed (all automated checks pass; 5 items need live browser confirmation)
**Re-verification:** Yes — after UAT-identified gap closure (plan 03)

---

## Context

The previous VERIFICATION.md was written before UAT ran and incorrectly reported `status: passed`. UAT (`07-UAT.md`) subsequently identified 3 real issues:

1. SortableJS drag not working on calendar or post queue — root cause: Helmet CSP missing `cdn.jsdelivr.net` in scriptSrc (severity: major)
2. No Deny button / Remove redirected to `/manager` instead of calendar — root cause: Remove href missing `&return=calendar`; cancel-post handler hardcoded redirect (severity: major)
3. Pill shift when Approve clicked — root cause: `animation: 150` in SortableJS init (severity: minor)

Gap-closure plan 07-03 was executed. Commits `06f3f4c` and `92512ef` applied all three fixes. This re-verification confirms every fix is present in the codebase and all original truths hold.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Manager can navigate to /manager/calendar and see a 4-week month grid | VERIFIED | `GET /` handler in calendar.js builds 5-week Sunday-based grid using Luxon; mounted at `app.use("/manager/calendar", calendarRoute)` server.js line 447 |
| 2 | Each day cell shows thumbnail pills for that day's posts, color-coded by type | VERIFIED | `calendarPillClass()` and `calendarPillLabel()` functions fully implemented; all 8 post types mapped; pills rendered per cell from `byDate` Map |
| 3 | Vendor posts display a purple pill with vendor name | VERIFIED | `if (post.vendor_campaign_id) return "bg-purple-100 text-purple-700 border-purple-200"` in calendarPillClass; vendor_name from LEFT JOIN vendor_campaigns |
| 4 | Calendar nav item appears between Post Queue and Analytics in sidebar | VERIFIED | pageShell.js line 155: `navItem("/manager/calendar", ICONS.calendar, "Calendar", "calendar")` between queue and analytics |
| 5 | Clicking a day opens a panel with post cards, image, type badge, status, and actions | VERIFIED | `GET /day/:date` returns HTML fragment with thumbnail, typeLabel, statusBadge, timeDisplay, caption preview, and action buttons per status |
| 6 | Drag-to-reschedule changes date while preserving time-of-day | VERIFIED | `POST /reschedule` uses Luxon `.set({ year, month, day })` to swap date only; SortableJS onEnd fires fetch to this endpoint |
| 7 | SortableJS loads without CSP violation on /manager/calendar and /manager/queue | VERIFIED | server.js line 126: `https://cdn.jsdelivr.net` present in scriptSrc allowlist (commit 06f3f4c) |
| 8 | Post pill does not shift when Approve is clicked | VERIFIED | calendar.js line 286: `animation: 0` — no `animation: 150` anywhere in the file (commit 92512ef) |
| 9 | Remove on an approved day-panel post returns to /manager/calendar | VERIFIED | calendar.js line 391: `href="/manager/cancel-post?post=${safe(p.id)}&return=calendar"`; manager.js line 753: `req.query.return === 'calendar' ? '/manager/calendar' : ...` (commit 92512ef) |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/routes/calendar.js` | Calendar route handler with GET / month grid, GET /day/:date fragment, POST /reschedule, SortableJS animation:0 | VERIFIED | 457 lines; all three handlers present; `animation: 0` at line 286; no `animation: 150` remaining |
| `src/ui/pageShell.js` | Calendar nav item and ICONS.calendar SVG | VERIFIED | ICONS.calendar present; navItem at line 155 (desktop); mobileNavLink present |
| `server.js` | Calendar route mounted at /manager/calendar; cdn.jsdelivr.net in CSP scriptSrc | VERIFIED | Import line 89; mount line 447; cdn.jsdelivr.net line 126 |
| `src/routes/manager.js` | Approve/post-now/deny/retry/cancel-post with return=calendar redirect support | VERIFIED | cancel-post handler line 753 checks `req.query.return === 'calendar'`; 5 action handlers all support the pattern |
| `src/routes/calendar.test.js` | Unit test suite for calendar business logic | VERIFIED | File exists; tests calendarPillClass, UTC date range, reschedule date math |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server.js | src/routes/calendar.js | `import calendarRoute` + `app.use("/manager/calendar")` | WIRED | Line 89 (import) + line 447 (mount) |
| server.js CSP | cdn.jsdelivr.net/npm/sortablejs | Helmet scriptSrc allowlist | WIRED | `"https://cdn.jsdelivr.net"` at line 126 (commit 06f3f4c) |
| src/routes/calendar.js | db.js | LEFT JOIN vendor_campaigns query | WIRED | `LEFT JOIN vendor_campaigns vc ON p.vendor_campaign_id = vc.id` in both GET / and GET /day/:date handlers |
| src/ui/pageShell.js | /manager/calendar | navItem + mobileNavLink entries | WIRED | Desktop nav line 155, mobile nav present |
| GET /day/:date approve link | src/routes/manager.js GET /approve | href with `return=calendar` | WIRED | `href="/manager/approve?post=${safe(p.id)}&return=calendar"` line 368 |
| GET /day/:date deny form | src/routes/manager.js POST /deny | hidden input `name="return" value="calendar"` | WIRED | Line 380: `<input type="hidden" name="return" value="calendar" />` |
| GET /day/:date post-now link | src/routes/manager.js GET /post-now | href with `return=calendar` | WIRED | Lines 372 and 388 |
| GET /day/:date remove link | src/routes/manager.js GET /cancel-post | href with `return=calendar` | WIRED | Line 391: `&return=calendar` appended (commit 92512ef) |
| manager.js GET /cancel-post | /manager/calendar | `req.query.return === 'calendar'` check | WIRED | Line 753 (commit 92512ef) |
| SortableJS onEnd | POST /manager/calendar/reschedule | fetch with postId and newDate | WIRED | `fetch('/manager/calendar/reschedule', { method: 'POST', body: JSON.stringify({ postId, newDate }) })` |

---

### Requirements Coverage

CAL-01 through CAL-05 are declared in plan frontmatter but remain absent from REQUIREMENTS.md (no CAL-xx entries found). This is an unchanged documentation gap noted in the previous verification. The ROADMAP.md phase goal is the authoritative specification; the implementation satisfies it.

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| CAL-01 | 07-00-PLAN, 07-01-PLAN | SATISFIED (not in REQUIREMENTS.MD) | Month grid with color-coded pills fully implemented |
| CAL-02 | 07-01-PLAN | SATISFIED (not in REQUIREMENTS.MD) | Vendor posts show purple pill from vendor_campaign_id LEFT JOIN |
| CAL-03 | 07-02-PLAN | SATISFIED (not in REQUIREMENTS.MD) | GET /day/:date returns full post card fragment with all fields |
| CAL-04 | 07-02-PLAN, 07-03-PLAN | SATISFIED (not in REQUIREMENTS.MD) | Approve/deny/post-now/retry/cancel-post all support return=calendar |
| CAL-05 | 07-00-PLAN, 07-02-PLAN, 07-03-PLAN | SATISFIED (not in REQUIREMENTS.MD) | POST /reschedule preserves time-of-day; SortableJS unblocked by CSP fix |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| calendar.js | 381 | `placeholder="Reason for denial..."` | INFO | HTML textarea placeholder — user-facing helper text, not a code stub |

No FIXME/TODO comments. No `await db.prepare()` calls (synchronous DB used correctly). No `require()` calls (ESM throughout). No hardcoded empty data flowing to render. No `animation: 150` remaining in calendar.js.

---

### Human Verification Required

#### 1. CSP unblocked — SortableJS loads clean

**Test:** Log into manager portal, navigate to `/manager/calendar`, open browser DevTools (F12) → Console tab
**Expected:** No CSP errors mentioning `cdn.jsdelivr.net`; SortableJS CDN script loads with HTTP 200
**Why human:** Runtime browser CSP enforcement cannot be verified by static code grep

#### 2. Drag-to-reschedule on calendar

**Test:** Find a manager_approved post pill (blue "Scheduled" badge) and drag it from its current day cell to a different day cell
**Expected:** Pill moves to the new cell; POST /manager/calendar/reschedule fires (visible in DevTools Network); refreshing the calendar shows the post on the new date at the original time-of-day
**Why human:** SortableJS drag interaction, CDN load at runtime, and DB write require browser + live data

#### 3. Approve from day panel — no pill shift

**Test:** Find a `manager_pending` post in the day panel, click Approve
**Expected:** Post approves; browser returns to `/manager/calendar`; on reload, the newly-approved pill is in its correct position without any visual jumping or shifting
**Why human:** SortableJS init animation (`animation: 0`) fix requires visual confirmation; layout behavior depends on browser rendering

#### 4. Remove from day panel returns to calendar

**Test:** Find a `manager_approved` post in the day panel, click Remove, confirm the dialog
**Expected:** Browser stays on `/manager/calendar` (URL does not change to `/manager`)
**Why human:** Redirect behavior requires live session

#### 5. Post Queue drag-sort regression check

**Test:** Navigate to `/manager/queue`, drag a post card to a different position
**Expected:** SortableJS drag works; post reorders; no CSP errors in console
**Why human:** Post queue uses the same cdn.jsdelivr.net CDN — this is the regression test confirming the CSP fix unblocks both pages simultaneously

---

### Gap Closure Summary (vs. Previous Verification)

Three UAT-identified gaps were closed in gap-closure plan 03:

**Gap 1 — CSP blocking SortableJS (CLOSED)**
- Root cause: `cdn.jsdelivr.net` missing from Helmet `scriptSrc`
- Fix: Added `"https://cdn.jsdelivr.net"` to scriptSrc array in server.js line 126
- Commit: `06f3f4c`
- Verified: grep confirms presence at correct location

**Gap 2 — Pill shift on Approve (CLOSED)**
- Root cause: `animation: 150` causing SortableJS init animation on every page load
- Fix: Changed to `animation: 0` in calendar.js line 286
- Commit: `92512ef`
- Verified: `animation: 0` at line 286; no `animation: 150` in file

**Gap 3 — Remove redirected to /manager instead of /calendar (CLOSED)**
- Root cause: Remove href missing `&return=calendar`; cancel-post handler hardcoded redirect
- Fix A: Appended `&return=calendar` to Remove href in calendar.js line 391
- Fix B: Added `req.query.return === 'calendar'` check to cancel-post handler in manager.js line 753
- Commit: `92512ef`
- Verified: both patterns confirmed in respective files

**Regression check:** All 6 original truths from the first verification remain intact. No regressions introduced by the gap-closure changes.

---

_Verified: 2026-03-21T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after UAT gap closure (plan 03)_
