# Vendor Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Extend the vendor system with brand-level config, manual campaign management in the Platform Console, client-side affiliate URL + category filtering, a hashtag tier system, and campaign renewal at both console and client levels.

**Architecture:** Builds on existing `vendor_campaigns`, `salon_vendor_feeds`, `salon_vendor_approvals`, `vendor_post_log`, and `vendorScheduler.js`. Adds a `vendor_brands` table as brand-level config. All hashtag injection happens at post-generation time in `vendorScheduler.js` — locked tags appended after AI caption, never passed to AI.

**Tech Stack:** SQLite (better-sqlite3 synchronous), Express.js, server-rendered HTML with Tailwind CDN. No new npm packages.

---

## Context: Key Patterns

- `db` imported as **default** in routes: `import db from "../../db.js"`
- `db` imported as **named** in vendorScheduler.js: `import { db } from "../../db.js"`
- All DB calls are **synchronous** — never `await` on DB calls
- `req.manager` set by `restoreManagerSession` global middleware (server.js L340). Has: `id`, `name`, `manager_phone`, `salon_id`, `role`. `req.manager.salon_id` accounts for location switching — never trust `req.body.salon_id`
- Routes at `/manager/vendors` → `src/routes/vendorFeeds.js`
- Routes at `/internal/vendors` → `src/routes/vendorAdmin.js`
- Internal routes use `requireSecret` + `requirePin` middleware (already at top of vendorAdmin.js)
- Migrations: use `PRAGMA table_info` checks for idempotency; use `db.prepare(...).run()` for DDL
- JS DOM toggles: use `el.textContent` (not innerHTML) + `el.style.display` (not Tailwind hidden class)

---

## Task 1: Migration 040 — DB Schema

**Files:**
- Create: `migrations/040_vendor_brands.js`
- Modify: `migrations/index.js`

**Step 1: Create `migrations/040_vendor_brands.js`**

```js
// migrations/040_vendor_brands.js
export function run(db) {
  // vendor_brands — one row per brand, source of truth for brand-level config
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vendor_brands (
      vendor_name          TEXT PRIMARY KEY,
      brand_hashtags       TEXT DEFAULT '[]',
      categories           TEXT DEFAULT '[]',
      allow_client_renewal INTEGER DEFAULT 1,
      created_at           TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Back-fill one row per distinct vendor_name already in vendor_campaigns
  const existing = db.prepare(`SELECT DISTINCT vendor_name FROM vendor_campaigns`).all();
  const upsert = db.prepare(`INSERT OR IGNORE INTO vendor_brands (vendor_name) VALUES (?)`);
  for (const { vendor_name } of existing) {
    upsert.run(vendor_name);
  }

  // Add category + product_hashtag to vendor_campaigns (idempotent)
  const campaignCols = db.prepare(`PRAGMA table_info(vendor_campaigns)`).all().map(c => c.name);
  if (!campaignCols.includes("category"))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN category TEXT`).run();
  if (!campaignCols.includes("product_hashtag"))
    db.prepare(`ALTER TABLE vendor_campaigns ADD COLUMN product_hashtag TEXT`).run();

  // Add affiliate_url + category_filters to salon_vendor_feeds (idempotent)
  const feedCols = db.prepare(`PRAGMA table_info(salon_vendor_feeds)`).all().map(c => c.name);
  if (!feedCols.includes("affiliate_url"))
    db.prepare(`ALTER TABLE salon_vendor_feeds ADD COLUMN affiliate_url TEXT`).run();
  if (!feedCols.includes("category_filters"))
    db.prepare(`ALTER TABLE salon_vendor_feeds ADD COLUMN category_filters TEXT DEFAULT '[]'`).run();

  console.log("[Migration 040] vendor_brands created, vendor_campaigns + salon_vendor_feeds updated");
}
```

**Step 2: Register in `migrations/index.js`**

Add at the end of the import block:
```js
import { run as run040 } from "./040_vendor_brands.js";
```

Add to the migrations array (after the last entry):
```js
{ version: 40, run: run040 },
```

**Step 3: Verify**

Start `npm run dev`. Check console for `[Migration 040]`. Then in a Node shell:

```js
import db from "./db.js";
console.log(db.prepare("PRAGMA table_info(vendor_brands)").all().map(c => c.name));
// Expected: ['vendor_name', 'brand_hashtags', 'categories', 'allow_client_renewal', 'created_at']
console.log(db.prepare("PRAGMA table_info(salon_vendor_feeds)").all().map(c => c.name));
// Expected: includes 'affiliate_url' and 'category_filters'
```

**Step 4: Commit**

```bash
git add migrations/040_vendor_brands.js migrations/index.js
git commit -m "feat(vendor): migration 040 — vendor_brands + column additions"
```

---

## Task 2: Console — Brand Config + Manual Add + Status + Renew

**Files:**
- Modify: `src/routes/vendorAdmin.js`

Adds to the Platform Console (`/internal/vendors`):
1. Brand Config card per vendor (hashtags, categories, allow_client_renewal)
2. Manual "+ Add Campaign" inline form per vendor
3. Active/Expired status badges + "Renew +30d" button on campaigns
4. Three new POST routes: `/brand-config`, `/campaign/add`, `/campaign/renew`

**Step 1: Update `GET /` to fetch brand configs**

In the `GET /` route (around line 177), after the `campaigns` query, add:

```js
// Vendor brand config
const brandConfigs = db.prepare(`SELECT * FROM vendor_brands`).all();
const brandConfigMap = Object.fromEntries(brandConfigs.map(b => [b.vendor_name, b]));

