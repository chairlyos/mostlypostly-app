# Content Type Classification + Placement Control — Design

**Date:** 2026-03-24
**Feature:** FEAT-057 (assign in FEATURES.md)
**Status:** Design approved, pending implementation plan

---

## Problem

A salon owner flagged that vendor content disrupts their Instagram grid aesthetic. The app has no concept of *where* content should go — every post is treated the same regardless of what it is. Managers currently make placement decisions manually with no system guidance.

## Goal

Every post has a semantic content type and a placement (story/post/reel) set automatically at intake. Managers see the recommendation and can override before approving. The app decides, the manager controls.

---

## Data Model

### New columns on `posts` table

```sql
content_type        TEXT     -- semantic label (what the content is)
placement           TEXT     -- story | post | reel (where it publishes)
placement_overridden INTEGER DEFAULT 0  -- 0 = used recommendation, 1 = manager changed it
```

### `content_type` enum values

| Value | Description |
|---|---|
| `standard_post` | General salon content |
| `before_after` | Transformation photos |
| `education` | Tutorial / tip content |
| `vendor_product` | Brand product content (non-promotional) |
| `vendor_promotion` | Time-sensitive brand offer |
| `reviews` | Google review repurposed as post *(intake deferred — pending GMB review pull feature)* |
| `celebration` | Birthday / work anniversary |
| `stylist_availability` | Open booking slots |

### Default placement + platform reach

| content_type | Default placement | Platforms reached |
|---|---|---|
| `before_after` | reel | IG · FB · TikTok |
| `standard_post` | post | IG · FB · GMB |
| `vendor_product` | story | IG · FB |
| `vendor_promotion` | story | IG · FB · GMB (as Offer post) |
| `reviews` | post | IG · FB *(not GMB — source platform)* |
| `education` | reel | IG · FB · TikTok |
| `celebration` | post | IG · FB · GMB |
| `stylist_availability` | story | IG · FB |

Platform reach is implicit in the placement + content_type combination. Per-salon platform toggles (`gmb_enabled`, `tiktok_enabled`, platform routing) still gate everything on top.

### New column on `vendor_campaigns` table

```sql
content_type TEXT  -- vendor_product | vendor_promotion
```

Mapped from existing `campaign_type` at post generation — no form changes needed in Platform Console.

---

## Classification at Intake

### Approach: Rules first, AI for ambiguous photo posts (Hybrid C)

**Deterministic rules — no AI needed:**

| Intake flow | content_type |
|---|---|
| Availability post (Zenoti / SMS) | `stylist_availability` |
| Celebration / birthday | `celebration` |
| Vendor campaign — Promotion type | `vendor_promotion` |
| Vendor campaign — all other types | `vendor_product` |
| Video / reel upload | `education` (AI can override) |
| Before/after (postClassifier.js match) | `before_after` |

**AI-assisted — ambiguous stylist photo submissions only:**

When `postClassifier.js` returns `standard_post`, add classification to the **existing OpenAI Vision caption generation prompt** (no extra API call):

```
Also identify the content type from: standard_post, before_after, education.
Return JSON: {"content_type": "...", "caption": "..."}
```

- AI sees image + stylist message text
- On parse failure → defaults to `standard_post`
- Manager always sees and can correct

**Vendor campaign mapping** (in `vendorScheduler.js`):

| campaign_type | content_type |
|---|---|
| Promotion | `vendor_promotion` |
| Standard · Educational · Product Launch · Seasonal · Brand Awareness | `vendor_product` |

---

## Manager Approval UI

New section on each pending post card, between caption preview and action buttons:

```
┌─────────────────────────────────────────────────────┐
│  Content Type             Placement                  │
│  [ Before & After ▾ ]    ● Reel  ○ Post  ○ Story    │
│                           Recommended by MostlyPostly│
├─────────────────────────────────────────────────────┤
│  Will post to: Instagram · Facebook · TikTok         │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- **Content type dropdown** — pre-filled from AI/rule classification. Changing it live-updates placement recommendation and "Will post to" line via inline JS (no page reload)
- **Placement radio buttons** — pre-selected to the system recommendation, labeled "Recommended by MostlyPostly." Selecting a different option sets `placement_overridden = 1` and removes the label
- **Will post to** — derived from placement + content_type. Platforms grayed out if not connected or not enabled for the salon
- Approve / Post Now submit current `content_type` + `placement` values — no extra step for manager

---

## Scheduler & Publishing

### Routing logic

`scheduler.js` will prefer `placement` when set, falling back to existing `post_type` routing for older posts:

```js
const resolvedPlacement = post.placement || deriveFromPostType(post.post_type);
// "story" | "post" | "reel"
```

| resolvedPlacement | Publishers called |
|---|---|
| `reel` | Reel publishers — IG + FB + TikTok |
| `story` | Story publishers — IG + FB only |
| `post` | Feed publishers — IG feed + FB + GMB |

**Platform-specific nuances:**
- `vendor_promotion` + `post` → calls `publishOfferToGmb` (not `publishWhatsNewToGmb`) using campaign `expires_at`
- `reviews` → GMB explicitly skipped regardless of placement
- `stylist_availability` → GMB explicitly skipped regardless of placement
- All per-salon platform toggles apply on top of placement routing

**`placement_overridden`** is stored for future analytics ("how often do managers override, and on which content types?") — no behavior change based on it in the scheduler.

---

## Backward Compatibility

- Posts without `placement` fall back to `post_type`-based routing — no existing posts break
- Posts without `content_type` display no content type label in the approval UI
- All new columns are nullable with safe defaults

---

## Out of Scope (This Feature)

- `reviews` intake flow (deferred — pending GMB review pull feature)
- Analytics dashboard showing override rates by content type
- Stylist-facing content type selection (manager-only for now)
- Platform Console vendor campaign form changes (existing `campaign_type` field reused via mapping)
