# Vendor Enhancements — Design Doc

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:writing-plans to create the implementation plan.

**Date:** 2026-03-18
**Feature:** FEAT-031 enhanced — Vendor Console + Client Config + Hashtag Tiers + Affiliate URLs
**Status:** Design approved, ready for implementation planning

---

## Goal

Extend the vendor system with brand-level configuration, manual campaign management in the platform console, client-side affiliate URL + category filtering, a structured hashtag tier system, and campaign renewal at both console and client levels.

## Architecture

Follows the existing vendor infrastructure (`vendor_campaigns`, `salon_vendor_feeds`, `salon_vendor_approvals`, `vendor_post_log`, `vendorScheduler.js`). Adds a new `vendor_brands` table as the shared foundation for brand-level config. All hashtag injection happens at post-generation time in `vendorScheduler.js` — locked tags are appended after AI caption, never passed to AI. Affiliate URL is passed into the caption generation prompt.

## Tech Stack

- SQLite migrations (idempotent PRAGMA checks)
- Express routes: `src/routes/vendorAdmin.js` (console) + `src/routes/vendorFeeds.js` (client)
- `src/core/vendorScheduler.js` — caption generation + hashtag injection + category filtering
- `src/core/composeFinalCaption.js` — hashtag tier enforcement for standard posts

---

## Section 1: Database Schema

### New table: `vendor_brands`
One row per brand. Source of truth for brand-level config.

```sql
CREATE TABLE IF NOT EXISTS vendor_brands (
  vendor_name          TEXT PRIMARY KEY,
  brand_hashtags       TEXT DEFAULT '[]',  -- JSON array, max 2
  categories           TEXT DEFAULT '[]',  -- JSON array of category name strings
  allow_client_renewal INTEGER DEFAULT 1,
  created_at           TEXT DEFAULT (datetime('now'))
);
```

Back-fill: insert one row per distinct `vendor_name` in `vendor_campaigns` with empty defaults on migration run.

### Updates to `vendor_campaigns`

```sql
ALTER TABLE vendor_campaigns ADD COLUMN category TEXT;         -- required at creation; e.g. "Color", "Standard", "Promotion"
ALTER TABLE vendor_campaigns ADD COLUMN product_hashtag TEXT;  -- single hashtag e.g. "#FullSpectrum", max 1
```

### Updates to `salon_vendor_feeds`

```sql
ALTER TABLE salon_vendor_feeds ADD COLUMN affiliate_url    TEXT;  -- salon's brand-specific affiliate link
ALTER TABLE salon_vendor_feeds ADD COLUMN category_filters TEXT DEFAULT '[]'; -- JSON array of selected category names
```

### `vendor_post_log` — renew impact

Renew deletes log rows for that `campaign_id` where `posted_month = strftime('%Y-%m', 'now')`. This resets the frequency cap for the current month only.

---

## Section 2: Console — Vendor Brand Config + Campaign Management

### Brand Config panel (`src/routes/vendorAdmin.js`)

New section in the Platform Console, rendered above the campaigns list, grouped per brand. Each brand gets a collapsible config card.

**`GET /internal/vendors`** — existing route, extended to also query `vendor_brands` and pass to template.

**`POST /internal/vendors/brand-config`** (new route)
- Body: `vendor_name`, `brand_hashtags[]` (2 inputs), `categories` (comma-separated string), `allow_client_renewal` (0/1)
- Normalizes hashtags: trim, add `#` prefix if missing, max 2
- Parses categories: split by comma, trim, deduplicate
- UPSERT into `vendor_brands`

**Brand config card UI fields:**
- Brand hashtags: 2 text inputs, `#` prefix hint
- Categories: text input (comma-separated), rendered as tag chips below
- Allow client renewals: toggle switch
- Save button per brand

### Manual Add Campaign form

New **"+ Add Campaign"** button per vendor section opens an inline form with:

| Field | Type | Notes |
|---|---|---|
| Vendor Name | text/select | Pre-filled if within a vendor section |
| Campaign Name | text | Required |
| **Category** | select | Required — populated from `vendor_brands.categories` for that brand |
| Product Name | text | Required |
| Product Description | textarea | |
| Photo URL | text | |
| **Product Hashtag** | text | Max 1, e.g. `#FullSpectrum` |
| Tone Direction | text | |
| CTA Instructions | text | |
| Service Pairing Notes | text | |
| Expires At | date | Required if category = "Promotion"; optional for "Standard" |
| Frequency Cap | number | Default 4 |

**`POST /internal/vendors/campaign/add`** (new route)
- Validates required fields: vendor_name, campaign_name, category, product_name
- Validates expires_at required if category is "Promotion"
- Normalizes product_hashtag: add `#` prefix if missing, take first only
- INSERT into `vendor_campaigns`

