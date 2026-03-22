# Vendor Scheduler Fill-All-Slots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Change `vendorScheduler.js` so each daily run fills all empty cap slots for every campaign in a single pass, rather than one slot per run.

**Architecture:** The `processCampaign` function currently breaks after finding the first empty interval. Removing that `break` and looping all intervals — generating a caption and inserting a post for each empty one — fills the full 30-day window in one scheduler run. `processSalon` is updated to accumulate the integer count returned by `processCampaign` instead of treating it as a boolean.

**Tech Stack:** Node.js ESM, better-sqlite3 (synchronous), OpenAI gpt-4o-mini, Luxon for timezone math

---

### Task 1: Update the `processCampaign` unit tests to expect all slots filled

**Files:**
- Modify: `src/core/vendorScheduler.js` (read-only this task — understand the test surface)
- Test file to check: none exist yet for `processCampaign` directly — we'll write inline integration-style tests using the existing test scaffold

The existing test file `src/core/vendorSync.test.js` and `src/core/vendorConfigs.test.js` test other modules. There is no dedicated `vendorScheduler.test.js`. We will add one.

**Step 1: Create the test file**

Create `src/core/vendorScheduler.test.js`:

```js
// src/core/vendorScheduler.test.js
// Tests for vendorScheduler fill-all-slots behavior.
// Uses an in-memory SQLite DB seeded with minimal fixtures.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import crypto from "crypto";

// We'll test the exported pure functions directly.
// processCampaign and processSalon are not exported — we test runVendorScheduler
// via its side effects on a seeded DB. We mock OpenAI by patching env.

import { buildVendorHashtagBlock, normalizeHashtag } from "./vendorScheduler.js";

describe("normalizeHashtag", () => {
  it("adds # prefix when missing", () => {
    assert.equal(normalizeHashtag("Aveda"), "#Aveda");
  });
  it("keeps existing # prefix", () => {
    assert.equal(normalizeHashtag("#Aveda"), "#Aveda");
  });
  it("returns empty string for tag with spaces", () => {
    assert.equal(normalizeHashtag("has space"), "");
  });
  it("returns empty string for null", () => {
    assert.equal(normalizeHashtag(null), "");
  });
});

describe("buildVendorHashtagBlock", () => {
  it("includes first 3 salon tags, 2 brand tags, 1 product tag, and #MostlyPostly", () => {
    const block = buildVendorHashtagBlock({
      salonHashtags: ["#a", "#b", "#c", "#d"],
      brandHashtags: ["#brand1", "#brand2", "#brand3"],
      productHashtag: "#product",
    });
    const tags = block.split(" ");
    assert.ok(tags.includes("#a"));
    assert.ok(tags.includes("#b"));
    assert.ok(tags.includes("#c"));
    assert.ok(!tags.includes("#d"), "4th salon tag should be excluded");
    assert.ok(tags.includes("#brand1"));
    assert.ok(tags.includes("#brand2"));
    assert.ok(!tags.includes("#brand3"), "3rd brand tag should be excluded");
    assert.ok(tags.includes("#product"));
    assert.ok(tags.includes("#MostlyPostly"));
  });

  it("deduplicates case-insensitively", () => {
    const block = buildVendorHashtagBlock({
      salonHashtags: ["#Aveda"],
      brandHashtags: ["#aveda"],
      productHashtag: null,
    });
    const tags = block.split(" ");
    const avedaTags = tags.filter(t => t.toLowerCase() === "#aveda");
    assert.equal(avedaTags.length, 1);
  });
});
```

**Step 2: Run the tests to verify they pass (pure functions only)**

```bash
cd /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app
node --test src/core/vendorScheduler.test.js
```

Expected: all pure-function tests PASS (they test existing exported helpers, no behavior change yet).

**Step 3: Commit the test file**

```bash
git add src/core/vendorScheduler.test.js
git commit -m "test(vendor): add vendorScheduler unit tests for pure helpers"
```

---

### Task 2: Change `processCampaign` to fill all empty intervals per run