// Union of vendor names from campaigns + brand configs (some brands may have config but no campaigns yet)
const allVendorNames = [...new Set([
  ...campaigns.map(c => c.vendor_name),
  ...brandConfigs.map(b => b.vendor_name),
])].sort();
```

Replace the existing `vendors` grouping:
```js
// Remove:
//   const vendors = {};
//   for (const c of campaigns) {
//     if (!vendors[c.vendor_name]) vendors[c.vendor_name] = [];
//     vendors[c.vendor_name].push(c);
//   }
// Replace with:
const vendors = {};
for (const name of allVendorNames) vendors[name] = [];
for (const c of campaigns) vendors[c.vendor_name].push(c);
```

**Step 2: Add flash banner variable (before the `const html = ...` line)**

```js
const flashBanner = req.query.saved
  ? `<div class="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium mb-6">Brand config saved.</div>`
  : req.query.added
  ? `<div class="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium mb-6">Campaign added.</div>`
  : req.query.renewed
  ? `<div class="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 font-medium mb-6">Campaign renewed +30 days.</div>`
  : req.query.error === "missing_fields"
  ? `<div class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium mb-6">Vendor name, campaign name, category, and product name are required.</div>`
  : req.query.error === "promotion_needs_expiry"
  ? `<div class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium mb-6">Promotion campaigns require an expiration date.</div>`
  : "";
```

In the HTML template, insert `${flashBanner}` right after the opening `<div class="max-w-5xl mx-auto px-8 py-8 space-y-8">` and before the stats grid div.

**Step 3: Replace `vendorBlocks` with updated template**

Replace the entire `vendorBlocks` definition. The key additions are the Brand Config card, Add Campaign form, status badges, and Renew button:

```js
const today = new Date().toISOString().slice(0, 10);