### Campaign list: active/expired status + renew

Each campaign row in the console list gains:
- **Active** badge (green) if `expires_at IS NULL OR expires_at >= today`
- **Expired** badge (red) if `expires_at < today`
- **Renew** button on expired campaigns → `POST /internal/vendors/campaign/renew`

**`POST /internal/vendors/campaign/renew`** (new route)
- Body: `campaign_id`
- Updates `vendor_campaigns SET expires_at = date(expires_at, '+30 days')` (or `date('now', '+30 days')` if currently null)
- Deletes from `vendor_post_log WHERE campaign_id = ? AND posted_month = strftime('%Y-%m', 'now')`
- Redirects back with `?renewed=1` flash

---

## Section 3: Client — Vendor Configuration + Renew

### Vendor Settings section on `/manager/vendors`

Each approved+enabled vendor card gains a **Settings** sub-section (collapsed by default).

**UI layout:**
```
▼ [VendorName] Settings

  Affiliate URL
  [ https://aveda.com/ref/salon-slug          ]
  ℹ Your unique partner link — added to all [VendorName] posts automatically.
     Also serves as proof of partnership when requesting access.

  Product Categories to Sync
  ☑ Color    ☑ Highlights    ☐ Treatment    ☑ Haircut
  (Only campaigns in selected categories will be scheduled. Leave all unchecked to sync all.)

  [ Save Settings ]
```

**`POST /manager/vendors/settings`** (new route, requireAuth)
- Body: `vendor_name`, `affiliate_url`, `category_filters[]`
- Uses `req.session.salon_id` — never `req.body.salon_id`
- Updates `salon_vendor_feeds` for (salon_id, vendor_name)
- If `affiliate_url` present and approval status is `pending` or not yet requested → sets `salon_vendor_approvals.proof_file = affiliate_url` (URL replaces document upload as proof)

### Renew button on client side

On each campaign row within an expanded vendor card, expired campaigns show a **Renew** button — but only rendered if `vendor_brands.allow_client_renewal = 1` for that brand.

**`POST /manager/vendors/renew-campaign`** (new route, requireAuth)
- Body: `campaign_id`
- Verify campaign belongs to a vendor the salon has approved+enabled access to (IDOR guard)
- Check `vendor_brands.allow_client_renewal = 1` for that vendor
- Same renew logic as console: +30 days on `expires_at`, delete current month log rows
- Redirects to `/manager/vendors?renewed=<campaign_name>`

---

## Section 4: Hashtag Tier System + Affiliate URL in Posts

### Hashtag tiers

| Tier | Source | Standard posts | Vendor posts | Editable by client? |
|---|---|---|---|---|
| Client defaults | `salons.default_hashtags` | First 5 | First 3 | Yes |
| AI/stylist | Generated or post edit | Up to 2 | 0 (replaced) | Yes |
| Vendor brand | `vendor_brands.brand_hashtags` | n/a | Max 2 | No — locked |
| Product | `vendor_campaigns.product_hashtag` | n/a | Max 1 | No — locked |
| Brand tag | `#MostlyPostly` | Appended | Appended (always) | No |

**Standard posts** — no change to current behavior. `composeFinalCaption.js` continues to merge client defaults (up to 5) + AI tags + `#MostlyPostly`.

**Vendor posts** — `vendorScheduler.js` updated:
1. Take first 3 of `salon.default_hashtags`
2. Append `vendor_brands.brand_hashtags` (max 2)
3. Append `campaign.product_hashtag` if set (max 1)
4. Append `#MostlyPostly`
5. These locked tags are **appended after** AI caption text — never passed into the OpenAI prompt (prevents AI from dropping or reordering them)

### Affiliate URL in caption generation

`generateVendorCaption()` in `vendorScheduler.js`:
- Fetch `salon_vendor_feeds.affiliate_url` for (salon_id, vendor_name)
- If set: add to OpenAI user prompt — *"Include this partner link in the post: {url}"*
- If not set: generate as today (no URL), backwards compatible

### Category filter in campaign selection

`vendorScheduler.js` campaign selection:
- Fetch `salon_vendor_feeds.category_filters` for the salon+vendor
- If array is non-empty: `WHERE campaign.category IN (filters)`
- If empty/null: no category filter (all campaigns eligible — backwards compatible)

---

## Plan Gates

- Vendor features remain **Pro plan only** (no change)
- `allow_client_renewal` console toggle gates the client-side Renew button per brand
- Affiliate URL field visible to all approved vendors regardless of renewal setting

---

## Out of Scope (separate features)

- **FEAT-036** — Auto-reuse/recycle posts when queue runs low (standard + vendor posts, caption refresh, exclusion rules for promotions + celebrations)
- Vendor CSV import changes (categories + product_hashtag columns can be added to CSV template in a follow-up)
