# UTM Tracking, Vendor Queue, and Console Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Implement UTM click tracking + ROI dashboard, Add-to-Queue with post count pill on vendor cards, and restructure the Platform Console into a brand-first hierarchy.

**Architecture:** UTM short tokens stored in utm_clicks table; public /t/ redirect endpoint logs clicks and bounces. Tracking URLs injected into final_caption at enqueue time (booking links) and at post-creation time (vendor affiliate links). Vendor queue UI calls generateVendorCaption directly for fresh captions. Platform Console gains a /brands → /brands/:name drill-down.

**Tech Stack:** Node.js/Express, better-sqlite3, crypto (built-in), existing vendorScheduler.js, scheduler.js, composeFinalCaption.js

---

## Key Context

- DB: synchronous better-sqlite3 — no await on DB calls
- ESM: always import/export, never require()
- Migrations: numbered files in migrations/ — next is 043
- enqueuePost(post): in src/scheduler.js — takes a post row, sets scheduled_for, respects posting window
- generateVendorCaption({ campaign, salon, affiliateUrl }): in src/core/vendorScheduler.js — async, calls OpenAI
- vendor_post_log: tracks monthly post count per salon+campaign. posted_month = 'YYYY-MM'
- Platform Console lives in src/routes/vendorAdmin.js, mounted at /internal/vendors
- Vendor salon page lives in src/routes/vendorFeeds.js, mounted at /manager/vendors
- PUBLIC_BASE_URL: env var — always .replace(/\/$/, "") before use

---

## Task 1: Migration 043 — utm_clicks + avg_ticket_value + product_value

**Files:**
- Create: migrations/043_utm_tracking.js
- Modify: migrations/index.js

**Implementation:**

migrations/043_utm_tracking.js:
```js
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS utm_clicks (
      id           TEXT PRIMARY KEY,
      token        TEXT NOT NULL UNIQUE,
      salon_id     TEXT NOT NULL,
      post_id      TEXT,
      click_type   TEXT NOT NULL,
      vendor_name  TEXT,
      utm_content  TEXT,
      utm_term     TEXT,
      destination  TEXT NOT NULL,
      clicked_at   TEXT,
      ip_hash      TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_utm_clicks_salon ON utm_clicks(salon_id);
    CREATE INDEX IF NOT EXISTS idx_utm_clicks_token ON utm_clicks(token);
  `);
  try { db.exec('ALTER TABLE salons ADD COLUMN avg_ticket_value INTEGER DEFAULT 95'); } catch {}
  try { db.exec('ALTER TABLE vendor_brands ADD COLUMN product_value INTEGER DEFAULT 45'); } catch {}
}
```

In migrations/index.js follow the existing import + array pattern for migration 43.

**Commit:** `feat: migration 043 — utm_clicks table + avg_ticket_value + product_value`

---

## Task 2: src/core/utm.js — UTM utility helpers

**Files:**
- Create: src/core/utm.js

```js
// src/core/utm.js

export function slugify(str) {
  if (!str) return "";
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function appendUtm(url, { source, medium, campaign, content, term } = {}) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (source)   u.searchParams.set("utm_source",   source);
    if (medium)   u.searchParams.set("utm_medium",   medium);
    if (campaign) u.searchParams.set("utm_campaign", campaign);
    if (content)  u.searchParams.set("utm_content",  content);
    if (term)     u.searchParams.set("utm_term",     term);
    return u.href;
  } catch {
    return url;
  }
}
```

**Commit:** `feat: utm.js — appendUtm and slugify helpers`

---

## Task 3: src/core/trackingUrl.js — Token builder

**Files:**
- Create: src/core/trackingUrl.js

```js
// src/core/trackingUrl.js
import crypto from "crypto";
import { db } from "../../db.js";

const BASE = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

function makeToken() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

