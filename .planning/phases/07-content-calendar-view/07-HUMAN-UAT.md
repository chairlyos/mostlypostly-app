---
status: partial
phase: 07-content-calendar-view
source: [07-VERIFICATION.md]
started: 2026-03-21T16:06:00Z
updated: 2026-03-21T16:06:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CSP console check
expected: Navigate to /manager/calendar, open DevTools, confirm no CDN CSP errors for cdn.jsdelivr.net
result: [pending]

### 2. Drag-to-reschedule
expected: Drag an approved post pill to a new day, confirm reschedule fires and persists
result: [pending]

### 3. Approve without pill shift
expected: Approve a pending post from day panel, confirm no visual jump on reload
result: [pending]

### 4. Remove returns to calendar
expected: Click Remove on approved post in day panel, confirm URL stays at /manager/calendar
result: [pending]

### 5. Post queue regression
expected: Navigate to /manager/queue, confirm drag-sort still works (same CSP fix)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
