# Stylist Instagram Collaborator Opt-In — Design Doc

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:writing-plans to create the implementation plan.

**Date:** 2026-03-18
**Feature:** FEAT-037 — Instagram Collaborator Tagging + Caption Bug Fix
**Status:** Design approved, ready for implementation planning

---

## Goal

Allow stylists to opt in (via SMS or admin toggle) to being tagged as Instagram collaborators on their posts. When opted in, published IG posts include their handle in the `collaborators` API field — the stylist receives an in-app Instagram notification to accept, after which the post appears on both the salon's and stylist's profiles with shared engagement counts.

Also fix two related caption bugs: "Book in bio" CTA appearing on Facebook posts (should be IG-only), and a blank "Book now" link appearing on IG posts when no booking URL is configured.

---

## Architecture

Builds on the existing Instagram publisher (`src/publishers/instagram.js`) and caption composer (`src/core/composeFinalCaption.js`). The collaborator field is added to the existing media container creation API call — no new endpoints, no new auth scopes needed. `instagram_content_publish` (already approved) covers this field.

The opt-in state lives on the `stylists` row. SMS handling is wired into the existing `messageRouter.js` keyword dispatch (same pattern as APPROVE, DENY, REDO). Admin toggle lives on the existing stylist edit page.

The collab tag call is **non-blocking** — if the API rejects it (invalid handle, private account, etc.), we log a warning and the post publishes normally without the tag.

---

## Section 1: Database

### Migration 041

```sql
ALTER TABLE stylists ADD COLUMN ig_collab INTEGER DEFAULT 0;
-- 0 = not opted in (default), 1 = opted in
```

No other schema changes needed.

---

## Section 2: SMS Opt-In / Opt-Out

### New keywords in `src/core/messageRouter.js`

**`COLLAB`** — opt in:
- Set `stylists.ig_collab = 1` WHERE `phone = from`
- Reply: *"You're in! You'll be tagged as a collaborator on your posts going forward. You'll get an Instagram notification each time — just tap Accept and it'll show up on your profile too. Text NOCOLLAB anytime to turn it off."*

**`NOCOLLAB`** — opt out:
- Set `stylists.ig_collab = 0` WHERE `phone = from`
- Reply: *"Got it — collaborator tagging is off. Text COLLAB anytime to turn it back on."*

Both keywords handled before the photo/message routing logic. No session state needed — single-message commands.

### Welcome SMS update (`src/core/stylistWelcome.js`)

Add to both the consent flow and the resend flow (already-consented path):

> *"Text COLLAB to have your work show up on your personal Instagram too."*

Added as a bullet/line in the existing welcome message body.

---

## Section 3: Admin Toggle

**Location:** Team → Edit Stylist page (`src/routes/stylistManager.js`)

New toggle in the edit form (alongside existing fields):

```
[ ] Tag as Instagram Collaborator
    When on, posts published to Instagram will invite this stylist
    as a collaborator. Requires their @instagram_handle to be set.
```

- Rendered as a checkbox in the existing edit form — saved on the same `POST /manager/stylists/:id/update` submit (no new route needed)
- If `instagram_handle` is empty: checkbox is `disabled` with helper text *"Set an Instagram handle first"*
- Reflects current `ig_collab` value on page load
- Manager can toggle regardless of whether stylist texted COLLAB

---

## Section 4: Instagram Publisher

**File:** `src/publishers/instagram.js`

When creating the media container, look up the stylist's collab preference:

```js
// If post has a stylist_id, check their collab opt-in
const stylist = post.stylist_id
  ? db.prepare(`SELECT instagram_handle, ig_collab FROM stylists WHERE id = ?`).get(post.stylist_id)
  : null;

const collaborators = (stylist?.ig_collab && stylist?.instagram_handle)
  ? [stylist.instagram_handle.replace(/^@/, "")]
  : undefined;
```

Add `collaborators` to the media container payload (only when defined — undefined fields are omitted by JSON.stringify):

```js
const payload = {
  image_url: mediaUrl,
  caption: igCaption,
  ...(collaborators ? { collaborators } : {}),
};
```

**Non-blocking error handling:** If the API returns an error referencing the collaborators field, log a warning and retry the publish without the `collaborators` field. The post must go live on the salon's side regardless.

**Constraints (logged as warnings, not errors):**
- Stylist account must be public — private accounts silently ignore the invite
- Handle must exactly match their IG username — API returns error on mismatch

---

## Section 5: Caption Bug Fix

**File:** `src/core/composeFinalCaption.js`

### Bug 1 — "Book in bio" on Facebook posts
"Book in bio" is an Instagram-only convention (refers to the IG bio link field). Facebook posts have a direct URL and don't use "link in bio" phrasing.

**Fix:** Only include "book in bio" CTA text when composing the IG variant. FB variant uses only the direct booking URL.

### Bug 2 — Blank "Book now" on Instagram posts
When no `booking_url` is set for the salon, the IG caption is including a "Book now" line with an empty or null URL.

**Fix:** Suppress the "Book now" / booking CTA entirely when `booking_url` is null or empty string. Both FB and IG variants affected.

---

## Permissions

No new Meta app permissions required. The `collaborators` field in the Instagram media creation endpoint is covered by the existing `instagram_content_publish` permission (already approved for production).

Verify: check logs on first live collab post — a successful `creation_id` response confirms no permission gap.

---

## Out of Scope

- Stylist portal / persistent stylist login (deferred)
- Facebook collaborator equivalent (Facebook has no equivalent collab feature)
- Auto-accepting collab invitations on stylist's behalf (requires stylist OAuth, not in scope)
- Analytics on collab acceptance rate (future)
