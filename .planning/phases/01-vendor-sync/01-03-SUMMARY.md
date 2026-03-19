---
phase: 01-vendor-sync
plan: 03
subsystem: api
tags: [vendor, scheduler, caption, pdf-sync]

# Dependency graph
requires:
  - phase: 01-vendor-sync plan 01
    provides: migration 045 adding source, caption_body, release_date columns to vendor_campaigns
provides:
  - source-aware caption routing in processCampaign() — pdf_sync bypasses AI, manual uses AI
affects: [vendorScheduler, pdf-import pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "source-aware branching — check campaign.source === 'pdf_sync' before calling AI; verbatim caption path uses regex replace for [SALON NAME]"

key-files:
  created: []
  modified:
    - src/core/vendorScheduler.js

key-decisions:
  - "Both conditions required: source === 'pdf_sync' AND caption_body must be truthy — avoids empty caption for pdf_sync rows that lack a body"
  - "Case-insensitive regex /[SALON NAME]/gi ensures replacement regardless of mixed-case variants in brand-supplied copy"
  - "SELECT * in campaign query already fetches source, caption_body, release_date — no query change needed"

patterns-established:
  - "PDF caption verbatim path: replace [SALON NAME] then skip AI entirely — caption flows identically downstream (hashtag block, tracking URL, post insert)"

requirements-completed:
  - VSYNC-05
  - VSYNC-06
  - VSYNC-07

# Metrics
duration: 1min
completed: 2026-03-19
---

# Phase 01 Plan 03: Vendor Scheduler PDF Caption Bypass Summary

**processCampaign() now routes pdf_sync campaigns to verbatim caption with [SALON NAME] replacement, bypassing AI generation entirely while leaving manual/CSV campaigns unchanged**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-19T22:14:12Z
- **Completed:** 2026-03-19T22:14:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added source-aware if/else branch in processCampaign() around lines 261-268
- PDF-sourced campaigns use caption_body verbatim with case-insensitive [SALON NAME] regex replacement
- Manual/CSV campaigns continue calling generateVendorCaption() unchanged
- Confirmed SELECT * already includes source, caption_body, release_date — no query modification required

## Task Commits

Each task was committed atomically:

1. **Task 1: Add [SALON NAME] replacement and AI bypass for pdf_sync campaigns** - `91358ec` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/core/vendorScheduler.js` - Added source-aware caption branching in processCampaign()

## Decisions Made
- Both `campaign.source === 'pdf_sync'` AND `campaign.caption_body` must be truthy — prevents empty captions on malformed rows
- Used `/\[SALON NAME\]/gi` (case-insensitive) to handle any casing variants in brand copy
- No downstream changes needed — `caption` variable flows identically to hashtag block, affiliate URL injection, and post INSERT

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PDF caption bypass is in place; ready for plan 04 (PDF sync pipeline) to produce campaigns with source='pdf_sync' and caption_body populated
- No blockers

---
*Phase: 01-vendor-sync*
*Completed: 2026-03-19*