export function buildTrackingToken({ salonId, postId = null, clickType, vendorName = null, utmContent = null, utmTerm = null, destination }) {
  const id    = crypto.randomUUID();
  const token = makeToken();
  const now   = new Date().toISOString();
  db.prepare(`
    INSERT INTO utm_clicks (id, token, salon_id, post_id, click_type, vendor_name, utm_content, utm_term, destination, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, token, salonId, postId, clickType, vendorName, utmContent, utmTerm, destination, now);
  return `${BASE()}/t/${token}`;
}

export function buildBioUrl(salonSlug) {
  return `${BASE()}/t/${salonSlug}/book`;
}
```

**Commit:** `feat: trackingUrl.js — buildTrackingToken and buildBioUrl`

---

## Task 4: src/routes/tracking.js — Public /t/ redirect route

**Files:**
- Create: src/routes/tracking.js
- Modify: server.js (add: import trackingRouter + app.use("/t", trackingRouter))

```js
// src/routes/tracking.js
import express from "express";
import crypto from "crypto";
import { db } from "../../db.js";
import { appendUtm } from "../core/utm.js";

const router = express.Router();

// Permanent bio link: /t/:slug/book — must be checked BEFORE token route
router.get("/:slug/book", (req, res) => {
  const salon = db.prepare(`SELECT slug, booking_url FROM salons WHERE slug = ?`).get(req.params.slug);
  if (!salon?.booking_url) return res.status(404).send("Booking link not configured.");
  const destination = appendUtm(salon.booking_url, {
    source: "mostlypostly", medium: "social",
    campaign: salon.slug, content: "bio_link",
  });
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) || req.socket.remoteAddress || "";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO utm_clicks (id, token, salon_id, post_id, click_type, destination, clicked_at, ip_hash, created_at)
    VALUES (?, ?, ?, NULL, 'bio', ?, ?, ?, ?)
  `).run(crypto.randomUUID(), `bio-${salon.slug}-${Date.now()}`, salon.slug, destination, now, ipHash, now);
  return res.redirect(302, destination);
});

// Token-based redirect
router.get("/:token", (req, res) => {
  const row = db.prepare(`SELECT * FROM utm_clicks WHERE token = ?`).get(req.params.token);
  if (!row) return res.status(404).send("Link not found.");
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) || req.socket.remoteAddress || "";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  if (!row.clicked_at || row.ip_hash !== ipHash) {
    db.prepare(`UPDATE utm_clicks SET clicked_at = ?, ip_hash = ? WHERE token = ?`)
      .run(new Date().toISOString(), ipHash, req.params.token);
  }
  return res.redirect(302, row.destination);
});

