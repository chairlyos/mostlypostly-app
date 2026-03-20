---
phase: 06-per-salon-platform-content-routing
plan: 01
subsystem: database
tags: [sqlite, migration, scheduler, routing, platform-control]

# Dependency graph
requires: []
provides:
  - "migration 051: platform_routing TEXT column on salons table (idempotent)"
  - "platformRouting.js: DEFAULT_ROUTING constant, mergeRoutingDefaults(), isEnabledFor()"
affects:
  - scheduler
  - integrations-ui
  - 06-02
  - 06-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isEnabledFor(salon, postType, platform) — single routing check, defaults to true for safety"
    - "mergeRoutingDefaults() — shallow merge of salon overrides onto DEFAULT_ROUTING per post_type"

key-files:
  created:
    - migrations/051_platform_routing.js
    - src/core/platformRouting.js
  modified:
    - migrations/index.js

key-decisions:
  - "platform_routing stored as TEXT (JSON) on salons row — avoids separate routing table, consistent with brand_palette, default_hashtags, and other JSON columns"
  - "NULL platform_routing = all-enabled defaults — backward compatible with all existing salons"
  - "isEnabledFor() treats unknown post types as enabled — safe default prevents accidental suppression of new types"
  - "mergeRoutingDefaults() performs shallow merge per post_type — only explicitly stored boolean overrides take effect; unset cells revert to true"

patterns-established:
  - "Routing guard: import { isEnabledFor } from './core/platformRouting.js' then check before each platform publish call"
  - "DEFAULT_ROUTING: source of truth for all valid post_type × platform combinations"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 06 Plan 01: Platform Routing Schema and Helper Summary

**SQLite column + helper module providing per-salon post-type × platform routing rules with safe all-enabled defaults and partial JSON override merging.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-20T19:01:25Z
- **Completed:** 2026-03-20T19:03:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migration 051 adds `platform_routing TEXT` column to `salons` — idempotent, backward compatible with all existing salons (NULL = all enabled)
- `platformRouting.js` exports `DEFAULT_ROUTING` (8 post types × 4 platforms, all true), `mergeRoutingDefaults()`, and `isEnabledFor()` with full edge-case handling
- All node assertion tests pass: default all-enabled, explicit false override, cross-platform isolation, unknown post type, null routing, malformed JSON

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 051 — platform_routing column** - `740d5b5` (feat)
2. **Task 2: platformRouting.js helper module** - `3077824` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `migrations/051_platform_routing.js` - Idempotent ALTER TABLE to add `platform_routing TEXT` to salons
- `migrations/index.js` - Registered migration 051 (import + array entry)
- `src/core/platformRouting.js` - Exports `DEFAULT_ROUTING`, `mergeRoutingDefaults()`, `isEnabledFor()`

## Decisions Made

- `platform_routing` stored as JSON TEXT on the salons row — consistent with existing `brand_palette`, `default_hashtags` columns; avoids a separate routing table join on every scheduler tick
- NULL value in `platform_routing` falls back to full `DEFAULT_ROUTING` — zero migration of existing data required
- `isEnabledFor()` returns `true` for any unknown post type — new post types introduced later will not be accidentally suppressed before routing rules are explicitly set
- Merge strategy is per-post-type shallow: only explicitly stored `boolean` values override; any other type is ignored

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-02 can now import `isEnabledFor` and add routing checks into the scheduler publish block
- Plan 06-03 can import `DEFAULT_ROUTING` and `mergeRoutingDefaults` to render the Admin integrations UI toggles
- No blockers

---
*Phase: 06-per-salon-platform-content-routing*
*Completed: 2026-03-20*
