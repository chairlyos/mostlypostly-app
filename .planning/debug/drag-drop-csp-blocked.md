---
status: resolved
trigger: "Drag-to-reschedule not working in calendar day cells; SortableJS drag-and-drop also broken in Post Queue"
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Focus

hypothesis: CSP scriptSrc does not include cdn.jsdelivr.net — SortableJS CDN load is blocked silently in both pages
test: confirmed via git log — CSP added 2026-03-10 (f5f0d8e) the day AFTER Post Queue was added (074dae8 on 2026-03-09); cdn.jsdelivr.net absent from scriptSrc throughout history
expecting: adding cdn.jsdelivr.net to scriptSrc resolves both bugs simultaneously
next_action: DONE — root cause confirmed, no fix applied per instructions

## Symptoms

expected: Calendar posts with status=manager_approved and a scheduled_for value can be dragged between day cells; Post Queue posts can be drag-sorted with SortableJS
actual: Dragging does nothing in both /manager/calendar and /manager/queue
errors: Browser console would show "Refused to load the script 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js' because it violates the following Content Security Policy directive: 'script-src ...'"
reproduction: Visit /manager/calendar or /manager/queue; open browser DevTools console; attempt to drag a post pill or queue card
started: 2026-03-10 when CSP was introduced in commit f5f0d8e (Security hardening)

## Eliminated

- hypothesis: SortableJS initialization code in calendar.js is buggy
  evidence: Code is correct — Sortable.create() called per cell with correct group/draggable/onEnd config; problem is the library never loads
  timestamp: 2026-03-21

- hypothesis: The inline onclick CSP fix (commit 08a0a07) introduced the regression
  evidence: That commit only touched calendar.js (event delegation swap); did not touch server.js CSP; Post Queue was already broken since 2026-03-10
  timestamp: 2026-03-21

## Evidence

- timestamp: 2026-03-21
  checked: server.js lines 120-141 (Helmet CSP configuration)
  found: scriptSrc = ["'self'", "https://cdn.tailwindcss.com", "https://cdn.socket.io", "'unsafe-inline'"] — cdn.jsdelivr.net is absent
  implication: Any script loaded from cdn.jsdelivr.net is blocked by the browser with a CSP violation error

- timestamp: 2026-03-21
  checked: src/routes/postQueue.js line 167
  found: <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js">
  implication: SortableJS library load blocked; Sortable is undefined at runtime; drag-and-drop silently non-functional

- timestamp: 2026-03-21
  checked: src/routes/calendar.js lines 239, 283
  found: Same CDN URL at line 239; Sortable.create() called at line 283
  implication: SortableJS blocked; Sortable.create() throws ReferenceError at runtime; no drag behavior initializes

- timestamp: 2026-03-21
  checked: git log -- server.js
  found: CSP added in commit f5f0d8e on 2026-03-10; Post Queue (with SortableJS CDN) added in commit 074dae8 on 2026-03-09
  implication: Post Queue was broken from the moment CSP was deployed — one day after Post Queue was created; Calendar inherited the same breakage

## Resolution

root_cause: The Helmet CSP scriptSrc directive in server.js (lines 125-126) does not include https://cdn.jsdelivr.net. Both /manager/queue (postQueue.js line 167) and /manager/calendar (calendar.js line 239) load SortableJS from https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js. The browser blocks this CDN load silently — no script error in app code, only a CSP console violation. Sortable is undefined when the page JS runs, so drag-and-drop never initializes on either page.

fix: Add "https://cdn.jsdelivr.net" to the scriptSrc array in server.js Helmet CSP configuration (line 126). One-character change to one file.

verification: not applied (diagnose-only per user instructions)

files_changed: []
