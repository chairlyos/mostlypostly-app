---
phase: quick-260319-i8s
plan: 01
subsystem: vendor-scheduler
tags: [vendor, affiliate, utm-tracking, instagram, facebook, captions]
dependency_graph:
  requires: []
  provides: [deterministic-vendor-affiliate-url-injection]
  affects: [src/core/vendorScheduler.js, src/scheduler.js]
tech_stack:
  added: []
  patterns: [system-controlled-url-placement, platform-specific-caption-derivation]
key_files:
  modified:
    - src/core/vendorScheduler.js
    - src/scheduler.js
decisions:
  - "Affiliate URL placement is now system-controlled (deterministic) — AI writes clean product copy only"
  - "FB caption format: {AI copy}\\n\\nShop today: {shortUrl}\\n\\n{hashtags}"
  - "IG caption derived on-the-fly at publish time from stored FB caption — no DB migration needed"
  - "GMB receives FB caption (full URL intact)"
metrics:
  duration: ~8 minutes
  completed: 2026-03-19T17:17:28Z
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260319-i8s: Inject Affiliate URL into Vendor Posts Summary

**One-liner:** Deterministic vendor affiliate URL injection — system appends "Shop today: {tracked short URL}" to FB vendor captions; IG caption strips URLs and appends "Shop, link in bio." at publish time.

## What Was Built

Vendor post affiliate URL injection is now fully deterministic. Previously, the AI was asked to include the raw affiliate URL in its generated caption, leading to unreliable placement, potential URL mangling, and no UTM tracking on AI-included links. The new approach removes the URL from the AI prompt entirely and has the system insert a tracked short URL at a fixed position in the caption.

### Changes

**`src/core/vendorScheduler.js`**
- Removed `affiliateUrl` parameter from `generateVendorCaption()` signature
- Deleted `safeAffiliateUrl` validation block (13 lines) and prompt injection line from AI user prompt
- Replaced the old "replace raw URL in caption body" block with deterministic shop CTA logic:
  - When `affiliateUrl` is set: builds UTM destination, creates tracking token, generates short URL, appends `"\n\nShop today: {shortUrl}"` between AI copy and hashtag block
  - When no `affiliateUrl`: caption = `{AI copy}\n\n{hashtags}` (same as before)
  - UTM token failure falls back silently to caption without shop CTA

**`src/scheduler.js`**
- Added vendor post detection at publish time: `const isVendorPost = !!post.vendor_campaign_id`
- Derives `igCaption` by stripping `\n\nShop today: https://...` and all remaining URLs from `final_caption`, then appending `"\n\nShop, link in bio."` when a shop CTA was present
- Updated all publish call sites:
  - `publishToFacebook` — uses `fbCaption`
  - `publishToInstagram` — uses `igCaption`
  - `publishToFacebookMulti` — uses `fbCaption`
  - `publishToInstagramCarousel` — uses `igCaption`
  - GMB `publishWhatsNewToGmb` / `publishOfferToGmb` — uses `fbCaption`
- Non-vendor posts: `fbCaption === igCaption === post.final_caption` — zero behavior change

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9ff7e21 | feat(quick-260319-i8s): deterministic affiliate URL injection in vendorScheduler |
| Task 2 | ba90a69 | feat(quick-260319-i8s): IG-specific vendor caption derivation at publish time |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/core/vendorScheduler.js` modified and imports cleanly
- [x] `src/scheduler.js` modified and imports cleanly
- [x] `grep -n "safeAffiliateUrl\|Include this partner link" src/core/vendorScheduler.js` returns nothing
- [x] `grep -n "Shop today:" src/core/vendorScheduler.js` shows deterministic injection block (line 307)
- [x] `grep -n "Shop, link in bio" src/scheduler.js` shows IG derivation block (line 458)
- [x] Commits 9ff7e21 and ba90a69 exist in git log