export default router;
```

In server.js, mount BEFORE manager routes:
```js
import trackingRouter from "./src/routes/tracking.js";
app.use("/t", trackingRouter);
```

**Commit:** `feat: /t/ redirect route — token clicks + per-salon bio link`

---

## Task 5: Inject UTM into vendor posts (vendorScheduler.js)

**Files:**
- Modify: src/core/vendorScheduler.js

Add at top:
```js
import { appendUtm, slugify } from "./utm.js";
import { buildTrackingToken } from "./trackingUrl.js";
```

Export generateVendorCaption (change `async function` to `export async function`).

Change generateVendorCaption to return `{ caption, safeAffiliateUrl }` instead of just the string.

In processCampaign, after building finalCaption and generating postId, before INSERT:
```js
// Wrap affiliate URL in tracking short URL
let trackedFinalCaption = finalCaption;
if (captionResult.safeAffiliateUrl) {
  const utmContent = `vendor_${slugify(campaign.vendor_name)}`;
  const destination = appendUtm(captionResult.safeAffiliateUrl, {
    source: "mostlypostly", medium: "social",
    campaign: salonId, content: utmContent,
  });
  const shortUrl = buildTrackingToken({
    salonId, postId, clickType: "vendor",
    vendorName: campaign.vendor_name,
    utmContent, destination,
  });
  trackedFinalCaption = finalCaption.replace(captionResult.safeAffiliateUrl, shortUrl);
}
```

Use trackedFinalCaption in the INSERT instead of finalCaption.

**Commit:** `feat: inject UTM tracking URLs into vendor post captions`

---

## Task 6: Inject UTM into booking URLs at enqueue time (scheduler.js)

**Files:**
- Modify: src/scheduler.js

Add imports:
```js
import { appendUtm, slugify } from "./core/utm.js";
import { buildTrackingToken } from "./core/trackingUrl.js";
```

Inside enqueuePost(), after setting scheduled but before final DB UPDATE, add:
```js
// Replace raw booking URL with tracking short URL in final_caption
const currentCaption = post.final_caption || "";
const bookingMatch = currentCaption.match(/Book:\s*(https?:\/\/\S+)/i);
if (bookingMatch) {
  const rawBookingUrl = bookingMatch[1];
  if (!rawBookingUrl.includes("/t/")) {
    const postType = post.post_type || "standard_post";
    const stylistTerm = slugify(post.stylist_name || "");
    const destination = appendUtm(rawBookingUrl, {
      source: "mostlypostly", medium: "social",
      campaign: post.salon_id, content: postType,
      term: stylistTerm || undefined,
    });
    const shortUrl = buildTrackingToken({
      salonId: post.salon_id, postId: post.id,
      clickType: "booking", utmContent: postType,
      utmTerm: stylistTerm || null, destination,
    });
    const trackedCaption = currentCaption.replace(bookingMatch[0], `Book: ${shortUrl}`);
    db.prepare(`UPDATE posts SET final_caption = ? WHERE id = ?`).run(trackedCaption, post.id);
  }
}
```

**Commit:** `feat: inject UTM tracking URL for booking links at enqueue time`

---

## Task 7: Admin UI — avg_ticket_value + IG bio link

**Files:**
- Modify: src/routes/admin.js

**Step 1:** Find the Business Info POST handler (search for where booking_url is saved to DB). Add avg_ticket_value to the SET clause:
```js
const avg_ticket_value = parseInt(req.body.avg_ticket_value, 10) || 95;
// Add to UPDATE: avg_ticket_value = ?
```

**Step 2:** In the Business Info card HTML form, after the booking_url field add:

```html
<div>
  <label class="block text-sm font-semibold text-mpCharcoal mb-1">Avg Ticket Value</label>
  <div class="relative">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mpMuted text-sm">$</span>
    <input type="number" name="avg_ticket_value" min="1" max="9999"
           value="${safe(String(salon.avg_ticket_value || 95))}"
           class="w-full pl-7 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-mpAccent" />
  </div>
  <p class="text-xs text-mpMuted mt-1">Used to estimate booking revenue from post clicks. Default $95.</p>
</div>
<div>
  <label class="block text-sm font-semibold text-mpCharcoal mb-1">Instagram Bio Link</label>
  <div class="flex gap-2 items-center">
    <input type="text" readonly id="bio-link-field"
           value="${safe(PUBLIC_BASE + '/t/' + salon.slug + '/book')}"
           class="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-mpMuted" />
    <button type="button"
            onclick="navigator.clipboard.writeText(document.getElementById('bio-link-field').value);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)"
            class="px-3 py-2 text-xs font-semibold bg-mpCharcoal text-white rounded-xl hover:bg-mpCharcoalDark">Copy</button>
  </div>
  <p class="text-xs text-mpMuted mt-1">Paste into your Instagram bio to track booking clicks automatically.</p>
</div>
```

Note: PUBLIC_BASE must be computed in the route handler: `const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");`

**Commit:** `feat: admin — avg ticket value field + IG bio link copy widget`

---

## Task 8: Analytics — Link Performance card

**Files:**
- Modify: src/routes/analytics.js

