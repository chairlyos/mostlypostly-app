# Bug Fix Design: Multi-Image SMS APPROVE + IG Handle in Captions
_Date: 2026-04-16_

## Background

Two bugs were identified from a real incident where a stylist (Vincent Gingerich @ Rejuve Salon Spa) sent 2 photos at 9:23 PM. The salon's `require_manager_approval` was `0` (now corrected to `1`), so the post auto-published via SMS APPROVE. The published post had only 1 of 2 images and the Facebook caption showed a full `https://instagram.com/handle` URL. A separate portal-submitted post approved the next morning was missing the IG handle entirely.

---

## Bug 1 — Multi-Image SMS APPROVE Publishes Only 1 Image

### Root Cause

The APPROVE SMS handler in `messageRouter.js` always reads `draft.image_url` (single) for publishing, ignoring `draft.image_urls` (array). Even when a stylist sends 2+ photos, only the first is published.

### Decision

Multi-image posts benefit from portal review — the stylist should confirm image selection before posting. SMS APPROVE is a quick shortcut appropriate for single images only.

**Fix:** In the APPROVE command handler, after loading the draft, check `draft.image_urls.length > 1`. If true, skip publishing and reply with the stylist portal link instead:

> "You sent 2 photos — tap here to review and confirm before posting: [portal link]"

The portal token already exists in `stylist_portal_tokens` from when the draft was saved. Look it up by `post_id`. If no token exists (server restart edge case), generate a fresh one.

Single-image drafts continue through the existing publish path unchanged.

### Files Changed
- `src/core/messageRouter.js` — APPROVE handler (~line 1432)

---

## Bug 2 — IG @Handle Missing / Wrong Format in Captions

### Root Cause (Part 1 — Portal uploads)

`videoUpload.js` calls `composeFinalCaption` at two points without passing `instagramHandle`:
- `POST /:token` (initial upload, ~line 281)
- `POST /regen` (~line 172)

Result: the "Styled By:" credit line shows the stylist's full name on IG posts instead of `@handle`.

### Fix for Part 1

- `POST /:token`: add `instagramHandle: stylist.instagram_handle || ""`
- `POST /regen`: the route has the `post` DB row but not the stylist record. Add a lookup:
  ```js
  const stylistRow = db.prepare(
    "SELECT instagram_handle FROM stylists WHERE name = ? AND salon_id = ? LIMIT 1"
  ).get(post.stylist_name, post.salon_id);
  ```
  Then pass `instagramHandle: stylistRow?.instagram_handle || ""`.

### Root Cause (Part 2 — Full URL on Facebook)

`buildFacebookCaption` calls `insertIGUnderStyledBy` which inserts a full `https://instagram.com/handle` URL as a separate line under "Styled By:". This is the "IG URL" that appeared on the 9:23 PM bad post.

**Desired behavior:** Show `@handle` instead of the full URL everywhere on Facebook. Cleaner, more natural, matches how creators credit on social.

### Fix for Part 2

Change `insertIGUnderStyledBy` in `messageRouter.js` to insert `@handle` instead of `https://instagram.com/handle`. This affects all Facebook posts from all paths (SMS APPROVE, scheduler, manager approval).

### Files Changed
- `src/routes/videoUpload.js` — two `composeFinalCaption` calls
- `src/core/messageRouter.js` — `insertIGUnderStyledBy` helper

---

## Acceptance Criteria

- [ ] Stylist sends 2 images via SMS → receives portal link redirect, no auto-publish
- [ ] Stylist sends 1 image via SMS → APPROVE still publishes directly (no regression)
- [ ] Portal-uploaded reel captions include `@handle` in "Styled By:" line on IG
- [ ] All Facebook captions show `@handle` under Styled By, not full URL
- [ ] `/regen` endpoint correctly resolves stylist's instagram_handle from DB
