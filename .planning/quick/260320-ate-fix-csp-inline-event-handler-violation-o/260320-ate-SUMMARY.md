---
phase: quick-260320-ate
plan: 1
subsystem: vendor-admin
tags: [csp, security, event-delegation, ui]
dependency_graph:
  requires: []
  provides: [CSP-FIX]
  affects: [src/routes/vendorAdmin.js]
tech_stack:
  added: []
  patterns: [event-delegation-capture, data-attribute-action]
key_files:
  modified:
    - src/routes/vendorAdmin.js
decisions:
  - "Use capture phase for error event delegation so it fires before propagation stops on img elements"
  - "Soften missing-credentials status to 'Not configured' in gray — it is a config gap not a runtime failure"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-20"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260320-ate: Fix CSP Inline Event Handler Violations Summary

**One-liner:** Replaced three inline `onerror`/`onclick` handlers in vendorAdmin.js with CSP-compliant event delegation and softened the missing-credentials error display.

## What Was Done

Removed all inline event handler attributes from the vendor admin page HTML output and replaced them with standards-compliant event delegation patterns. The Sync Now button and broken-image fallback now work without violating Content Security Policy. The misleading red "Missing credentials" error was replaced with a calm blue info message.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace inline handlers with event delegation and soften credentials error | 57b8a71 | src/routes/vendorAdmin.js |

## Changes Made

### 1. Broken-image fallback (2 `<img>` elements)
- **Before:** `onerror="this.style.display='none'"` on lines 345 and 1782
- **After:** `data-img-fallback` attribute on both img elements; single capture-phase `document.addEventListener('error', ...)` handles all of them

### 2. Sync Now button
- **Before:** `onclick="syncVendor('${...}')"` on the Sync Now button
- **After:** `data-action="sync-vendor" data-vendor="${...}"` attributes; click delegation calls `syncVendor(btn, name)`
- Updated `syncVendor` signature from `(name)` to `(btn, name)` — removed `var btn = event.target` dependency on implicit global `event`

### 3. Missing-credentials error softening
- **Before:** Red error box showing raw "Missing credentials..." text; "Error" label in red
- **After:** When `last_sync_error` contains "Missing credentials" or "env var": blue info box reads "Automated sync not configured — set credentials env vars to enable." and status label shows "Not configured" in gray
- All other real errors continue to show as red

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -n 'onerror=' src/routes/vendorAdmin.js` — no matches
- `grep -n 'onclick=' src/routes/vendorAdmin.js` — no matches
- `data-img-fallback` present on 2 `<img>` elements
- `data-action="sync-vendor"` present on 1 `<button>` element
- `addEventListener('error', ...)` with capture=true present
- `node --check src/routes/vendorAdmin.js` — SYNTAX OK

## Self-Check: PASSED

- [x] src/routes/vendorAdmin.js exists and modified
- [x] Commit 57b8a71 exists
- [x] Zero inline onerror/onclick attributes in HTML output
- [x] Syntax check passes