**Step 1:** In the main GET handler, after loading the salon row, add:
```js
const timeFilter = ["prevmonth", "all"].includes(req.query.period) ? req.query.period : "month";
const tz = salon.timezone || "America/Indiana/Indianapolis";
const nowLocal = DateTime.now().setZone(tz);
const thisMonth = nowLocal.toFormat("yyyy-LL");
const prevMonth = nowLocal.minus({ months: 1 }).toFormat("yyyy-LL");
const monthFilter = timeFilter === "prevmonth" ? prevMonth : thisMonth;

const clickRows = timeFilter === "all"
  ? db.prepare(`SELECT click_type, COUNT(*) as cnt FROM utm_clicks WHERE salon_id = ? AND clicked_at IS NOT NULL GROUP BY click_type`).all(salon_id)
  : db.prepare(`SELECT click_type, COUNT(*) as cnt FROM utm_clicks WHERE salon_id = ? AND clicked_at IS NOT NULL AND strftime('%Y-%m', clicked_at) = ? GROUP BY click_type`).all(salon_id, monthFilter);

const bookingClicks = clickRows.find(r => r.click_type === "booking")?.cnt || 0;
const vendorClicks  = clickRows.find(r => r.click_type === "vendor")?.cnt  || 0;
const bioClicks     = clickRows.find(r => r.click_type === "bio")?.cnt     || 0;
const ticketValue   = salon.avg_ticket_value || 95;
const totalRoi = (bookingClicks + bioClicks) * ticketValue + vendorClicks * 45;
```

**Step 2:** Add Link Performance HTML card after existing analytics content:
```html
<div class="rounded-2xl border border-mpBorder bg-white p-5 mt-6">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-bold text-mpCharcoal">Link Performance</h2>
    <div class="flex gap-1 text-xs">
      <a href="?period=month"     class="px-3 py-1 rounded-full ${timeFilter==='month'     ? 'bg-mpCharcoal text-white' : 'text-mpMuted hover:text-mpCharcoal'}">This month</a>
      <a href="?period=prevmonth" class="px-3 py-1 rounded-full ${timeFilter==='prevmonth' ? 'bg-mpCharcoal text-white' : 'text-mpMuted hover:text-mpCharcoal'}">Last month</a>
      <a href="?period=all"       class="px-3 py-1 rounded-full ${timeFilter==='all'       ? 'bg-mpCharcoal text-white' : 'text-mpMuted hover:text-mpCharcoal'}">All time</a>
    </div>
  </div>
  <table class="w-full text-sm">
    <thead><tr class="text-xs text-mpMuted border-b border-mpBorder">
      <th class="text-left pb-2 font-semibold">Source</th>
      <th class="text-right pb-2 font-semibold">Clicks</th>
      <th class="text-right pb-2 font-semibold">Est. Revenue</th>
    </tr></thead>
    <tbody class="divide-y divide-mpBorder">
      <tr><td class="py-2">Booking links</td><td class="py-2 text-right text-mpMuted">${bookingClicks}</td><td class="py-2 text-right font-semibold">$${(bookingClicks * ticketValue).toLocaleString()}</td></tr>
      <tr><td class="py-2">Vendor links</td><td class="py-2 text-right text-mpMuted">${vendorClicks}</td><td class="py-2 text-right font-semibold">$${(vendorClicks * 45).toLocaleString()}</td></tr>
      ${bioClicks > 0 ? `<tr><td class="py-2">Instagram bio</td><td class="py-2 text-right text-mpMuted">${bioClicks}</td><td class="py-2 text-right font-semibold">$${(bioClicks * ticketValue).toLocaleString()}</td></tr>` : ""}
    </tbody>
    <tfoot><tr class="border-t-2 border-mpBorder">
      <td class="pt-3 font-bold" colspan="2">Total est. ROI via MostlyPostly</td>
      <td class="pt-3 text-right font-bold text-mpAccent text-base">$${totalRoi.toLocaleString()}</td>
    </tr></tfoot>
  </table>
  ${ticketValue === 95 && totalRoi === 0 ? `<p class="text-xs text-yellow-700 bg-yellow-50 rounded-xl px-3 py-2 mt-4">Set your <a href="/manager/admin" class="underline font-semibold">avg ticket value</a> and update your Instagram bio link to start tracking clicks.</p>` : ""}
</div>
```