const vendorBlocks = Object.entries(vendors).map(([vendor, items]) => {
  const cfg = brandConfigMap[vendor] || {};
  const brandHashtags = (() => { try { return JSON.parse(cfg.brand_hashtags || "[]"); } catch { return []; } })();
  const categories = (() => { try { return JSON.parse(cfg.categories || "[]"); } catch { return []; } })();
  const allowRenewal = cfg.allow_client_renewal !== 0;
  const vendorKey = safe(vendor.replace(/\s+/g, "_"));

  const catOptions = categories.length
    ? categories.map(cat => `<option value="${safe(cat)}">${safe(cat)}</option>`).join("")
    : `<option value="Standard">Standard</option><option value="Promotion">Promotion</option>`;

  const campaignRows = items.map(c => {
    const isExpired = c.expires_at && c.expires_at < today;
    const statusBadge = isExpired
      ? `<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>`
      : `<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>`;
    const renewBtn = isExpired ? `
      <form method="POST" action="/internal/vendors/campaign/renew${qs(req)}" class="inline">
        <input type="hidden" name="campaign_id" value="${safe(c.id)}" />
        <button type="submit" class="text-xs text-blue-500 hover:text-blue-700 font-medium">Renew +30d</button>
      </form>` : "";
    return `
      <div class="border rounded-xl p-4 bg-white flex gap-4 items-start">
        ${c.photo_url
          ? `<img src="${safe(c.photo_url)}" class="w-14 h-14 object-cover rounded-lg border flex-shrink-0" onerror="this.style.display='none'" />`
          : `<div class="w-14 h-14 rounded-lg border bg-gray-50 flex-shrink-0 flex items-center justify-center text-xl">&#127991;</div>`}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-semibold text-sm">${safe(c.campaign_name)}</p>
              <p class="text-xs text-gray-500">${safe(c.product_name || "")}${c.category ? ` &middot; ${safe(c.category)}` : ""}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              ${statusBadge}
              ${renewBtn}
              <form method="POST" action="/internal/vendors/delete/${safe(c.id)}${qs(req)}"
                    onsubmit="return confirm('Delete campaign: ${safe(c.campaign_name)}?')" class="inline">
                <button type="submit" class="text-xs text-red-400 hover:text-red-600">Delete</button>
              </form>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1 line-clamp-2">${safe(c.product_description || "")}</p>
          <div class="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-400">
            <span>Expires: <strong class="text-gray-600">${safe(c.expires_at || "&#8212;")}</strong></span>
            <span>Cap: <strong class="text-gray-600">${safe(c.frequency_cap || 4)}/mo</strong></span>
            ${c.category ? `<span>Category: <strong class="text-gray-600">${safe(c.category)}</strong></span>` : ""}
            ${c.product_hashtag ? `<span>Tag: <strong class="text-gray-600">${safe(c.product_hashtag)}</strong></span>` : ""}
          </div>
          ${c.cta_instructions ? `<p class="text-xs text-blue-500 mt-1">CTA: ${safe(c.cta_instructions)}</p>` : ""}
        </div>
      </div>`;
  }).join("");

  return `
  <div class="mb-8">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-gray-900">${safe(vendor)}
        <span class="ml-2 text-xs font-normal text-gray-400">${items.length} campaign${items.length !== 1 ? "s" : ""}</span>
      </h3>
    </div>

    <!-- Brand Config Card -->
    <div class="border rounded-xl bg-white p-4 mb-4">
      <p class="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Brand Config</p>
      <form method="POST" action="/internal/vendors/brand-config${qs(req)}" class="space-y-3">
        <input type="hidden" name="vendor_name" value="${safe(vendor)}" />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Brand Hashtag 1</label>
            <input type="text" name="brand_hashtags[]" value="${safe(brandHashtags[0] || "")}"
                   placeholder="#BrandTag" maxlength="60"
                   class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Brand Hashtag 2</label>
            <input type="text" name="brand_hashtags[]" value="${safe(brandHashtags[1] || "")}"
                   placeholder="#BrandTag" maxlength="60"
                   class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Campaign Categories (comma-separated)</label>
          <input type="text" name="categories" value="${safe(categories.join(", "))}"
                 placeholder="Color, Standard, Promotion"
                 class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          ${categories.length
            ? `<div class="mt-1.5 flex flex-wrap gap-1">${categories.map(c => `<span class="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">${safe(c)}</span>`).join("")}</div>`
            : ""}
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-600 font-medium">Allow client-side renewal</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="allow_client_renewal" value="1" ${allowRenewal ? "checked" : ""}
                   class="sr-only peer" />
            <div class="w-9 h-5 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors"></div>
            <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
          </label>
        </div>
        <div class="flex justify-end">
          <button type="submit"
                  class="text-xs bg-gray-900 text-white rounded-lg px-4 py-1.5 font-semibold hover:bg-gray-700">
            Save Brand Config
          </button>
        </div>
      </form>
    </div>

    <!-- Campaign Rows -->
    <div class="space-y-2">
      ${campaignRows || `<p class="text-xs text-gray-400 py-2">No campaigns yet.</p>`}

      <!-- Add Campaign Toggle + Inline Form -->
      <button type="button"
              onclick="var f=document.getElementById('add-form-${vendorKey}'); f.style.display=f.style.display==='none'?'block':'none';"
              class="mt-2 text-xs border border-dashed border-gray-300 rounded-xl px-4 py-2.5 text-gray-500 hover:border-gray-500 hover:text-gray-700 w-full text-center">
        + Add Campaign
      </button>
      <div id="add-form-${vendorKey}" style="display:none;" class="mt-3 border rounded-xl bg-gray-50 p-4">
        <p class="text-xs font-bold text-gray-700 mb-3">New Campaign &mdash; ${safe(vendor)}</p>
        <form method="POST" action="/internal/vendors/campaign/add${qs(req)}" class="space-y-3">
          <input type="hidden" name="vendor_name" value="${safe(vendor)}" />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Campaign Name *</label>
              <input type="text" name="campaign_name" required placeholder="Spring Color 2026"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Category *</label>
              <select name="category" required class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="">-- Select --</option>
                ${catOptions}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Product Name *</label>
              <input type="text" name="product_name" required placeholder="Full Spectrum Color"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Product Hashtag (max 1)</label>
              <input type="text" name="product_hashtag" placeholder="#FullSpectrum" maxlength="60"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div class="col-span-2">
              <label class="text-xs text-gray-500 block mb-1">Product Description</label>
              <textarea name="product_description" rows="2" placeholder="1-2 sentence description"
                        class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"></textarea>
            </div>
            <div class="col-span-2">
              <label class="text-xs text-gray-500 block mb-1">Photo URL</label>
              <input type="text" name="photo_url" placeholder="https://..."
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Tone Direction</label>
              <input type="text" name="tone_direction" placeholder="professional and educational"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">CTA Instructions</label>
              <input type="text" name="cta_instructions" placeholder="Ask about our color menu"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Service Pairing Notes</label>
              <input type="text" name="service_pairing_notes" placeholder="Pairs with balayage"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Expires At (required for Promotion)</label>
              <input type="date" name="expires_at"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Frequency Cap (posts/month)</label>
              <input type="number" name="frequency_cap" value="4" min="1" max="30"
                     class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button"
                    onclick="document.getElementById('add-form-${vendorKey}').style.display='none';"
                    class="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
            <button type="submit"
                    class="text-xs bg-gray-900 text-white rounded-lg px-4 py-1.5 font-semibold">
              Add Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}).join("");
```

**Step 4: Add `POST /brand-config` route (before `export default router`)**

```js
// ── POST /brand-config ────────────────────────────────────────────────────────
router.post("/brand-config", requireSecret, requirePin, (req, res) => {
  const { vendor_name, categories } = req.body;
  if (!vendor_name) return res.redirect(`/internal/vendors${qs(req)}`);

  const rawTags = Array.isArray(req.body["brand_hashtags[]"])
    ? req.body["brand_hashtags[]"]
    : [req.body["brand_hashtags[]"] || ""];
  const brandHashtags = rawTags
    .map(t => (t || "").trim())
    .filter(Boolean)
    .map(t => t.startsWith("#") ? t : `#${t}`)
    .slice(0, 2);

  const cats = (categories || "").split(",").map(c => c.trim()).filter(Boolean);
  const dedupedCats = [...new Set(cats)];
  const allowRenewal = req.body.allow_client_renewal === "1" ? 1 : 0;

  db.prepare(`
    INSERT INTO vendor_brands (vendor_name, brand_hashtags, categories, allow_client_renewal)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(vendor_name) DO UPDATE SET
      brand_hashtags       = excluded.brand_hashtags,
      categories           = excluded.categories,
      allow_client_renewal = excluded.allow_client_renewal
  `).run(vendor_name, JSON.stringify(brandHashtags), JSON.stringify(dedupedCats), allowRenewal);

  res.redirect(`/internal/vendors${qs(req)}&saved=1`);
});
```

**Step 5: Add `POST /campaign/add` route**

```js
// ── POST /campaign/add ────────────────────────────────────────────────────────
router.post("/campaign/add", requireSecret, requirePin, (req, res) => {
  const {
    vendor_name, campaign_name, category, product_name,
    product_description, photo_url, tone_direction,
    cta_instructions, service_pairing_notes, expires_at,
  } = req.body;
  const frequency_cap = parseInt(req.body.frequency_cap, 10) || 4;

  if (!vendor_name || !campaign_name || !category || !product_name) {
    return res.redirect(`/internal/vendors${qs(req)}&error=missing_fields`);
  }
  if (category === "Promotion" && !expires_at) {
    return res.redirect(`/internal/vendors${qs(req)}&error=promotion_needs_expiry`);
  }

  const rawTag = (req.body.product_hashtag || "").trim();
  const product_hashtag = rawTag ? (rawTag.startsWith("#") ? rawTag : `#${rawTag}`) : null;

  db.prepare(`INSERT OR IGNORE INTO vendor_brands (vendor_name) VALUES (?)`).run(vendor_name);

  db.prepare(`
    INSERT INTO vendor_campaigns
      (id, vendor_name, campaign_name, category, product_name, product_description,
       photo_url, product_hashtag, tone_direction, cta_instructions,
       service_pairing_notes, expires_at, frequency_cap, active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(
    crypto.randomUUID(), vendor_name, campaign_name, category, product_name,
    product_description || null, photo_url || null, product_hashtag,
    tone_direction || null, cta_instructions || null,
    service_pairing_notes || null, expires_at || null, frequency_cap,
  );

  res.redirect(`/internal/vendors${qs(req)}&added=1`);
});
```

**Step 6: Add `POST /campaign/renew` route**

```js
// ── POST /campaign/renew ──────────────────────────────────────────────────────
router.post("/campaign/renew", requireSecret, requirePin, (req, res) => {
  const { campaign_id } = req.body;
  if (!campaign_id) return res.redirect(`/internal/vendors${qs(req)}`);

  const campaign = db.prepare(`SELECT id, expires_at FROM vendor_campaigns WHERE id = ?`).get(campaign_id);
  if (!campaign) return res.redirect(`/internal/vendors${qs(req)}`);

  const newExpiry = campaign.expires_at
    ? db.prepare(`SELECT date(?, '+30 days') AS d`).get(campaign.expires_at).d
    : db.prepare(`SELECT date('now', '+30 days') AS d`).get().d;

  db.prepare(`UPDATE vendor_campaigns SET expires_at = ? WHERE id = ?`).run(newExpiry, campaign_id);

  const thisMonth = new Date().toISOString().slice(0, 7);
  db.prepare(`DELETE FROM vendor_post_log WHERE campaign_id = ? AND posted_month = ?`).run(campaign_id, thisMonth);

  res.redirect(`/internal/vendors${qs(req)}&renewed=1`);
});
```

**Step 7: Manual verification**

Open `http://localhost:3000/internal/vendors?secret=<INTERNAL_SECRET>`. Verify:
- Each vendor section has a Brand Config card with 2 hashtag inputs, categories input + chip chips, and a toggle
- Saving brand config shows green flash banner; values persist on reload
- "+ Add Campaign" button shows/hides the inline form (uses `style.display`)
- Submitting the add form creates a campaign and redirects with `?added=1` banner
- Expired campaigns show red "Expired" badge and "Renew +30d" button
- Active campaigns show green "Active" badge
- Renew updates expires_at +30 days and shows `?renewed=1` banner

**Step 8: Commit**

```bash
git add src/routes/vendorAdmin.js
git commit -m "feat(vendor): console brand config + manual campaign add + active/expired + renew"
```

---

## Task 3: Client — Vendor Settings + Renew Button

**Files:**
- Modify: `src/routes/vendorFeeds.js`

Adds to `/manager/vendors`:
1. Settings sub-section (collapsed) on each approved vendor card — affiliate URL + category checkboxes
2. Expired campaign rows with Renew button (gated by `allow_client_renewal`)
3. Routes: `POST /settings` and `POST /renew-campaign`

**Step 1: Update `GET /` to fetch brand configs and vendor settings**

After the existing `feeds` and `approvals` queries, add:

```js
const brandConfigs = db.prepare(`SELECT * FROM vendor_brands`).all();
const brandConfigMap = Object.fromEntries(brandConfigs.map(b => [b.vendor_name, b]));

const vendorSettings = db.prepare(`
  SELECT vendor_name, affiliate_url, category_filters FROM salon_vendor_feeds WHERE salon_id = ?
`).all(salon_id);
const vendorSettingsMap = Object.fromEntries(vendorSettings.map(s => [s.vendor_name, s]));
```

**Step 2: Add flash banners for settings_saved and renewed**

At the top of the `body` template string (replacing any existing `requested` flash logic), add:

```js
const flashBanners = [
  req.query.settings_saved
    ? `<div class="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium mb-4">Vendor settings saved.</div>`
    : "",
  req.query.renewed
    ? `<div class="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 font-medium mb-4">"${safe(decodeURIComponent(req.query.renewed || ""))}" renewed &#8212; campaign is active again.</div>`
    : "",
  req.query.requested
    ? `<div class="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium mb-4">Access requested. We&#8217;ll review shortly.</div>`
    : "",
].join("");
```

Add `${flashBanners}` at the top of the body template (before the section/header element).

**Step 3: Add vendor-level variables inside the `vendors.map(...)` callback**

At the start of the callback for each `[vendorName, items]`, add:

```js
const brandCfg = brandConfigMap[vendorName] || {};
const vendorSetting = vendorSettingsMap[vendorName] || {};
const brandCategories = (() => { try { return JSON.parse(brandCfg.categories || "[]"); } catch { return []; } })();
const activeFilters = (() => { try { return JSON.parse(vendorSetting.category_filters || "[]"); } catch { return []; } })();
const canRenew = brandCfg.allow_client_renewal !== 0;
const vKey = safe(vendorName.replace(/\s+/g, "_"));
```

**Step 4: Add expired campaigns block and Settings section to the card HTML**

Inside the card template, after the existing `campaignPreviews` + `moreCount` block (and before the final closing `</div>` of the outer card), insert:

```js
// Expired campaigns (approved only)
${isApproved && expired.length > 0 ? `
<div class="border-t border-mpBorder px-5 py-4">
  <p class="text-[11px] text-mpMuted font-semibold uppercase tracking-wide mb-2">Expired Campaigns</p>
  <div class="space-y-2">
    ${expired.map(c => `
      <div class="rounded-xl border border-mpBorder bg-mpBg p-3 flex gap-3 items-start opacity-60">
        ${c.photo_url
          ? `<img src="${safe(c.photo_url)}" class="w-14 h-14 object-cover rounded-lg border border-mpBorder flex-shrink-0" style="filter:grayscale(1)" onerror="this.style.display='none'" />`
          : `<div class="w-14 h-14 rounded-lg border border-mpBorder bg-white flex items-center justify-center text-mpMuted text-xl flex-shrink-0">&#127991;</div>`}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-semibold text-mpCharcoal">${safe(c.campaign_name)}</p>
              <p class="text-[11px] text-mpMuted">Expired ${safe(c.expires_at)}</p>
            </div>
            ${canRenew ? `
            <form method="POST" action="/manager/vendors/renew-campaign" class="shrink-0">
              <input type="hidden" name="campaign_id" value="${safe(c.id)}" />
              <button type="submit"
                      class="text-[11px] rounded-full bg-mpCharcoal text-white px-3 py-1 font-semibold hover:bg-mpCharcoalDark">
                Renew
              </button>
            </form>` : ""}
          </div>
        </div>
      </div>`).join("")}
  </div>
</div>` : ""}

<!-- Settings section (approved only, collapsed by default) -->
${isApproved ? `
<div class="border-t border-mpBorder px-5 py-4">
  <button type="button"
          onclick="var p=document.getElementById('sp-${vKey}'); var a=document.getElementById('sa-${vKey}'); var open=p.style.display!=='none'; p.style.display=open?'none':'block'; a.textContent=open?'\\u25B6':'\\u25BC';"
          class="text-xs font-semibold text-mpMuted hover:text-mpCharcoal flex items-center gap-1.5 mb-0">
    <span id="sa-${vKey}">&#9658;</span> Settings
  </button>
  <div id="sp-${vKey}" style="display:none;" class="mt-3">
    <form method="POST" action="/manager/vendors/settings" class="space-y-4">
      <input type="hidden" name="vendor_name" value="${safe(vendorName)}" />
      <div>
        <label class="block text-xs font-semibold text-mpCharcoal mb-1">Affiliate URL</label>
        <input type="url" name="affiliate_url"
               value="${safe(vendorSetting.affiliate_url || "")}"
               placeholder="https://aveda.com/ref/your-salon"
               class="w-full border border-mpBorder rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-mpAccent" />
        <p class="text-[11px] text-mpMuted mt-1">
          Your unique partner link &#8212; added to all ${safe(vendorName)} posts automatically.
          Also serves as proof of partnership when requesting access.
        </p>
      </div>
      ${brandCategories.length > 0 ? `
      <div>
        <label class="block text-xs font-semibold text-mpCharcoal mb-2">Product Categories to Sync</label>
        <div class="flex flex-wrap gap-3">
          ${brandCategories.map(cat => `
            <label class="flex items-center gap-2 text-sm text-mpMuted cursor-pointer">
              <input type="checkbox" name="category_filters[]" value="${safe(cat)}"
                     ${activeFilters.includes(cat) ? "checked" : ""}
                     class="rounded border-mpBorder" />
              ${safe(cat)}
            </label>`).join("")}
        </div>
        <p class="text-[11px] text-mpMuted mt-1">Leave all unchecked to sync all categories.</p>
      </div>` : ""}
      <button type="submit"
              class="rounded-xl bg-mpCharcoal text-white px-5 py-2 text-sm font-semibold hover:bg-mpCharcoalDark transition-colors">
        Save Settings
      </button>
    </form>
  </div>
</div>` : ""}
```

Note: The toggle uses `\u25B6` (right triangle) and `\u25BC` (down triangle) via `textContent` — safe and no external DOM libraries needed.

**Step 5: Add `POST /settings` route**

Add before `export default router`:

```js
// ── POST /settings ────────────────────────────────────────────────────────────
router.post("/settings", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const { vendor_name, affiliate_url } = req.body;
  if (!vendor_name) return res.redirect("/manager/vendors");

  const categoryFilters = Array.isArray(req.body["category_filters[]"])
    ? req.body["category_filters[]"]
    : req.body["category_filters[]"]
    ? [req.body["category_filters[]"]]
    : [];

  db.prepare(`
    UPDATE salon_vendor_feeds
    SET affiliate_url = ?, category_filters = ?
    WHERE salon_id = ? AND vendor_name = ?
  `).run(affiliate_url || null, JSON.stringify(categoryFilters), salon_id, vendor_name);

  // If affiliate_url provided: update proof_file on existing pending approval
  // or create a pending approval request if none exists
  if (affiliate_url) {
    const approval = db.prepare(`
      SELECT id, status FROM salon_vendor_approvals
      WHERE salon_id = ? AND vendor_name = ?
    `).get(salon_id, vendor_name);

    if (approval && approval.status === "pending") {
      db.prepare(`UPDATE salon_vendor_approvals SET proof_file = ? WHERE id = ?`)
        .run(affiliate_url, approval.id);
    } else if (!approval) {
      db.prepare(`
        INSERT OR IGNORE INTO salon_vendor_approvals
          (id, salon_id, vendor_name, status, proof_file, requested_at)
        VALUES (?, ?, ?, 'pending', ?, datetime('now'))
      `).run(crypto.randomUUID(), salon_id, vendor_name, affiliate_url);
    }
  }

  res.redirect("/manager/vendors?settings_saved=1");
});
```

**Step 6: Add `POST /renew-campaign` route**

```js
// ── POST /renew-campaign ──────────────────────────────────────────────────────
router.post("/renew-campaign", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const { campaign_id } = req.body;
  if (!campaign_id) return res.redirect("/manager/vendors");

  const campaign = db.prepare(`
    SELECT id, campaign_name, vendor_name, expires_at FROM vendor_campaigns WHERE id = ?
  `).get(campaign_id);
  if (!campaign) return res.redirect("/manager/vendors");

  // IDOR guard: salon must have approved+enabled access to this vendor
  const feed = db.prepare(`
    SELECT f.enabled FROM salon_vendor_feeds f
    JOIN salon_vendor_approvals a ON a.salon_id = f.salon_id AND a.vendor_name = f.vendor_name
    WHERE f.salon_id = ? AND f.vendor_name = ? AND a.status = 'approved' AND f.enabled = 1
  `).get(salon_id, campaign.vendor_name);
  if (!feed) return res.redirect("/manager/vendors");

  // Gate: only if brand allows client renewal
  const brand = db.prepare(`SELECT allow_client_renewal FROM vendor_brands WHERE vendor_name = ?`)
    .get(campaign.vendor_name);
  if (!brand || brand.allow_client_renewal === 0) return res.redirect("/manager/vendors");

  const newExpiry = campaign.expires_at
    ? db.prepare(`SELECT date(?, '+30 days') AS d`).get(campaign.expires_at).d
    : db.prepare(`SELECT date('now', '+30 days') AS d`).get().d;

  db.prepare(`UPDATE vendor_campaigns SET expires_at = ? WHERE id = ?`).run(newExpiry, campaign_id);

  const thisMonth = new Date().toISOString().slice(0, 7);
  db.prepare(`DELETE FROM vendor_post_log WHERE campaign_id = ? AND posted_month = ?`).run(campaign_id, thisMonth);

  res.redirect(`/manager/vendors?renewed=${encodeURIComponent(campaign.campaign_name)}`);
});
```

**Step 7: Manual verification**

On `/manager/vendors` as a Pro salon with an approved+enabled vendor:
- Settings arrow visible below campaign preview toggle
- Clicking Settings arrow expands the panel (arrow changes to down triangle, uses textContent)
- Affiliate URL field and category checkboxes visible
- Saving redirects with green "Vendor settings saved" banner; values persist
- Expired campaigns shown in a grayed section with Renew button (if `allow_client_renewal = 1`)
- Renew redirects with campaign name in flash banner; campaign moves back to active section
- If `allow_client_renewal = 0` (set via console), Renew button absent from expired campaigns

**Step 8: Commit**

```bash
git add src/routes/vendorFeeds.js
git commit -m "feat(vendor): client settings — affiliate URL + category filters + renew"
```

---

## Task 4: vendorScheduler — Hashtag Tiers + Affiliate URL + Category Filters

**Files:**
- Modify: `src/core/vendorScheduler.js`
- Create: `tests/vendorHashtags.test.js`

**Step 1: Write the failing test**

Create `tests/vendorHashtags.test.js`:

```js
// tests/vendorHashtags.test.js
import { describe, it, expect } from "vitest";
import { buildVendorHashtagBlock, normalizeHashtag } from "../src/core/vendorScheduler.js";

describe("normalizeHashtag", () => {
  it("adds # prefix if missing", () => {
    expect(normalizeHashtag("aveda")).toBe("#aveda");
  });
  it("keeps existing # prefix", () => {
    expect(normalizeHashtag("#aveda")).toBe("#aveda");
  });
  it("returns empty string for falsy input", () => {
    expect(normalizeHashtag("")).toBe("");
    expect(normalizeHashtag(null)).toBe("");
  });
});

describe("buildVendorHashtagBlock", () => {
  it("takes first 3 salon tags, 2 brand tags, 1 product tag, appends #MostlyPostly", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair", "#Style", "#Color", "#Extra"],
      brandHashtags: ["#AvedaColor", "#FullSpectrum"],
      productHashtag: "#Botanique",
    });
    expect(result).toBe("#Hair #Style #Color #AvedaColor #FullSpectrum #Botanique #MostlyPostly");
  });
  it("caps brand hashtags at 2", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair"],
      brandHashtags: ["#A", "#B", "#C"],
      productHashtag: null,
    });
    expect(result).toBe("#Hair #A #B #MostlyPostly");
  });
  it("skips product hashtag if null", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair"],
      brandHashtags: [],
      productHashtag: null,
    });
    expect(result).toBe("#Hair #MostlyPostly");
  });
  it("handles empty salon hashtags", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: [],
      brandHashtags: ["#AvedaColor"],
      productHashtag: null,
    });
    expect(result).toBe("#AvedaColor #MostlyPostly");
  });
  it("deduplicates #MostlyPostly when already in salon hashtags", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#MostlyPostly", "#Hair"],
      brandHashtags: [],
      productHashtag: null,
    });
    const count = (result.match(/#MostlyPostly/g) || []).length;
    expect(count).toBe(1);
  });
});
```

**Step 2: Run test to confirm failure**

```bash
npx vitest run tests/vendorHashtags.test.js
```

Expected: FAIL — functions not exported from vendorScheduler.js yet.

**Step 3: Add exported helpers to `vendorScheduler.js`**

After the existing imports and `const log` block, add before `generateVendorCaption`:

```js
// ─── Exported helpers (testable pure functions) ──────────────────────────────

