---
phase: 03-reels-video
plan: "02"
subsystem: gamification, error-handling, publishers, integrations
tags: [reel, gamification, error-translation, tiktok, integrations]
dependency_graph:
  requires: []
  provides: [reel-scoring, reel-error-translations, tiktok-stub, tiktok-coming-soon-ui]
  affects: [leaderboard, dashboard-error-banners, integrations-page]
tech_stack:
  added: []
  patterns: [publisher-stub, coming-soon-card]
key_files:
  created:
    - src/publishers/tiktok.js
  modified:
    - src/core/gamification.js
    - src/core/postErrorTranslator.js
    - src/routes/integrations.js
decisions:
  - postTypeLabel in analytics.js already handled 'reel' type — no change needed
  - TikTok card placed after Zenoti card and before existing Vagaro coming-soon block
  - reel error rules added after existing IG story rule, before rate limits section
metrics:
  duration: 5
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 4
---

# Phase 03 Plan 02: Reel Scoring, Error Translations, and TikTok Stub Summary

**One-liner:** Reel posts score 20 pts on the leaderboard, Reel API errors translate to plain English, and TikTok shows as "Coming soon" on the integrations page with a publisher stub.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add reel scoring, Reel error translations, TikTok stub | 62014ed | gamification.js, postErrorTranslator.js, tiktok.js |
| 2 | Add TikTok coming soon card to integrations page | 16280eb | integrations.js |

## What Was Built

### Reel Gamification Scoring
- Added `reel: 20` to `DEFAULT_POINTS` in `gamification.js`
- Reel posts earn double the standard post points (20 vs 10)
- `getPointValue()` fallback in gamification.js automatically picks this up — no DB migration needed
- `postTypeLabel` in analytics.js already handled 'reel' (confirmed via grep — no change needed)

### Reel Error Translations
- Added three new rules to `postErrorTranslator.js` RULES array:
  - `/IG Reel container create failed|IG Reel/i` → plain English IG Reel message
  - `/FB Reel init failed|FB Reel upload failed|FB Reel publish failed/i` → plain English FB Reel message
  - `/TikTok publishing not yet available/i` → TikTok coming soon message
- Rules inserted after existing IG story rule, before rate limits section

### TikTok Publisher Stub
- Created `src/publishers/tiktok.js` as a valid ESM module
- Exports `publishReel()` async function that always throws `Error('TikTok publishing not yet available')`
- Comment explains full implementation is pending TikTok Developer app approval

### TikTok Integrations Card
- Added a greyed-out (`opacity-60 pointer-events-none`) TikTok card to the integrations page
- Card appears after the Zenoti card, before the existing Vagaro "Coming Soon" block
- Includes TikTok SVG icon, "Coming soon" badge, and "pending developer app approval" subtitle
- Non-interactive — purely informational for managers

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `DEFAULT_POINTS.reel === 20`: true
- `translatePostError('IG Reel container create failed')` returns IG Reel plain-English message
- `translatePostError('FB Reel init failed')` returns FB Reel plain-English message
- `translatePostError('TikTok publishing not yet available')` returns TikTok coming soon message
- `tiktok.publishReel()` throws `Error('TikTok publishing not yet available')`
- `grep -c 'TikTok' src/routes/integrations.js` returns 2
- `postTypeLabel` in analytics.js already handled 'reel' — no change needed

## Self-Check: PASSED

Files verified:
- src/core/gamification.js: FOUND
- src/core/postErrorTranslator.js: FOUND
- src/publishers/tiktok.js: FOUND
- src/routes/integrations.js: FOUND

Commits verified:
- 62014ed: feat(03-02): add reel scoring, error translations, and TikTok stub
- 16280eb: feat(03-02): add TikTok coming soon card to integrations page
