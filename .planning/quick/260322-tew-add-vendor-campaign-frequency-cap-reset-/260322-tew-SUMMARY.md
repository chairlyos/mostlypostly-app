---
phase: quick
plan: 260322-tew
subsystem: vendor-admin
tags: [vendor, frequency-cap, platform-console, inline-edit]
dependency_graph:
  requires: []
  provides: [POST /internal/vendors/campaign/:id/reset-cap]
  affects: [vendorAdmin.js]
tech_stack:
  added: []
  patterns: [fetch-based inline edit, requireSecret + requirePin middleware, vendor_post_log reset]
key_files:
  modified:
    - src/routes/vendorAdmin.js
decisions:
  - "POST endpoint returns JSON (not redirect) — consistent with sync endpoint, enables client-side feedback without reload"
  - "Reset button hidden by default, appears only on input change — prevents accidental cap resets"
  - "secret propagated via URL query param matching existing fetch patterns on brand detail page"
metrics:
  duration: "2 min"
  completed: "2026-03-23T01:14:25Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260322-tew: Add Vendor Campaign Frequency Cap Reset Summary

**One-liner:** Inline frequency cap number input with Reset button in brand detail campaigns table, backed by POST /campaign/:id/reset-cap endpoint that updates frequency_cap and clears vendor_post_log for the current month.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add POST /campaign/:id/reset-cap endpoint and inline cap editor UI | 6df87f5 | src/routes/vendorAdmin.js |

## What Was Built

### Endpoint: POST /internal/vendors/campaign/:id/reset-cap
- Protected by `requireSecret` + `requirePin` middleware (same as all other operator routes)
- Validates `frequency_cap` is an integer in 1-6 range; returns 400 with error message on failure
- Updates `vendor_campaigns.frequency_cap` for the given campaign ID
- Deletes all `vendor_post_log` rows for that campaign in the current month (YYYY-MM format)
- Returns `{ ok: true, frequency_cap: newCap }` on success

### UI: Inline cap editor in brand detail campaigns table
- Static `"N/mo"` text replaced with a `<input type="number" min="1" max="6">` + `/mo` label
- "Reset" button hidden by default; appears when the input value is changed
- Clicking Reset: shows confirm dialog, POSTs to endpoint via fetch, shows "Saving..." then "Done" with 1.5s auto-hide
- Error states display `alert()` with server error message or "Network error"
- Client-side validation mirrors server: alerts if cap is not 1-6

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `grep -c "reset-cap" src/routes/vendorAdmin.js` returns 5 (endpoint declaration, route handler, UI button attribute, JS click handler, fetch URL)
- `grep -n "data-cap-input"` returns 4 lines (HTML input, JS input listener, JS attribute reader, JS querySelector)
- `node --check src/routes/vendorAdmin.js` passes with no errors
- Commit 6df87f5 exists and contains all changes