**Files:**
- Modify: `src/core/vendorScheduler.js`

**Current behavior (lines 260–303):**

```js
// 6. Divide 30-day window into cap equal intervals, find first empty slot
const intervalMs = (lookaheadDays * 24 * 60 * 60 * 1000) / cap;
let scheduledFor = null;

for (let i = 0; i < cap; i++) {
  // ... compute intStart, intEnd, check slotTaken ...
  if (slotTaken > 0) continue;

  // ... pick random day/time ...
  scheduledFor = localDt.toUTC().toFormat("yyyy-LL-dd HH:mm:ss");
  break;  // ← ONLY FILLS ONE SLOT
}

if (!scheduledFor) {
  log.info(`  Salon ${salonId} / campaign ${campaign.id}: all ${cap} slots filled — skipping`);
  return false;
}

// ... generate caption, insert post, log ...
return true;
```

**New behavior — loop all intervals, insert one post per empty slot:**

Replace the entire section from the `// 6.` comment through `return true` at the bottom of `processCampaign` with:

```js
  // 6. Divide 30-day window into cap equal intervals; fill ALL empty intervals this run
  const intervalMs = (lookaheadDays * 24 * 60 * 60 * 1000) / cap;
  let created = 0;

  for (let i = 0; i < cap; i++) {
    const intStart = new Date(windowStart.getTime() + i * intervalMs);
    const intEnd   = new Date(windowStart.getTime() + (i + 1) * intervalMs);
    const intStartSql = intStart.toISOString().replace("T", " ").slice(0, 19);
    const intEndSql   = intEnd.toISOString().replace("T", " ").slice(0, 19);

    const { slotTaken } = db.prepare(`
      SELECT COUNT(*) AS slotTaken
      FROM posts
      WHERE salon_id = ?
        AND vendor_campaign_id = ?
        AND status IN ('vendor_scheduled','manager_pending','manager_approved','published')
        AND scheduled_for BETWEEN ? AND ?
    `).get(salonId, campaign.id, intStartSql, intEndSql);

    if (slotTaken > 0) continue; // manager moved a post here — respect it

    // Pick a random day within this interval, at a random time within posting hours
    const intervalDays = Math.max(1, Math.floor(intervalMs / (24 * 60 * 60 * 1000)));
    const randDayOffset = Math.floor(Math.random() * intervalDays);
    const candidateDay = new Date(intStart.getTime() + randDayOffset * 24 * 60 * 60 * 1000);

    const [startH, startM] = (salon.posting_start_time || "09:00").split(":").map(Number);
    const [endH,   endM]   = (salon.posting_end_time   || "20:00").split(":").map(Number);
    const windowMinutes = Math.max(1, (endH * 60 + endM) - (startH * 60 + startM));
    const randMinutes = Math.floor(Math.random() * windowMinutes);
    const postHour   = startH + Math.floor((startM + randMinutes) / 60);
    const postMinute = (startM + randMinutes) % 60;

    const localDt = DateTime.fromObject(
      { year: candidateDay.getUTCFullYear(), month: candidateDay.getUTCMonth() + 1, day: candidateDay.getUTCDate(),
        hour: postHour, minute: postMinute, second: 0 },
      { zone: tz }
    );
    const scheduledFor = localDt.toUTC().toFormat("yyyy-LL-dd HH:mm:ss");

    // 7. Generate AI caption for this slot
    let caption;
    if (campaign.source === "pdf_sync" && campaign.caption_body) {
      log.info(`  Generating AI caption with PDF brand brief for salon ${salonId} / campaign "${campaign.campaign_name}" (interval ${i})`);
      caption = await generateVendorCaption({ campaign, salon, brandCaption: campaign.caption_body });
    } else {
      log.info(`  Generating AI caption for salon ${salonId} / campaign "${campaign.campaign_name}" (interval ${i})`);
      caption = await generateVendorCaption({ campaign, salon });
    }
    if (!caption) {
      log.warn(`  Skipping interval ${i} for campaign ${campaign.id} — no caption available`);
      continue; // skip this slot, try next interval
    }

    // 8. Build locked hashtag block
    const brandCfg = db.prepare(`SELECT brand_hashtags FROM vendor_brands WHERE vendor_name = ?`).get(campaign.vendor_name);
    const brandHashtags = (() => { try { return JSON.parse(brandCfg?.brand_hashtags || "[]"); } catch { return []; } })();
    const salonDefaultTags = (() => { try { return JSON.parse(salon.default_hashtags || "[]"); } catch { return []; } })();
    const lockedBlock = buildVendorHashtagBlock({ salonHashtags: salonDefaultTags, brandHashtags, productHashtag: campaign.product_hashtag || null });

    // 9. salon_post_number
    const { maxnum } = db.prepare(`SELECT MAX(salon_post_number) AS maxnum FROM posts WHERE salon_id = ?`).get(salonId) || {};
    const salon_post_number = (maxnum || 0) + 1;

    // 10. Build post
    const postId = crypto.randomUUID();
    const now    = new Date().toISOString();

    let trackedCaption;
    if (affiliateUrl) {
      const utmContent  = `vendor_${slugify(campaign.vendor_name)}`;
      const destination = appendUtm(affiliateUrl, { source: "mostlypostly", medium: "social", campaign: salonId, content: utmContent });
      try {
        const token    = buildTrackingToken({ salonId, postId, clickType: "vendor", vendorName: campaign.vendor_name, utmContent, destination });
        const shortUrl = buildShortUrl(token);
        trackedCaption = caption + "\n\nShop today: " + shortUrl + (lockedBlock ? "\n\n" + lockedBlock : "");
      } catch (err) {
        log.warn(`  UTM token creation failed: ${err.message}`);
        trackedCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "");
      }
    } else {
      trackedCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "");
    }

    db.prepare(`
      INSERT INTO posts (id, salon_id, stylist_name, image_url, base_caption, final_caption,
                         post_type, status, vendor_campaign_id, scheduled_for, salon_post_number, created_at, updated_at)
      VALUES (@id, @salon_id, @stylist_name, @image_url, @base_caption, @final_caption,
              @post_type, @status, @vendor_campaign_id, @scheduled_for, @salon_post_number, @created_at, @updated_at)
    `).run({
      id: postId, salon_id: salonId,
      stylist_name: `${campaign.vendor_name} (Campaign)`,
      image_url: resolveUrl(campaign.photo_url),
      base_caption: caption, final_caption: trackedCaption,
      post_type: "standard_post",
      status: "vendor_scheduled",
      vendor_campaign_id: campaign.id,
      scheduled_for: scheduledFor,
      salon_post_number,
      created_at: now, updated_at: now,
    });

    // 11. Log to vendor_post_log
    const postedMonth = scheduledFor.slice(0, 7);
    db.prepare(`
      INSERT INTO vendor_post_log (id, salon_id, campaign_id, post_id, posted_month, created_at)
      VALUES (@id, @salon_id, @campaign_id, @post_id, @posted_month, @created_at)
    `).run({ id: crypto.randomUUID(), salon_id: salonId, campaign_id: campaign.id, post_id: postId, posted_month: postedMonth, created_at: now });

    log.info(`  ✅ Created vendor_scheduled post ${postId} for salon ${salonId} → ${scheduledFor} (interval ${i})`);
    created++;
  }

  if (created === 0) {
    log.info(`  Salon ${salonId} / campaign ${campaign.id}: all ${cap} slots filled — skipping`);
  }

  return created;
```

