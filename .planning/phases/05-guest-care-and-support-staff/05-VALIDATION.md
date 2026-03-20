---
phase: 5
slug: guest-care-and-support-staff
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Node.js/Express; manual + curl/smoke tests |
| **Config file** | none |
| **Quick run command** | `node -e "require('./db.js')"` (DB load check) |
| **Full suite command** | Manual smoke test checklist (see below) |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Verify the specific behavior changed (see Per-Task map)
- **After every plan wave:** Run manual smoke checklist for that wave's scope
- **Before `/gsd:verify-work`:** All manual verifications complete and passing
- **Max feedback latency:** ~5 minutes per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | migration | automated | `node -e "const db=require('./db.js'); db.prepare('SELECT submitted_by FROM posts LIMIT 1').get()"` | ✅ | ⬜ pending |
| 5-01-02 | 01 | 1 | salonLookup | automated | `grep -n "coordinator" src/core/salonLookup.js` | ✅ | ⬜ pending |
| 5-01-03 | 01 | 1 | storage | automated | `grep -n "submitted_by" src/core/storage.js` | ✅ | ⬜ pending |
| 5-02-01 | 02 | 1 | messageRouter | manual | Coordinator texts photo → receives "Who is this for?" or portal link | ✅ | ⬜ pending |
| 5-02-02 | 02 | 1 | twilio routing | automated | `grep -n "coordinator" src/routes/twilio.js` | ✅ | ⬜ pending |
| 5-03-01 | 03 | 2 | portal UI | manual | Coordinator opens portal link → stylist dropdown visible at top | ✅ | ⬜ pending |
| 5-03-02 | 03 | 2 | flood warning | manual | Submit 4+ posts for same stylist → warning appears | ✅ | ⬜ pending |
| 5-04-01 | 04 | 2 | gamification | automated | `grep -n "getCoordinatorLeaderboard" src/core/gamification.js` | ✅ | ⬜ pending |
| 5-04-02 | 04 | 2 | performance tab | manual | Visit /manager/performance → Coordinators tab visible | ✅ | ⬜ pending |
| 5-05-01 | 05 | 3 | welcome SMS | manual | Add coordinator with phone → SMS received | ✅ | ⬜ pending |
| 5-05-02 | 05 | 3 | approval badge | manual | Coordinator-submitted post → "Submitted by" badge in approval queue | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No new test framework needed.
- Migration file must be created before any code changes that reference `submitted_by`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coordinator SMS → GPT extracts stylist name | SMS flow | Requires live Twilio + OpenAI | Text salon Twilio number as coordinator: "Taylor did this balayage" with photo |
| "Who is this for?" fallback | SMS fallback | Requires live Twilio | Text photo with NO stylist name → confirm single "Who is this for?" reply |
| Portal flood warning | Flood protection | Requires UI | Submit >3 posts for same stylist in 7 days → verify amber warning box |
| Welcome SMS on coordinator creation | Welcome SMS | Requires live Twilio | Add coordinator with phone via Team page → confirm SMS received |
| Coordinator tab on Performance page | Leaderboard | Requires UI | Visit /manager/performance → click Coordinators tab → verify points at 50% |
| "Submitted by" badge in approval queue | Attribution | Requires UI | Manager views coordinator-submitted post in approval queue → badge visible |
| Manager can change attributed stylist | Attribution | Requires UI | Open coordinator post in approval view → change stylist dropdown → verify saves |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual checklist entry
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
