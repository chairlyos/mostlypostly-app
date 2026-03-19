# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Salons never run out of quality content — the platform generates, recycles, and publishes it automatically while building the salon's online reputation.
**Current focus:** Phase 1 — Vendor Sync

## Current Position

Phase: 1 of 4 (Vendor Sync)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-19 — Roadmap created, phases derived from requirements

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Project init: Vendor sync writes into existing vendor_campaigns schema (avoids divergence with vendorScheduler.js)
- Project init: Video files hosted locally at data/uploads/videos/ (no S3 dependency)
- Project init: Smart recycler triggers at queue depth < 3 AND 48hr since last publish
- Project init: Featured Review posts use sharp (consistent with celebration/promo image pattern)
- Project init: GMB OAuth from FEAT-020 reused for Reputation Manager (no new auth flow)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: FEAT-031 blocked until Aveda portal URL and login type confirmed from Tasha — build parallel components (caption gen, dedup, schema) while waiting
- Phase 3: TikTok Developer app approval is external (1-4 weeks) — stub only this milestone; full publish is v2

## Session Continuity

Last session: 2026-03-19
Stopped at: Roadmap written — ready to plan Phase 1
Resume file: None