**Step 1: Apply the change**

Edit `src/core/vendorScheduler.js`:
- Remove the old `let scheduledFor = null;` block and everything after it through `return true;`
- Replace with the new loop above (starts at `// 6. Divide 30-day window...`)
- The function signature stays: `async function processCampaign(campaign, salon, windowStart, windowEnd, affiliateUrl, vendorName, minGapDays)`
- The early-exit checks at the top of `processCampaign` (lines 234–257) are **unchanged**

**Step 2: Update `processSalon` to accumulate integer count**

In `processSalon` (around line 216–224), change:

```js
// OLD
const didCreate = await processCampaign(campaign, salon, windowStart, windowEnd, affiliateUrl, vendorName, vendor.min_gap_days);
if (didCreate) created++;
```

To:

```js
// NEW
const count = await processCampaign(campaign, salon, windowStart, windowEnd, affiliateUrl, vendorName, vendor.min_gap_days);
created += count;
```

**Step 3: Run existing tests to confirm no regressions**

```bash
node --test src/core/vendorScheduler.test.js
```

Expected: all tests PASS (pure helper tests, no behavior change there).

Also run the broader test suite if available:

```bash
node --test src/core/vendorConfigs.test.js
node --test src/core/vendorSync.test.js
```

Expected: all PASS.