export function normalizeHashtag(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}

/**
 * Build the locked hashtag block for vendor posts.
 * Order: first 3 salon defaults + up to 2 brand hashtags + up to 1 product hashtag + #MostlyPostly
 * Deduplicates case-insensitively. Append AFTER AI caption — never pass to AI.
 */
export function buildVendorHashtagBlock({ salonHashtags, brandHashtags, productHashtag }) {
  const BRAND_TAG = "#MostlyPostly";
  const seen = new Set();
  const out = [];

  const add = (tag) => {
    const t = normalizeHashtag(tag);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  (salonHashtags || []).slice(0, 3).forEach(add);
  (brandHashtags || []).slice(0, 2).forEach(add);
  if (productHashtag) add(productHashtag);
  add(BRAND_TAG);

  return out.join(" ");
}
```

**Step 4: Run test to confirm pass**

```bash
npx vitest run tests/vendorHashtags.test.js
```

Expected: All 5 tests PASS.

**Step 5: Update `generateVendorCaption` — remove hashtag instructions + add affiliate URL param**

Change function signature from `{ campaign, salon }` to `{ campaign, salon, affiliateUrl }`.

Replace the entire function body:

```js
async function generateVendorCaption({ campaign, salon, affiliateUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.warn("Missing OPENAI_API_KEY — skipping vendor caption generation");
    return null;
  }

  const salonName = salon.name || "the salon";
  const tone      = salon.tone || "friendly and professional";

  const systemPrompt = `You are a social media expert writing Instagram and Facebook posts for a hair salon.
Write a single post caption that:
- Sounds like it comes from ${salonName}, a hair salon
- Matches the salon's tone: "${tone}"
- Promotes the product/service naturally without sounding like an ad
- Is 2-4 sentences max
- Does NOT mention specific prices
- Ends with a subtle CTA if CTA instructions are provided
- Does NOT include any hashtags`;

  const userPrompt = `Write a social media caption for the following vendor product/campaign:

Brand: ${campaign.vendor_name}
Campaign: ${campaign.campaign_name}
Product: ${campaign.product_name || campaign.campaign_name}
Description: ${campaign.product_description || ""}
${campaign.tone_direction ? `Brand tone direction: ${campaign.tone_direction}` : ""}
${campaign.cta_instructions ? `CTA instructions: ${campaign.cta_instructions}` : ""}
${campaign.service_pairing_notes ? `Service pairing notes: ${campaign.service_pairing_notes}` : ""}
${affiliateUrl ? `Include this partner link in the post: ${affiliateUrl}` : ""}

Remember: this is for ${salonName} — write in their voice (${tone}), not the brand's voice.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.75,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      log.warn(`OpenAI error for campaign ${campaign.id}: ${err}`);
      return null;
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    log.warn(`OpenAI fetch failed for campaign ${campaign.id}: ${err.message}`);
    return null;
  }
}
```

**Step 6: Update `processSalon` — fetch affiliate_url + category_filters**

Replace the `enabledVendors` query and its for loop:

```js
const enabledVendors = db.prepare(`
  SELECT f.vendor_name, f.affiliate_url, f.category_filters
  FROM salon_vendor_feeds f
  JOIN salon_vendor_approvals a ON a.salon_id = f.salon_id AND a.vendor_name = f.vendor_name
  WHERE f.salon_id = ?
    AND f.enabled = 1
    AND a.status = 'approved'
`).all(salonId);

if (enabledVendors.length === 0) return 0;

for (const vendor of enabledVendors) {
  const vendorName     = vendor.vendor_name;
  const affiliateUrl   = vendor.affiliate_url || null;
  const categoryFilters = (() => {
    try { return JSON.parse(vendor.category_filters || "[]"); } catch { return []; }
  })();

  let campaignSql = `
    SELECT * FROM vendor_campaigns
    WHERE vendor_name = ?
      AND active = 1
      AND (expires_at IS NULL OR expires_at >= date('now'))
  `;
  const queryParams = [vendorName];
  if (categoryFilters.length > 0) {
    campaignSql += ` AND category IN (${categoryFilters.map(() => "?").join(",")})`;
    queryParams.push(...categoryFilters);
  }
  campaignSql += " ORDER BY created_at ASC";

  const campaigns = db.prepare(campaignSql).all(...queryParams);

  for (const campaign of campaigns) {
    try {
      const didCreate = await processCampaign(campaign, salon, thisMonth, affiliateUrl);
      if (didCreate) created++;
    } catch (err) {
      log.warn(`Error processing campaign ${campaign.id} for salon ${salonId}: ${err.message}`);
    }
  }
}
```

**Step 7: Update `processCampaign` — accept affiliateUrl + build locked hashtag block**

Change signature: `async function processCampaign(campaign, salon, thisMonth, affiliateUrl)`

Update the `generateVendorCaption` call:

```js
const caption = await generateVendorCaption({ campaign, salon, affiliateUrl });
```

After the `if (!caption) { return false; }` guard, before the `salon_post_number` calculation, add:

```js
// Build locked hashtag block — appended AFTER AI caption, never passed to AI
const brandCfg = db.prepare(
  `SELECT brand_hashtags FROM vendor_brands WHERE vendor_name = ?`
).get(campaign.vendor_name);
const brandHashtags = (() => {
  try { return JSON.parse(brandCfg?.brand_hashtags || "[]"); } catch { return []; }
})();
const salonDefaultTags = (() => {
  try { return JSON.parse(salon.default_hashtags || "[]"); } catch { return []; }
})();
const lockedBlock = buildVendorHashtagBlock({
  salonHashtags: salonDefaultTags,
  brandHashtags,
  productHashtag: campaign.product_hashtag || null,
});
const finalCaption = caption + (lockedBlock ? `\n\n${lockedBlock}` : "");
```

Update the INSERT to use `finalCaption`:

```js
db.prepare(`
  INSERT INTO posts (
    id, salon_id, stylist_name, image_url,
    base_caption, final_caption,
    post_type, status,
    vendor_campaign_id,
    salon_post_number, created_at, updated_at
  ) VALUES (
    @id, @salon_id, @stylist_name, @image_url,
    @base_caption, @final_caption,
    @post_type, @status,
    @vendor_campaign_id,
    @salon_post_number, @created_at, @updated_at
  )
`).run({
  id:                 postId,
  salon_id:           salonId,
  stylist_name:       `${campaign.vendor_name} (Campaign)`,
  image_url:          campaign.photo_url || null,
  base_caption:       caption,        // AI text only, no hashtags
  final_caption:      finalCaption,   // AI text + locked hashtag block
  post_type:          "standard_post",
  status,
  vendor_campaign_id: campaign.id,
  salon_post_number,
  created_at:         now,
  updated_at:         now,
});
```

**Step 8: Run tests**

```bash
npx vitest run tests/vendorHashtags.test.js
```

Expected: All 5 tests still PASS.

**Step 9: Smoke test the scheduler**

Set Studio 500 to Pro, approve and enable Aveda, configure brand hashtags in the console, then trigger:

```bash
node --input-type=module <<'EOF'
import { runVendorScheduler } from "./src/core/vendorScheduler.js";
const n = await runVendorScheduler();
console.log("Created:", n);
EOF
```

Check DB:
- `base_caption`: AI text only, no hashtags
- `final_caption`: ends with hashtag block (e.g. `#Hair #AvedaColor #FullSpectrum #MostlyPostly`)
- If affiliate URL set for the salon+vendor, it appears as a URL in the caption text
- If `category_filters = '["Color"]'` and a campaign has `category = "Standard"`, it is skipped

**Step 10: Commit**

```bash
git add src/core/vendorScheduler.js tests/vendorHashtags.test.js
git commit -m "feat(vendor): hashtag tiers + affiliate URL + category filters in scheduler"
```

---

## Task 5: Push + Docs

**Step 1: Push to staging and production**

```bash
git push origin main
git checkout dev && git merge main && git push origin dev && git checkout main
```

**Step 2: Verify on staging**

1. Console: brand config cards, add campaign, active/expired badges, renew
2. Client: settings section on vendor cards, affiliate URL, category checkboxes, renew on expired

**Step 3: Update FEATURES.md**

Find FEAT-031. Change status to `done`. Add shipped inventory in details.

**Step 4: Update CLAUDE.md**

In schema section add `vendor_brands` table. Update `vendor_campaigns` and `salon_vendor_feeds` rows to include new columns. Add to Key Patterns: hashtag tier system for vendor posts.

**Step 5: Commit docs**

```bash
git add /Users/troyhardister/chairlyos/mostlypostly/FEATURES.md \
        /Users/troyhardister/chairlyos/mostlypostly/CLAUDE.md
git commit -m "docs: FEAT-031 vendor enhancements complete — FEATURES.md + CLAUDE.md updated"
git push origin main
git checkout dev && git merge main && git push origin dev && git checkout main
```
