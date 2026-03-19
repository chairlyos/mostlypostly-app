---
phase: 01-vendor-sync
plan: 02
subsystem: api
tags: [pdfjs-dist, puppeteer, vendor-sync, pdf-parsing, sqlite]

# Dependency graph
requires:
  - phase: 01-vendor-sync/01-01
    provides: migration 045 (release_date, caption_body, source columns + dedup UNIQUE index on vendor_campaigns)

provides:
  - vendorConfigs.js: factory config pattern — Aveda config with portal URL, login selectors, search template, image strategy, credential env var names
  - vendorSync.js: full sync pipeline — Puppeteer login + CDP PDF download + pdfjs-dist parsing + image download + INSERT OR IGNORE into vendor_campaigns
  - getBrowser exported from puppeteerRenderer.js for reuse

affects:
  - 01-03 (vendorAdmin route wires POST /internal/vendors/sync/:vendorName → runVendorSync)
  - 01-04 (scheduler nightly cron calls runVendorSync)
  - vendorScheduler.js (source='pdf_sync' gate skips generateVendorCaption for imported campaigns)

# Tech tracking
tech-stack:
  added: [pdfjs-dist@5.5.207]
  patterns:
    - getBrowser singleton reuse — never call puppeteer.launch() outside puppeteerRenderer.js
    - CDP download + file-system polling fallback for --single-process environments
    - INSERT OR IGNORE dedup with UNIQUE index for idempotent pipeline runs
    - source field gates caption generation (pdf_sync = verbatim from PDF, no AI)

key-files:
  created:
    - src/core/vendorConfigs.js
    - src/core/vendorSync.js
  modified:
    - src/core/puppeteerRenderer.js

key-decisions:
  - "getBrowser exported from puppeteerRenderer.js to enforce singleton — no second Chrome on Render Starter"
  - "pdfjs-dist 5.5.207 (legacy/build/pdf.mjs) chosen for PDF text + hyperlink annotation extraction (pdf-parse cannot extract annotations)"
  - "imageDownloadStrategy='auto' tries HEAD fetch first; falls back to Puppeteer page-click if response is not image/*"
  - "caption_body stored verbatim with [SALON NAME] placeholder; replacement deferred to vendorScheduler.js at publish time"
  - "source='pdf_sync' on all INSERT rows so vendorScheduler.js can skip OpenAI caption generation for imported campaigns"
  - "CDP download + file-system polling dual strategy to handle --single-process Chrome where CDP events may not fire"

patterns-established:
  - "Pattern: Vendor factory config — each vendor = one VENDOR_CONFIGS entry + env vars, zero new code in vendorSync"
  - "Pattern: Sync lock via syncInProgress Map — prevents concurrent Puppeteer sessions against same portal credentials"

requirements-completed: [VSYNC-01, VSYNC-02, VSYNC-03, VSYNC-04, VSYNC-05, VSYNC-06, VSYNC-07, VSYNC-08, VSYNC-11]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 1 Plan 02: Vendor Sync Core Pipeline Summary

**Puppeteer portal login + CDP PDF download + pdfjs-dist page-by-page extraction + INSERT OR IGNORE dedup into vendor_campaigns with source='pdf_sync' for caption bypass**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T22:15:32Z
- **Completed:** 2026-03-19T22:18:39Z
- **Tasks:** 2
- **Files modified:** 4 (vendorConfigs.js created, vendorSync.js created, puppeteerRenderer.js modified, package.json updated)

## Accomplishments

- Created `src/core/vendorConfigs.js` with factory pattern: Aveda config (portal URL, login selectors, search keyword template `{MONTH} {YEAR} Salon Social Assets`, image download strategy, credential env var names, PDF parser hints)
- Exported `getBrowser` from `puppeteerRenderer.js` so vendorSync reuses the existing Puppeteer singleton — no second Chrome launch, no OOM on Render Starter
- Created `src/core/vendorSync.js`: complete pipeline — Puppeteer portal login, CDP PDF download with file-system polling fallback, pdfjs-dist text + annotation extraction, image download (HEAD-check strategy), INSERT OR IGNORE with UNIQUE dedup index, vendor_brands sync status update

## Task Commits

1. **Task 1: Create vendorConfigs.js and export getBrowser** - `c250fc6` (feat)
2. **Task 2: Create vendorSync.js — full pipeline** - `eea4153` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/core/vendorConfigs.js` - Factory config objects for vendor portal automation; Aveda config; getVendorConfig() helper
- `src/core/vendorSync.js` - Full sync pipeline: runVendorSync(), downloadPortalPdf(), parseCampaignPdf(), extractCampaignFromPage(), downloadCampaignImage(), insertCampaigns()
- `src/core/puppeteerRenderer.js` - Added `export { getBrowser }` (one-line addition)
- `package.json` / `package-lock.json` - Added pdfjs-dist@5.5.207

## Decisions Made

- Chose pdfjs-dist (legacy ESM build) over pdf-parse: only library with `page.getAnnotations()` for extracting embedded PDF hyperlinks (image download URLs)
- `imageDownloadStrategy: 'auto'` tries HEAD fetch first; if response is not `image/*`, falls back to authenticated Puppeteer page navigation — handles both direct file URLs and asset pages requiring browser session
- Dual CDP + file-system polling for download completion: CDP `Browser.downloadProgress` events may not fire under `--single-process` Chrome on Render Starter; polling is the reliable fallback
- caption_body stored verbatim (no AI at import time); `[SALON NAME]` replaced at publish time in vendorScheduler.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — pdfjs-dist installed cleanly, vitest suite stays at 16/16 passing after changes, migration 045 applied successfully on first run.

## User Setup Required

Two environment variables required before runVendorSync() will work for Aveda:

- `AVEDA_PORTAL_USER` — Aveda PurePro portal email
- `AVEDA_PORTAL_PASS` — Aveda PurePro portal password

Add these to Render Dashboard → Environment → Secret Files or Environment Variables. The pipeline throws a descriptive error if either is missing.

## Next Phase Readiness

- Plan 01-03 (vendorAdmin sync route) can wire `POST /internal/vendors/sync/:vendorName → runVendorSync()` — the export is ready
- Plan 01-04 (nightly scheduler cron) can import `runVendorSync` from `vendorSync.js` and add it to `runSchedulerOnce()`
- vendorScheduler.js needs `source === 'pdf_sync'` gate to bypass `generateVendorCaption()` for imported campaigns (already planned in 01-03)

---
*Phase: 01-vendor-sync*
*Completed: 2026-03-19*
