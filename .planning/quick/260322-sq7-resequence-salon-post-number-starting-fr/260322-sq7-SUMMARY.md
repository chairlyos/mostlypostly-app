---
phase: quick
plan: 260322-sq7
subsystem: internal-admin
tags: [vendor-admin, maintenance, post-sequencing, internal-tool]
dependency_graph:
  requires: []
  provides: [POST /internal/vendors/resequence-posts]
  affects: [posts.salon_post_number]
tech_stack:
  added: []
  patterns: [db.transaction, requireSecret+requirePin middleware]
key_files:
  modified:
    - src/routes/vendorAdmin.js
decisions:
  - "COALESCE(published_at, scheduled_for) used as the ordering key so unscheduled posts fall back to their planned time, matching the logical post sequence"
  - "Excludes cancelled and draft posts — only posts visible in the published/scheduled/approved flow get renumbered"
  - "db.transaction() wraps all UPDATEs atomically — no partial renumbering if server restarts mid-run"
metrics:
  duration: "< 5 min"
  completed: "2026-03-22"
  tasks_completed: 1
  files_changed: 1
---

# Quick Task 260322-sq7: Resequence Salon Post Number Starting From 1 — Summary

**One-liner:** Internal admin endpoint that atomically renumbers `salon_post_number` from 1 for all live posts in a given salon, ordered chronologically.

## What Was Built

Added `POST /internal/vendors/resequence-posts` to `src/routes/vendorAdmin.js`.

This endpoint was needed because production had gaps in `salon_post_number` after test posts were deleted. With no SSH access to Render, the fix needed to be deployed as a live endpoint accessible from the Platform Console.

## How It Works

1. Accepts `?salon=<slug>` query param (400 if missing)
2. Fetches all posts for the salon where `status NOT IN ('cancelled', 'draft')`, ordered by `COALESCE(published_at, scheduled_for) ASC, id ASC`
3. Wraps all UPDATEs in a single `db.transaction()` for atomicity
4. Assigns each post a new `salon_post_number` equal to its 1-based position in the sorted list
5. Returns `{ salon, updated: N, mappings: [ { id, old: N, new: N }, ... ] }`

Protected by `requireSecret` + `requirePin` middleware — same as all other internal routes.

## Usage

```bash
curl -s -X POST \
  "https://app.mostlypostly.com/internal/vendors/resequence-posts?salon=<slug>&secret=<INTERNAL_SECRET>" \
  | jq .
```

Response shape:
```json
{
  "salon": "studio-500",
  "updated": 42,
  "mappings": [
    { "id": "abc-123", "old": 3, "new": 1 },
    { "id": "def-456", "old": 5, "new": 2 }
  ]
}
```

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add POST /internal/vendors/resequence-posts | 35e695b | src/routes/vendorAdmin.js |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- File modified: `src/routes/vendorAdmin.js` — confirmed present and correct
- Commit `35e695b` — confirmed in git log
- Module import check: passes (vendorAdmin.js loads without syntax errors)
