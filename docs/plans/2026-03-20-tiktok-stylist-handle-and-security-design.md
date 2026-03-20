# Design: TikTok Stylist Handle + Dependabot Security Fix
_Date: 2026-03-20_

## Scope

Three tasks resolved in this session:

1. **Manager dashboard pending edit (verified)** — No build needed. Current `/manager/edit/:id` correctly exposes only the caption textarea. Hashtags, booking URL, and Styled By are system-controlled and must not be editable from the manager dashboard.

2. **TikTok handle on stylist profile + caption tagging** — Add `tiktok_handle` to the `stylists` table, expose it in the edit form, and inject `@handle` into TikTok captions.

3. **Dependabot security fix** — Upgrade `socket.io` to resolve `socket.io-parser <4.2.6` vulnerability (GHSA-677m-j7p3-52f9).

---

## Task 1: Manager Dashboard Edit — Verified Correct

**Finding:** No changes needed.

The edit form at `GET /manager/edit/:id` and `POST /manager/edit/:id` (in `src/routes/manager.js`) only exposes a caption textarea. This is the correct and intended behavior. Hashtags, booking URL, and Styled By are all applied automatically by the system:

- **Styled By** — set from stylist DB record at caption-compose time; also set via coordinator URL selection
- **Hashtags** — merged from AI tags, salon defaults, vendor-specific tags, and `#MostlyPostly` in `composeFinalCaption.js`
- **Booking URL** — pulled from `salons.booking_url` at publish time

These fields are only editable by stylists/coordinators via the portal edit URL. No manager dashboard edit surface should expose them.

---

## Task 2: TikTok Stylist Handle

### Problem

The `stylists` table has no `tiktok_handle` column. When a post publishes to TikTok, the caption currently uses the stylist's name in the "Styled By" line rather than their TikTok `@handle`. This misses the tagging opportunity that drives profile traffic for the stylist.

### Design

**Migration 052** (`migrations/052_stylist_tiktok_handle.js`)
- Add `tiktok_handle TEXT` to `stylists` — nullable, no default

**Stylist edit form** (`src/routes/stylistManager.js`)
- Add "TikTok Handle" text input to the edit stylist form
- Normalize on save: strip leading `@` before writing to DB (consistent with `instagram_handle`)
- Label: "TikTok Handle" — placeholder: `username` (no @)

**Caption composer** (`src/core/composeFinalCaption.js`)
- Add `tiktokHandle` to the function signature (optional, defaults to empty string)
- Add `platform === "tiktok"` branch in the Styled By section:
  - If `tiktokHandle` is set → `Styled By: @{tiktokHandle}`
  - Else fall back to name: `Styled By: {creditName}` or `Styled By: Team Member`

**TikTok publisher** (`src/publishers/tiktok.js`)
- When building caption for photo or video posts, fetch the stylist row to get `tiktok_handle`
- Pass `tiktokHandle: stylist?.tiktok_handle || ""` and `platform: "tiktok"` to `composeFinalCaption`

### Acceptance Criteria
- [ ] `stylists.tiktok_handle` column exists after migration runs
- [ ] Stylist edit form shows TikTok Handle field; value saves correctly (no leading @)
- [ ] TikTok caption for a stylist with a handle shows `Styled By: @handle`
- [ ] TikTok caption for a stylist without a handle shows `Styled By: Name`
- [ ] No changes to Instagram or Facebook caption behavior

---

## Task 3: Dependabot — socket.io-parser Vulnerability

### Problem

`socket.io@4.8.1` bundles `socket.io-parser@4.2.4`.

Advisory **GHSA-677m-j7p3-52f9**: socket.io-parser allows an unbounded number of binary attachments. Affected range: `<4.2.6`. Severity: **High**.

### Fix

Upgrade `socket.io` to the latest stable 4.x release, which ships with `socket.io-parser >=4.2.6`.

```bash
npm install socket.io@latest
npm list socket.io-parser   # verify >=4.2.6
```

Commit `package.json` + `package-lock.json`.

### Acceptance Criteria
- [ ] `socket.io-parser` resolves to `>=4.2.6` in `npm list`
- [ ] `npm audit` reports no high/critical vulnerabilities
- [ ] No regressions in real-time features (socket.io is used for live UI updates)

---

## Task IDs

- Task 2 (TikTok handle): #2
- Task 3 (Security fix): #3
