---
phase: 2
slug: content-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — Wave 0 installs jest with `--experimental-vm-modules` (or Vitest) |
| **Config file** | `jest.config.js` — Wave 0 creates |
| **Quick run command** | `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=recycler` |
| **Full suite command** | `node --experimental-vm-modules node_modules/.bin/jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Manual smoke test of affected route (no automated suite until Wave 0 completes)
- **After every plan wave:** Once Wave 0 creates test infra: `node --experimental-vm-modules node_modules/.bin/jest tests/recycler.test.js tests/scheduler.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-xx-01 | TBD | 0 | RECYC-01 | unit | `jest tests/recycler.test.js -t "trigger conditions"` | ❌ W0 | ⬜ pending |
| 2-xx-02 | TBD | 0 | RECYC-02 | unit | `jest tests/recycler.test.js -t "candidate selection"` | ❌ W0 | ⬜ pending |
| 2-xx-03 | TBD | 0 | RECYC-03 | unit | `jest tests/recycler.test.js -t "candidate exclusions"` | ❌ W0 | ⬜ pending |
| 2-xx-04 | TBD | 0 | RECYC-04 | unit | `jest tests/recycler.test.js -t "type dedup"` | ❌ W0 | ⬜ pending |
| 2-xx-05 | TBD | 0 | RECYC-05 | unit | `jest tests/recycler.test.js -t "caption refresh gate"` | ❌ W0 | ⬜ pending |
| 2-xx-06 | TBD | 0 | RECYC-06 | unit | `jest tests/recycler.test.js -t "clone integrity"` | ❌ W0 | ⬜ pending |
| 2-xx-07 | TBD | 0 | RECYC-07 | unit (mock sendViaTwilio) | `jest tests/recycler.test.js -t "sms notification"` | ❌ W0 | ⬜ pending |
| 2-xx-08 | TBD | manual | RECYC-08 | smoke | Manual — Admin Settings UI | N/A | ⬜ pending |
| 2-xx-09 | TBD | manual | RECYC-09 | smoke | Manual — Database view UI | N/A | ⬜ pending |
| 2-xx-10 | TBD | manual | RECYC-10 | smoke | Manual — Database view UI | N/A | ⬜ pending |
| 2-xx-11 | TBD | manual | RECYC-11 | smoke | Manual — manager dashboard | N/A | ⬜ pending |
| 2-xx-12 | TBD | 0 | SCHED-01 | unit | `jest tests/scheduler.test.js -t "pickNextPost"` | ❌ W0 | ⬜ pending |
| 2-xx-13 | TBD | 0 | SCHED-02 | unit | `jest tests/scheduler.test.js -t "standard distribution"` | ❌ W0 | ⬜ pending |
| 2-xx-14 | TBD | 0 | SCHED-03 | unit | `jest tests/scheduler.test.js -t "before_after weekday"` | ❌ W0 | ⬜ pending |
| 2-xx-15 | TBD | 0 | SCHED-04 | unit | `jest tests/scheduler.test.js -t "promotion cap"` | ❌ W0 | ⬜ pending |
| 2-xx-16 | TBD | 0 | SCHED-05 | unit | `jest tests/scheduler.test.js -t "availability midweek"` | ❌ W0 | ⬜ pending |
| 2-xx-17 | TBD | 0 | SCHED-06 | unit | `jest tests/scheduler.test.js -t "reel bonus"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/recycler.test.js` — stubs for RECYC-01 through RECYC-07
- [ ] `tests/scheduler.test.js` — stubs for SCHED-01 through SCHED-06
- [ ] `jest.config.js` — ESM config for Node.js (`--experimental-vm-modules`)
- [ ] `tests/helpers/db-fixture.js` — in-memory better-sqlite3 fixture for unit tests
- [ ] Framework install: `npm install --save-dev jest @jest/globals` (if not already present — evaluate Vitest as simpler ESM alternative)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| auto_recycle toggle persists in DB | RECYC-08 | Admin Settings UI interaction | Enable toggle in Admin → confirm DB column = 1; disable → confirm = 0 |
| block_from_recycle excludes candidate | RECYC-09 | Database view UI interaction | Flag a post in Database view → run recycle job → confirm post not selected |
| Manual recycle produces correct clone | RECYC-10 | Database view UI interaction | Click "Recycle" on a published post → confirm new post cloned with `recycled_from_id` |
| Dashboard notice appears when recycled | RECYC-11 | Manager dashboard UI | Trigger auto-recycle → load dashboard → confirm notice banner visible with link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