**Commit:** `feat: analytics — Link Performance card with click counts and ROI`

**Push UTM feature to production:**
```bash
git push origin main && git push origin main:dev
```

---

## Task 9: Vendor card — post count pill + Add to Queue + Reset

**Files:**
- Modify: src/routes/vendorFeeds.js

**Step 1:** Add import crypto at top if not present.

**Step 2:** In the campaign render loop (inside vendors.map, inside nonExpired.map), query the count:
```js
const monthCount = db.prepare(`SELECT COUNT(*) AS cnt FROM vendor_post_log WHERE salon_id = ? AND campaign_id = ? AND posted_month = ?`).get(salon_id, c.id, new Date().toISOString().slice(0, 7))?.cnt || 0;
const cap = c.frequency_cap || 4;
const atCap = monthCount >= cap;
```

**Step 3:** Update Preview Content summary to include count pill:
```html
▶ Preview content &nbsp;<span class="font-normal text-[11px] text-mpMuted">${monthCount}/${cap} this month</span>
```

**Step 4:** Update preview content body to show richer campaign detail:
```html
${c.expires_at ? `<p class="text-[11px] text-mpMuted mb-1">Expires: ${safe(c.expires_at)}</p>` : ""}
${c.product_hashtag ? `<p class="text-[11px] text-mpMuted mb-1">Hashtag: ${safe(c.product_hashtag)}</p>` : ""}
${brandHashtagsStr ? `<p class="text-[11px] text-mpMuted mb-1">Brand tags: ${safe(brandHashtagsStr)}</p>` : ""}
```
Where brandHashtagsStr = brand hashtags joined, pulled from brandCfg.

**Step 5:** Add action buttons at the bottom of the preview content accordion:
```html
<div class="flex gap-2 mt-3 pt-3 border-t border-mpBorder">
  <form method="POST" action="/manager/vendors/add-to-queue" class="flex-1">
    <input type="hidden" name="campaign_id" value="${safe(c.id)}" />
    <button type="submit" ${atCap ? 'disabled' : ''}
            class="w-full text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${atCap ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-mpCharcoal text-white hover:bg-mpCharcoalDark'}">
      ${atCap ? "Monthly cap reached" : "Add to Queue"}
    </button>
  </form>
  ${canRenew ? `
  <form method="POST" action="/manager/vendors/reset-campaign" onsubmit="return confirm('Reset this month count for this campaign?')">
    <input type="hidden" name="campaign_id" value="${safe(c.id)}" />
    <button type="submit" class="text-xs font-semibold px-3 py-2 rounded-xl border border-mpBorder text-mpMuted hover:text-mpCharcoal hover:border-mpCharcoal transition-colors">Reset</button>
  </form>` : ""}
</div>
```

