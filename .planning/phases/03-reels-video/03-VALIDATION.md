---
phase: 3
slug: reels-video
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — manual + CLI verification (no test runner installed) |
| **Config file** | none |
| **Quick run command** | `node --input-type=module < /dev/stdin` (inline smoke checks) |
| **Full suite command** | Manual end-to-end via staging |
| **Estimated runtime** | ~5 minutes manual |

---

## Sampling Rate

- **After every task commit:** Verify file exists + grep for key strings
- **After every plan wave:** Manual staging smoke test
- **Before `/gsd:verify-work`:** Full end-to-end Reel publish on staging
- **Max feedback latency:** 120 seconds (IG container poll timeout)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | REEL-01 | grep | `grep -r "video/mp4\|video/quicktime\|video/mov" src/routes/twilio.js` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | REEL-02 | grep | `grep -r "service_description\|video_reel" src/core/messageRouter.js` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | REEL-03 | file | `test -f src/publishers/instagram.js && grep "REELS" src/publishers/instagram.js` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | REEL-04 | file | `test -f src/publishers/facebook.js && grep "video_reels" src/publishers/facebook.js` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | REEL-05 | grep | `grep -r "reel\|video_reel" src/core/composeFinalCaption.js` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | REEL-06 | grep | `grep "reel.*20\|20.*reel" src/core/gamification.js` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | REEL-07 | grep | `grep -r "reel" src/routes/analytics.js` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 2 | REEL-08 | file | `test -f src/publishers/tiktok.js` | ❌ W0 | ⬜ pending |
| 3-02-05 | 02 | 2 | REEL-09 | grep | `grep "post_type.*reel\|reel.*post_type" src/routes/manager.js` | ❌ W0 | ⬜ pending |
| 3-02-06 | 02 | 2 | REEL-10 | grep | `grep "reel\|video" src/core/postErrorTranslator.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test framework to install — project uses grep/file-existence checks
- All verification commands above can be run immediately after file creation

*Existing infrastructure covers all phase requirements via grep-verifiable checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stylist texts video → receives service description prompt | REEL-01, REEL-02 | Requires live Twilio + stylist phone | Text a .mov video to the salon Twilio number; verify SMS reply asks "What service is this for?" |
| IG Reel publishes after manager approval | REEL-03 | Requires live IG Business Account + Graph API | Approve a reel post from the dashboard; verify it appears on the IG profile as a Reel |
| FB Reel publishes after manager approval | REEL-04 | Requires live FB Page + Graph API | Approve a reel post; verify it appears on the FB Page under Reels tab |
| IG container poll completes within 120s | REEL-03 | Requires live API timing | Monitor logs during IG Reel publish; confirm no timeout error |
| Reel scores 20 pts on leaderboard | REEL-09 | Requires full publish flow | Publish a reel; verify team leaderboard shows 20 pts for that stylist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
