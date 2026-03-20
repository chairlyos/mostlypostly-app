---
phase: 03-reels-video
plan: "04"
subsystem: api
tags: [instagram, facebook, reels, video, publisher, scheduler]

# Dependency graph
requires:
  - phase: 03-02
    provides: reel post_type in DB schema and post creation pipeline
  - phase: 03-03
    provides: generateReelCaption with composeFinalCaption integration
provides:
  - publishReelToInstagram function (3-step IG Reels API with 120s polling)
  - publishFacebookReel function (3-phase FB Reels video_reels endpoint)
  - Reel branch in scheduler.js routing reel posts to both publishers
affects: [scheduler, publishers, instagram, facebook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - waitForContainer extended with optional timeout params (backward-compatible override pattern)
    - Independent platform failure handling: FB and IG publish independently for reel posts
    - Reel branch inserted before storyOnly check in scheduler if/else chain

key-files:
  created: []
  modified:
    - src/publishers/instagram.js
    - src/publishers/facebook.js
    - src/scheduler.js

key-decisions:
  - "waitForContainer timeout params added as optional with defaults (backward-compatible — existing callers unaffected)"
  - "Reel branch catches FB error independently — IG still proceeds even if FB fails"
  - "If both FB and IG fail for a reel, IG error re-thrown to trigger outer retry handler"
  - "GMB explicitly excluded from reel posts (postType !== 'reel') — GMB API does not support video Reels"
  - "composeFinalCaption and enqueuePost UTM injection confirmed post_type-agnostic — no changes needed"

patterns-established:
  - "Independent platform publish: try/catch each platform separately, re-throw only when all fail"
  - "Reel video URL sourced from allImages[0] — consistent with how image posts resolve their media"

requirements-completed:
  - REEL-06
  - REEL-07

# Metrics
duration: 3min
completed: "2026-03-20"
---

# Phase 03 Plan 04: Reel Publisher Functions and Scheduler Wiring Summary

**IG and FB Reel publisher functions added with independent-failure isolation, wired into scheduler via post_type='reel' branch with 120s IG polling and GMB exclusion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T14:12:29Z
- **Completed:** 2026-03-20T14:15:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `publishReelToInstagram` to instagram.js: 3-step container API (REELS type, 120s/3s polling, publish) with IG caption normalization
- Added `publishFacebookReel` to facebook.js: 3-phase video_reels endpoint (init, file_url upload, finish/publish) with salon object + string pageId support
- Modified `waitForContainer` to accept optional `maxWaitMs`/`pollIntervalMs` params — backward-compatible, existing callers use defaults
- Wired reel branch in scheduler.js before storyOnly check with independent FB/IG failure handling
- GMB eligibility check extended to exclude reel posts (`postType !== "reel"`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add publishReelToInstagram and publishFacebookReel** - `fadf6df` (feat)
2. **Task 2: Wire reel publish branch into scheduler** - `27ff414` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/publishers/instagram.js` - Added `publishReelToInstagram`; modified `waitForContainer` signature
- `src/publishers/facebook.js` - Added `publishFacebookReel`
- `src/scheduler.js` - Updated imports; added reel branch; added GMB reel exclusion

## Decisions Made
- `waitForContainer` optional params added with env-var defaults to preserve backward compatibility — no existing callers need to change
- Reel branch independently catches FB errors so IG publish still proceeds; only re-throws when both platforms fail
- GMB explicitly excluded for reel posts — GMB API (`localPosts`) only accepts image/text posts, not video Reels
- `composeFinalCaption` and UTM injection both confirmed post_type-agnostic — no changes needed in either

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All four plans in Phase 03 are now complete
- Reel posts can be texted in, captioned, approved, and published to both Instagram Reels and Facebook Reels
- Full reel pipeline: SMS inbound detection (03-01) → video hosting (03-01) → post creation (03-02) → caption generation with composeFinalCaption (03-03) → publish (03-04)

---
*Phase: 03-reels-video*
*Completed: 2026-03-20*