**Step 6:** Add POST /add-to-queue route (after /renew-campaign):
```js
router.post("/add-to-queue", requireAuth, async (req, res) => {
  const salon_id = req.manager.salon_id;
  const { campaign_id } = req.body;
  if (!campaign_id) return res.redirect("/manager/vendors");

  const salon = db.prepare("SELECT * FROM salons WHERE slug = ?").get(salon_id);
  const isPro = salon?.plan === "pro" && ["active","trialing"].includes(salon?.plan_status);
  if (!isPro) return res.redirect("/manager/vendors");

  const campaign = db.prepare("SELECT * FROM vendor_campaigns WHERE id = ? AND active = 1").get(campaign_id);
  if (!campaign) return res.redirect("/manager/vendors");

  const feed = db.prepare("SELECT affiliate_url FROM salon_vendor_feeds WHERE salon_id = ? AND vendor_name = ?").get(salon_id, campaign.vendor_name);
  if (!feed) return res.redirect("/manager/vendors");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const { cnt } = db.prepare("SELECT COUNT(*) AS cnt FROM vendor_post_log WHERE salon_id = ? AND campaign_id = ? AND posted_month = ?").get(salon_id, campaign_id, thisMonth);
  if (cnt >= (campaign.frequency_cap || 4)) return res.redirect("/manager/vendors?cap_reached=1");

  const { generateVendorCaption, buildVendorHashtagBlock } = await import("../core/vendorScheduler.js");
  const affiliateUrl = feed.affiliate_url || null;
  const result = await generateVendorCaption({ campaign, salon, affiliateUrl });
  const caption = result?.caption || result;
  if (!caption) return res.redirect("/manager/vendors?error=caption_failed");

  const brandCfg = db.prepare("SELECT brand_hashtags FROM vendor_brands WHERE vendor_name = ?").get(campaign.vendor_name);
  const brandHashtags = (() => { try { return JSON.parse(brandCfg?.brand_hashtags || "[]"); } catch { return []; } })();
  const salonTags = (() => { try { return JSON.parse(salon.default_hashtags || "[]"); } catch { return []; } })();
  const lockedBlock = buildVendorHashtagBlock({ salonHashtags: salonTags, brandHashtags, productHashtag: campaign.product_hashtag || null });
  const finalCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "");

  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { maxnum } = db.prepare("SELECT MAX(salon_post_number) AS maxnum FROM posts WHERE salon_id = ?").get(salon_id) || {};
  db.prepare(`INSERT INTO posts (id, salon_id, stylist_name, image_url, base_caption, final_caption, post_type, status, vendor_campaign_id, salon_post_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'standard_post', 'manager_approved', ?, ?, ?, ?)`)
    .run(postId, salon_id, campaign.vendor_name + " (Campaign)", campaign.photo_url || null, caption, finalCaption, campaign_id, (maxnum || 0) + 1, now, now);

  db.prepare("INSERT INTO vendor_post_log (id, salon_id, campaign_id, post_id, posted_month, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), salon_id, campaign_id, postId, thisMonth, now);

  const { enqueuePost } = await import("../scheduler.js");
  const postRow = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId);
  if (postRow) enqueuePost(postRow);

  res.redirect("/manager/vendors?queued=1");
});
```

**Step 7:** Add POST /reset-campaign route:
```js
router.post("/reset-campaign", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const { campaign_id } = req.body;
  if (!campaign_id) return res.redirect("/manager/vendors");
  const campaign = db.prepare("SELECT vendor_name FROM vendor_campaigns WHERE id = ?").get(campaign_id);
  if (!campaign) return res.redirect("/manager/vendors");
  const feed = db.prepare("SELECT 1 FROM salon_vendor_feeds WHERE salon_id = ? AND vendor_name = ?").get(salon_id, campaign.vendor_name);
  if (!feed) return res.redirect("/manager/vendors");
  const brand = db.prepare("SELECT allow_client_renewal FROM vendor_brands WHERE vendor_name = ?").get(campaign.vendor_name);
  if (!brand?.allow_client_renewal) return res.redirect("/manager/vendors");
  const thisMonth = new Date().toISOString().slice(0, 7);
  db.prepare("DELETE FROM vendor_post_log WHERE salon_id = ? AND campaign_id = ? AND posted_month = ?").run(salon_id, campaign_id, thisMonth);
  res.redirect("/manager/vendors?reset=1");
});
```

**Step 8:** Add flash banners for queued/cap_reached/reset/error in the GET flash section.

**Commit:** `feat: vendor cards — post count pill, Add to Queue, Reset button`

---

## Task 10: Platform Console — brand-first hierarchy

**Files:**
- Modify: src/routes/vendorAdmin.js