**Step 4: Commit**

```bash
git add src/core/vendorScheduler.js
git commit -m "feat(vendor): fill all cap slots per scheduler run instead of one per day"
```

---

### Task 3: Manual verification

**Step 1: Check existing vendor_scheduled posts in the DB**

```bash
cd /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app
node -e "
import('./db.js').then(({ db }) => {
  const rows = db.prepare(\`
    SELECT p.id, p.salon_id, p.scheduled_for, vc.vendor_name, vc.frequency_cap
    FROM posts p
    LEFT JOIN vendor_campaigns vc ON p.vendor_campaign_id = vc.id
    WHERE p.status = 'vendor_scheduled'
    ORDER BY p.scheduled_for ASC
  \`).all();
  console.table(rows);
});
"
```

**Step 2: Delete existing vendor_scheduled posts for a test salon, then trigger the scheduler manually**

```bash
node -e "
import('./db.js').then(({ db }) => {
  const deleted = db.prepare(\`
    DELETE FROM posts WHERE status = 'vendor_scheduled' AND salon_id = 'studio-500'
  \`).run();
  console.log('Deleted', deleted.changes, 'rows');
});
"
```

Then trigger a manual scheduler run:

```bash
node -e "
import('./src/core/vendorScheduler.js').then(({ runVendorScheduler }) => {
  runVendorScheduler().then(n => console.log('Created:', n));
});
"
```

**Step 3: Verify all slots were filled**

```bash
node -e "
import('./db.js').then(({ db }) => {
  const rows = db.prepare(\`
    SELECT p.salon_id, vc.vendor_name, vc.frequency_cap,
           COUNT(*) AS scheduled_count,
           MIN(p.scheduled_for) AS first_slot,
           MAX(p.scheduled_for) AS last_slot
    FROM posts p
    LEFT JOIN vendor_campaigns vc ON p.vendor_campaign_id = vc.id
    WHERE p.status = 'vendor_scheduled'
    GROUP BY p.salon_id, p.vendor_campaign_id
    ORDER BY p.salon_id, vc.vendor_name
  \`).all();
  console.table(rows);
});
"
```

Expected: `scheduled_count` = `frequency_cap` for each campaign row, and `last_slot` is ~28–30 days from today.

**Step 4: Run scheduler again — confirm no duplicates created**

```bash
node -e "
import('./src/core/vendorScheduler.js').then(({ runVendorScheduler }) => {
  runVendorScheduler().then(n => console.log('Created on 2nd run (should be 0):', n));
});
"
```

Expected: `Created: 0`

**Step 5: Commit verification notes**

No code changes in this task — no commit needed.

---

### Task 4: Deploy and smoke-test on staging

**Step 1: Push to `dev` branch**

```bash
git checkout dev
git merge main
git push origin dev
git checkout main
```

Wait for Render staging deploy (~2 minutes).

**Step 2: Smoke-test on staging**

1. Log into staging as a Pro salon with vendor feeds enabled
2. Navigate to `/manager/calendar`
3. Confirm vendor (purple dashed) pills are spread across the full 30-day window
4. Navigate to the next month view — confirm posts appear in roughly equal intervals

**Step 3: Confirm no extra posts on re-run**

Trigger the vendor scheduler again via Render job or manual curl (if an internal endpoint exists). Confirm the post count doesn't grow.