**Step 1:** In GET /, add brands overview table above the existing campaign cards. Query:
```js
const allBrands = db.prepare("SELECT vendor_name, COUNT(*) as campaign_count, SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as active_count FROM vendor_campaigns GROUP BY vendor_name ORDER BY vendor_name").all();
```

Render as a clean table with columns: Brand | Active Campaigns | [Manage Campaigns →] linking to `/internal/vendors/brands/${encodeURIComponent(b.vendor_name)}${qs(req)}`.

**Step 2:** Add GET /brands/:name route:
```js
router.get("/brands/:name", requireSecret, requirePin, (req, res) => {
  const vendorName = decodeURIComponent(req.params.name);
  const campaigns = db.prepare("SELECT * FROM vendor_campaigns WHERE vendor_name = ? ORDER BY active DESC, created_at DESC").all(vendorName);
  const brand = db.prepare("SELECT * FROM vendor_brands WHERE vendor_name = ?").get(vendorName);
  // Render: brand header + back link + brand config card + campaign table with edit links + Add Campaign form with vendor_name as hidden field
});
```

**Step 3:** On the /brands/:name page, the Add Campaign form uses a hidden vendor_name field instead of a dropdown. No fat-finger possible.

**Step 4:** Update the campaign edit page (GET /campaign/:id/edit) to show vendor_name as a read-only text field, not a dropdown.

**Step 5:** Add a simple nav bar at the top of the main console page:
```html
<nav class="flex gap-4 text-xs font-semibold mb-6 border-b border-gray-200 pb-3">
  <a href="/internal/vendors${qs(req)}" class="text-gray-900">Brands & Campaigns</a>
  <a href="/internal/vendors${qs(req)}#salon-plans" class="text-gray-500">Salon Plans</a>
  <a href="/internal/vendors${qs(req)}#support" class="text-gray-500">Support</a>
  <a href="/internal/vendors${qs(req)}#approvals" class="text-gray-500">Approvals</a>
</nav>
```

**Commit:** `feat: platform console — brand-first hierarchy with /brands/:name drill-down`

---

## Task 11: Fix vendor category checkboxes — pull from all campaigns

**Files:**
- Modify: src/routes/vendorFeeds.js

**Context:** Category checkboxes currently derive from active campaigns only (items array filtered to active=1). If a brand has 3 categories but only 1 has an active campaign, only 1 checkbox shows.

**Fix:** In the vendor card render loop, replace the current brandCategories derivation:
```js
// OLD (only active campaigns):
const brandCategories = [...new Set(items.map(c => c.category).filter(Boolean))].sort();

// NEW (all campaigns for this brand, active or not):
const brandCategories = db.prepare(
  "SELECT DISTINCT category FROM vendor_campaigns WHERE vendor_name = ? AND category IS NOT NULL ORDER BY category"
).all(vendorName).map(r => r.category);
```

**Commit:** `fix: vendor category checkboxes use all campaigns not just active ones`

---

## Task 12: Push all and smoke test

```bash
git push origin main && git push origin main:dev
```

Smoke test checklist:
- /t/nonexistent returns 404
- /t/{slug}/book redirects to booking URL
- utm_clicks row created after Add to Queue
- Analytics Link Performance card shows
- Admin avg_ticket_value saves and loads
- Vendor card count pill shows correctly
- Add to Queue creates post in queue
- Reset clears count
- Platform Console /internal/vendors/brands/Aveda shows Aveda campaigns
- Category checkboxes show all brand categories

---

## Task 13: Update CLAUDE.md

Update the CLAUDE.md in-repo with:
- utm_clicks table in DB Schema section
- avg_ticket_value on salons, product_value on vendor_brands
- /t/ route in Key Source Files table
- src/core/utm.js and src/core/trackingUrl.js in Core Logic table
- POST /manager/vendors/add-to-queue and /reset-campaign in Routes table

Commit: `docs: update CLAUDE.md for UTM + vendor queue + console restructure`
