# Phase 1: Vendor Sync - Research

**Researched:** 2026-03-19
**Domain:** Puppeteer portal automation, PDF text+link extraction, nightly cron in Node.js, vendor_campaigns dedup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Puppeteer handles: portal login, PDF search, PDF download (NOT Playwright — REQUIREMENTS.md says Playwright but CONTEXT.md locked decision is Puppeteer; CONTEXT.md wins)
- PDF parser handles: page extraction (text + embedded URLs)
- Node fetch / Puppeteer handles: image asset download
- Reuse existing `puppeteerRenderer.js` singleton — same shared browser pool, no second Chrome launch
- URL: https://avedapurepro.com/ResourceLibrary
- Flow: login form → filter "Most Relevant" → search keyword → open card → click Download → PDF saved locally
- Credentials: stored as env vars AVEDA_PORTAL_USER + AVEDA_PORTAL_PASS (never in DB)
- PDF page 1 = cover/skip; page 2+ = one campaign per page with release date, campaign name, clickable link → asset page → image, caption with [SALON NAME] placeholder, hashtags block
- Store captions verbatim with [SALON NAME] in vendor_campaigns; replace at publish time in vendorScheduler.js
- Captions come verbatim from PDF — AI generation NOT used during import
- Hashtags from PDF stored in vendor_campaigns.product_hashtag
- PDF URL → navigate to URL → find Download button → save file under public/uploads/vendor/aveda/
- Dedup on: vendor_name + campaign_name + release date — idempotent, skip insert if exists
- Multi-vendor factory: each vendor = one config object + env vars — zero new code for Wella etc.
- Platform Console: new section per vendor brand — last sync date, campaigns imported, [Sync Now] button
- Sync Now → POST /internal/vendors/sync/:vendorName → kicks off async pipeline

### Claude's Discretion
- Exact PDF parsing library (after research — recommendation below: pdfjs-dist)
- Field extraction heuristics (how to detect campaign name vs caption vs hashtags boundaries)
- Retry logic for portal login failures
- Error reporting to Console (last_sync_error column)
- Nightly cron timing

### Deferred Ideas (OUT OF SCOPE)
- Manual PDF upload by operator — not needed; pipeline is fully automated
- AI caption generation from product descriptions — captions come from PDF verbatim
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VSYNC-01 | System authenticates to Aveda brand portal using stored credentials via Puppeteer automation | Puppeteer CDP session + `getBrowser()` from puppeteerRenderer.js singleton; AVEDA_PORTAL_USER + AVEDA_PORTAL_PASS env vars |
| VSYNC-02 | System scrapes/downloads social-tagged asset PDF from past 30 days on Aveda portal | Puppeteer: search keyword template (e.g. "March 2026 Salon Social Assets") + filter "Most Relevant" + card click + Download button click |
| VSYNC-03 | System deduplicates scraped assets against existing vendor_campaigns (by campaign name + release date) | SQL: `SELECT 1 FROM vendor_campaigns WHERE vendor_name=? AND campaign_name=? AND release_date=?`; skip insert on hit |
| VSYNC-04 | System downloads new vendor images to public/uploads/vendor/aveda/ | Direct fetch() if URL is direct file; Puppeteer page-click strategy if asset page requires interaction; UPLOADS_DIR pattern from uploadPath.js |
| VSYNC-05 | (REQUIREMENTS.md: GPT product name normalization) — OVERRIDDEN by CONTEXT.md: product names come verbatim from PDF, no AI | pdfjs-dist getTextContent() per page; heuristic field extraction from page text layout |
| VSYNC-06 | (REQUIREMENTS.md: fetch product descriptions from aveda.com) — OVERRIDDEN by CONTEXT.md: descriptions come verbatim from PDF, no web fetch | pdfjs-dist getTextContent() per page |
| VSYNC-07 | (REQUIREMENTS.md: GPT caption generation) — OVERRIDDEN by CONTEXT.md: captions verbatim from PDF | pdfjs-dist getTextContent() per page |
| VSYNC-08 | System stores completed campaigns in vendor_campaigns with all required fields | Existing schema + new `release_date` column needed; idempotent INSERT OR IGNORE pattern |
| VSYNC-09 | Platform Console shows "Sync Now" button per vendor and displays last_synced_at timestamp | New columns on vendor_brands: last_sync_at, last_sync_count, last_sync_error; new POST route in vendorAdmin.js |
| VSYNC-10 | Nightly scheduled sync runs automatically via scheduler.js cron | Slot into runSchedulerOnce() using same 6am guard pattern as celebrationScheduler.js; in-memory "ran today" guard |
| VSYNC-11 | Factory pattern: adding new vendor = config block + three env vars, no new code | vendorConfigs.js exports array of vendor config objects; vendorSync.js loops over them |
</phase_requirements>

---

## Important Discrepancy: Requirements vs Context

REQUIREMENTS.md (VSYNC-01) says "Playwright". CONTEXT.md locked decision says "Puppeteer". **Puppeteer is the correct tool** — it is already installed (v24.39.1), the singleton exists in puppeteerRenderer.js, and adding Playwright would conflict with the "no new packages without justification" constraint. The planner MUST use Puppeteer throughout.

REQUIREMENTS.md (VSYNC-05, VSYNC-06, VSYNC-07) describe AI caption/description generation. CONTEXT.md explicitly locks captions as verbatim from PDF, no AI at import time. The planner MUST implement verbatim extraction, not AI generation.

---

## Summary

This phase implements a fully automated pipeline that logs into the Aveda brand portal with Puppeteer, downloads the monthly social assets PDF, parses each campaign page with pdfjs-dist (text + hyperlinks), downloads campaign images, and inserts vendor_campaigns rows ready for the existing vendorScheduler.js. The Platform Console gets a Sync Now button and last-sync status, and scheduler.js gets a nightly trigger wired in the same pattern as celebrationScheduler.js.

The critical technical insight is that **pdfjs-dist is the only viable PDF library** for this use case because it is the only Node.js library that supports both text extraction AND hyperlink annotation extraction via `page.getAnnotations()`. pdf-parse cannot extract annotations. The PDF contains image download URLs as embedded hyperlinks — text extraction alone may or may not recover these URLs depending on whether they are also rendered as visible text.

For Puppeteer file download, the **CDP Browser.setDownloadBehavior approach** is the correct pattern, using `page.createCDPSession()` (not the deprecated `page.target().createCDPSession()`), setting download path to a temp dir, and detecting completion via `Browser.downloadProgress` event with `state === 'completed'`. This integrates cleanly with the existing `--single-process --no-zygote` flags already in puppeteerRenderer.js.

**Primary recommendation:** Use pdfjs-dist (v5.5.207) for PDF parsing with `getTextContent()` + `getAnnotations()` per page; use Puppeteer CDP download via page.createCDPSession() for the PDF download; wire nightly cron into runSchedulerOnce() with an in-memory "ran today" guard; add `release_date` column to vendor_campaigns; add `last_sync_at`, `last_sync_count`, `last_sync_error` columns to vendor_brands.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | 24.39.1 (installed) | Portal login, PDF download, image page interaction | Already installed, singleton exists, Render-compatible |
| pdfjs-dist | 5.5.207 (npm registry) | PDF text + hyperlink annotation extraction | Only Node.js library supporting both; official Mozilla PDF.js |
| node-fetch | 3.3.2 (installed) | Direct image download when URL is a file link | Already installed; ESM-compatible |
| better-sqlite3 | 12.4.1 (installed) | DB reads/writes for campaign dedup + insert | Existing synchronous DB layer — no await |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs/promises (built-in) | Node built-in | Write PDF and image files to disk | File I/O for downloaded assets |
| path (built-in) | Node built-in | Construct upload paths | Building UPLOADS_DIR subdirectory paths |
| crypto (built-in) | Node built-in | randomUUID() for campaign IDs | Existing pattern in vendorScheduler.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfjs-dist | pdf-parse | pdf-parse is simpler BUT cannot extract hyperlink annotations — disqualified |
| pdfjs-dist | pdf2json | pdf2json gives JSON representation but annotation/link extraction is unreliable for modern PDFs |
| Puppeteer download via CDP | fetch() for PDF | Puppeteer required anyway for portal auth; CDP download is the only way to trigger an authenticated browser download |

**Installation:**
```bash
npm install pdfjs-dist
```

pdfjs-dist is the only new package. All other dependencies are already present.

**Version verification (2026-03-19):**
- pdfjs-dist: 5.5.207 (confirmed via `npm view pdfjs-dist version`)
- puppeteer: 24.39.1 (confirmed from node_modules)
- node-fetch: 3.3.2 (confirmed from package.json)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── core/vendorSync.js        # new — main pipeline: login, download PDF, parse, download images, DB insert
├── core/vendorConfigs.js     # new — factory config objects per vendor (Aveda + future brands)
├── routes/vendorAdmin.js     # existing — add POST /internal/vendors/sync/:vendorName route + status UI
├── scheduler.js              # existing — add nightly vendorSync call inside runSchedulerOnce()
migrations/
└── 045_vendor_sync_meta.js   # new — adds release_date to vendor_campaigns; last_sync_at/count/error to vendor_brands
public/uploads/vendor/
└── aveda/                    # new directory — campaign images land here
```

### Pattern 1: Puppeteer Portal Login + PDF Download via CDP

**What:** Open a new page on the shared browser, navigate to Aveda portal, fill login form, perform search, click Download button to trigger file download captured via CDP `Browser.setDownloadBehavior`.

**When to use:** Any portal that requires interactive browser session for authentication + file download.

**Example:**
```javascript
// Source: puppeteer docs + https://scrapingant.com/blog/puppeteer-download-file
import { getBrowser } from './puppeteerRenderer.js'; // reuse existing singleton
import os from 'os';
import path from 'path';

async function downloadPortalPdf(config, credentials) {
  const downloadDir = path.join(os.tmpdir(), 'vendor-pdf-' + Date.now());
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await getBrowser(); // MUST use existing singleton
  const page = await browser.newPage();
  try {
    // CDP session for download control — page.createCDPSession() in Puppeteer 24
    const cdpSession = await page.createCDPSession();
    await cdpSession.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    // Listen for download completion
    const downloadComplete = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('PDF download timeout')), 120000);
      cdpSession.on('Browser.downloadProgress', (event) => {
        if (event.state === 'completed') {
          clearTimeout(timeout);
          resolve(event.guid);
        } else if (event.state === 'canceled') {
          clearTimeout(timeout);
          reject(new Error('Download canceled'));
        }
      });
    });

    await page.goto(config.portalUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    // ... login, search, click download ...
    await downloadComplete;

    const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.pdf'));
    return path.join(downloadDir, files[0]);
  } finally {
    await page.close();
    // clean up temp dir after parsing
  }
}
```

**Critical note on `--single-process`:** The existing puppeteerRenderer.js already uses `--single-process --no-zygote`. This is Render Starter-compatible. Do not launch a second browser. `getBrowser()` is the only entry point.

**Critical note on `page.createCDPSession()` vs `page.target().createCDPSession()`:** In Puppeteer 24, both exist but `page.createCDPSession()` is the current preferred API. `page.target().createCDPSession()` is the older form. Use `page.createCDPSession()`.

### Pattern 2: pdfjs-dist Page-by-Page Extraction

**What:** Load PDF buffer into pdfjs-dist, iterate pages 2+, extract text via `getTextContent()` and hyperlinks via `getAnnotations()`.

**When to use:** Any PDF where fields are text content AND image URLs are embedded hyperlinks (not plain text).

**Example:**
```javascript
// Source: https://lirantal.com/blog/how-to-read-and-parse-pdfs-pdfjs-create-pdfs-pdf-lib-nodejs
// Source: DeepWiki pdfjs-dist annotations docs
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Worker required for Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
  __dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);

async function parseCampaignPdf(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl: path.join(
      __dirname, '../../node_modules/pdfjs-dist/standard_fonts/'
    ),
  }).promise;

  const campaigns = [];

  // Skip page 1 (cover). Page numbers are 1-indexed.
  for (let pageNum = 2; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);

    // Text extraction
    const textContent = await page.getTextContent();
    const lines = textContent.items.map(item => item.str);

    // Hyperlink extraction — THIS is why pdfjs-dist is required
    const annotations = await page.getAnnotations();
    const links = annotations
      .filter(a => a.subtype === 'Link' && a.url)
      .map(a => a.url);

    // Heuristic field extraction from lines + links
    campaigns.push(extractCampaignFromPage(lines, links, pageNum));
  }

  return campaigns;
}
```

**Key finding on annotation extraction (HIGH confidence):** pdfjs-dist `page.getAnnotations()` returns annotation objects with `subtype === 'Link'` and `url` property for hyperlinks. This is the only reliable way to extract embedded PDF hyperlinks in Node.js. pdf-parse does not support this.

**Fallback:** If the image URLs are also rendered as visible text on the PDF page, `getTextContent()` lines may contain them — check both sources. URLs in text are recognizable via regex `/(https?:\/\/[^\s]+)/`.

### Pattern 3: Field Extraction Heuristics

**What:** Given a flat array of text items from pdfjs-dist, reconstruct the structured fields (release date, campaign name, caption, hashtags).

**When to use:** PDF pages with predictable layout — fields in known vertical positions.

**Recommended approach:**
- **Release date:** Match regex `/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/` in the first ~5 text items of the page.
- **Campaign name:** Typically a short all-caps or title-case line in the top portion of the page, before body text begins.
- **Caption body:** The multi-line paragraph containing `[SALON NAME]` — detect by presence of that placeholder string, or by being the longest text block.
- **Hashtags:** Lines that start with `#` or a hashtag-dense block near the bottom of the page.
- **Image URL:** From `annotations` with `subtype === 'Link'`; may need to filter to exclude non-image links (check for aveda domain + image-like path).

### Pattern 4: Nightly Cron in scheduler.js

**What:** Wire the vendor sync into `runSchedulerOnce()` using the same in-memory daily guard pattern as `celebrationScheduler.js`.

**When to use:** Any daily job that should fire once per day at a specific hour without a separate cron dependency.

**Example:**
```javascript
// In runSchedulerOnce() in scheduler.js — same pattern as runCelebrationCheck()
import { runVendorSync } from './core/vendorSync.js';

// In-memory guard — resets on restart (acceptable — sync is idempotent)
const vendorSyncRanToday = new Map(); // key: "YYYY-MM-DD"

export async function runSchedulerOnce() {
  // Existing calls...
  runCelebrationCheck().catch(err => ...);

  // Nightly vendor sync — fire at 2am UTC (off-peak, before US business hours)
  const todayKey = new Date().toISOString().slice(0, 10);
  const utcHour = new Date().getUTCHours();
  if (utcHour === 2 && !vendorSyncRanToday.has(todayKey)) {
    vendorSyncRanToday.set(todayKey, true);
    runVendorSync().catch(err => console.error('[Scheduler] VendorSync error:', err.message));
  }

  // ... rest of scheduler
}
```

**Alternative: discrete hour window.** Since the scheduler runs every 60 seconds, a single hour window means up to 60 executions per hour — the in-memory guard prevents re-runs within the same calendar day.

### Pattern 5: Sync Lock (Prevent Concurrent Runs)

**What:** In-memory flag prevents overlapping Puppeteer sessions against the same portal credentials.

**When to use:** Any Puppeteer automation that uses shared credentials (two simultaneous sessions would cause login conflicts or portal rate-limiting).

```javascript
// In vendorSync.js
const syncInProgress = new Map(); // key: vendorName, value: true

export async function runVendorSync(vendorName = null) {
  const configs = vendorName
    ? [VENDOR_CONFIGS.find(c => c.vendorName === vendorName)]
    : VENDOR_CONFIGS;

  for (const config of configs) {
    if (syncInProgress.get(config.vendorName)) {
      console.warn(`[VendorSync] ${config.vendorName} sync already in progress — skipping`);
      continue;
    }
    syncInProgress.set(config.vendorName, true);
    try {
      await syncVendor(config);
    } finally {
      syncInProgress.delete(config.vendorName);
    }
  }
}
```

### Anti-Patterns to Avoid
- **Launching a second Puppeteer browser:** `puppeteer.launch()` anywhere except `puppeteerRenderer.js` violates the singleton constraint and will OOM on Render Starter (512MB). Always use `getBrowser()`.
- **Awaiting better-sqlite3 calls:** DB is synchronous. `await db.prepare(...).run(...)` is a bug — remove `await`.
- **Storing credentials in DB:** AVEDA_PORTAL_USER and AVEDA_PORTAL_PASS are env vars only, never written to any table.
- **Using pdf-parse for this phase:** It cannot extract hyperlink annotations. Do not use it.
- **Calling `page.target().createCDPSession()`:** In Puppeteer 24, prefer `page.createCDPSession()` directly on the page object.
- **Using `networkidle0` in page navigation during sync:** Already flagged in puppeteerRenderer.js — use `domcontentloaded` or `networkidle2` with explicit timeout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF hyperlink extraction | Custom PDF binary parser | pdfjs-dist `getAnnotations()` | PDF annotation spec is complex; pdfjs-dist is the reference implementation |
| PDF text extraction | Character-by-character stream parsing | pdfjs-dist `getTextContent()` | Font encoding, ligatures, CID fonts — impossible to handle manually |
| Portal session management | Custom HTTP cookie jar with login form | Puppeteer page navigation | Portal may have CSRF tokens, JS-driven auth flows, CAPTCHAs |
| Download completion detection | File system polling loop | CDP `Browser.downloadProgress` event | Race conditions in polling; event-driven is reliable |
| Image URL normalization | Custom URL parser | Node built-in `new URL()` | Already used in affiliate URL validation in vendorScheduler.js |

**Key insight:** PDF parsing is deceptively complex. Even "simple" PDFs involve font encoding, glyph mapping, content streams, and annotation dictionaries. pdfjs-dist encapsulates years of Mozilla's PDF.js engine — do not try to replicate any of this.

---

## Common Pitfalls

### Pitfall 1: pdfjs-dist Worker Setup in Node.js
**What goes wrong:** `Error: No "GlobalWorkerOptions.workerSrc" specified` or module resolution failure.
**Why it happens:** pdfjs-dist requires a separate worker file. The `pdfjs-dist/build/pdf.mjs` top-level export may not work without explicit worker config in Node.js. The legacy build path is required for server-side use.
**How to avoid:** Import from `pdfjs-dist/legacy/build/pdf.mjs` and set `GlobalWorkerOptions.workerSrc` to the absolute path of `pdfjs-dist/legacy/build/pdf.worker.mjs`. Use `import.meta.url` to resolve the absolute path.
**Warning signs:** Module throws on import or PDF document load hangs indefinitely.

### Pitfall 2: `--single-process` + CDP Download Behavior
**What goes wrong:** CDP download events may not fire when Chrome is in `--single-process` mode because the download manager runs in a subprocess that doesn't exist.
**Why it happens:** The `--single-process` flag merges renderer and browser process. Some CDP features assume process separation.
**How to avoid:** Test the CDP download approach first. If `Browser.downloadProgress` events never fire, fall back to: set download path via CDP, click Download, then poll the temp directory for a new `.pdf` file with a 2-minute timeout (500ms polling interval). The file-system polling fallback is less elegant but reliable on constrained environments.
**Warning signs:** `downloadComplete` promise never resolves; no file appears in download dir.

### Pitfall 3: Image URLs in PDF Require Auth
**What goes wrong:** Direct `fetch(url)` for the campaign image returns 401 or redirects to login.
**Why it happens:** Aveda's asset portal may require session cookies to download images; a plain Node.js fetch without browser cookies will fail.
**How to avoid:** The `imageDownloadStrategy` config field ('direct' | 'page-click') handles this. Start with 'direct' fetch. If the response is not a 2xx image MIME type, fall back to 'page-click' — navigate to the URL in a Puppeteer page (sharing the same session cookies from login), find the Download button, trigger via CDP.
**Warning signs:** `fetch()` response status 401, 302 redirect to login URL, or Content-Type is `text/html` instead of `image/*`.

### Pitfall 4: Caption Field Boundary Detection in PDF
**What goes wrong:** The text extracted from a PDF page is a flat array of strings; line structure from the original layout is partially lost.
**Why it happens:** pdfjs-dist `getTextContent()` returns items with position data (`item.transform` for x/y) but `item.str` is just the string. Items from different visual lines may appear in arbitrary order.
**How to avoid:** Sort text items by Y position (descending — PDFs have Y=0 at bottom) to reconstruct reading order. Group items within a Y-threshold into "lines". Then apply field detection on ordered lines. Key anchors: `[SALON NAME]` placeholder is a reliable caption marker; hashtag lines always start with `#`; dates match date regex.
**Warning signs:** Campaign name and caption text appear merged; hashtags appear in wrong position.

### Pitfall 5: Duplicate vendor_campaigns on Re-Run
**What goes wrong:** Running sync twice imports the same campaign twice.
**Why it happens:** If dedup logic doesn't execute before insert, or if field values differ slightly between runs (e.g., trailing whitespace in campaign name).
**How to avoid:** Normalize dedup keys: `campaign_name.trim().toLowerCase()` + `release_date` (normalized to ISO format). Use `INSERT OR IGNORE` with a UNIQUE constraint on `(vendor_name, campaign_name, release_date)` as the DB-level guard. Log skipped count.
**Warning signs:** vendor_campaigns count doubles after each nightly run.

### Pitfall 6: [SALON NAME] Replacement Location
**What goes wrong:** The replacement gets applied to the base_caption before vendorScheduler.js processes it, resulting in literal salon names in the DB rather than the template.
**Why it happens:** Confusion about where the replacement happens — at import time vs publish time.
**How to avoid:** vendorSync.js stores captions VERBATIM with `[SALON NAME]` in `vendor_campaigns.product_description` (or a new `caption_template` column if needed). In `vendorScheduler.js` `processCampaign()`, before building the final caption, do `campaign.caption_body = (campaign.caption_body || '').replace(/\[SALON NAME\]/gi, salon.name)`. This is after the DB read, before AI caption generation (which in this phase is bypassed — caption comes directly from the DB column).

**IMPORTANT:** The current vendorScheduler.js calls `generateVendorCaption()` which uses OpenAI. For PDF-sourced campaigns, the caption_body from the PDF IS the caption — `generateVendorCaption()` should be skipped. Add a field on vendor_campaigns to distinguish PDF-sourced campaigns (e.g., `source TEXT DEFAULT 'manual'`, value `'pdf_sync'` for automated imports). Then in `processCampaign()`, only call `generateVendorCaption()` when `campaign.source !== 'pdf_sync'`.

---

## Code Examples

### pdfjs-dist Node.js ESM Setup (verified pattern)
```javascript
// Source: https://lirantal.com/blog/how-to-read-and-parse-pdfs-pdfjs-create-pdfs-pdf-lib-nodejs
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
  __dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);

async function parsePdf(pdfFilePath) {
  const data = new Uint8Array(fs.readFileSync(pdfFilePath));
  const doc = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl: path.join(
      __dirname, '../../node_modules/pdfjs-dist/standard_fonts/'
    ),
  }).promise;

  const pages = [];
  for (let i = 2; i <= doc.numPages; i++) { // skip page 1 (cover)
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations();
    pages.push({ pageNum: i, textContent, annotations });
  }
  return pages;
}
```

### Hyperlink Extraction from PDF Annotations (HIGH confidence)
```javascript
// Source: DeepWiki pdfjs-dist annotations docs
// annotations from page.getAnnotations()
const links = annotations
  .filter(a => a.subtype === 'Link' && a.url)
  .map(a => a.url);
// a.url is the full href for URI actions
// a.dest may be used for internal PDF links — filter those out
```

### Puppeteer CDP Download (MEDIUM confidence — may need file-polling fallback on --single-process)
```javascript
// Source: ScrapingAnt puppeteer download guide + WebShare 5 methods article
// page.createCDPSession() preferred in Puppeteer 24 (page.target().createCDPSession() is older)
const cdpSession = await page.createCDPSession();
await cdpSession.send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: absoluteDownloadDir, // MUST be absolute
  eventsEnabled: true,
});

// Wait for completion
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('PDF download timed out')), 120000);
  cdpSession.on('Browser.downloadProgress', (ev) => {
    if (ev.state === 'completed') { clearTimeout(t); resolve(); }
    if (ev.state === 'canceled') { clearTimeout(t); reject(new Error('Download canceled')); }
  });
  // Trigger the download button click before this promise returns
});
```

**File-system polling fallback (if CDP events don't fire under --single-process):**
```javascript
// poll for new .pdf in downloadDir
async function waitForPdfFile(dir, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf') && !f.endsWith('.crdownload'));
    if (files.length > 0) return path.join(dir, files[0]);
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('PDF download timeout');
}
```

### Dedup Insert Pattern
```javascript
// Source: existing migration pattern (INSERT OR IGNORE) in this codebase
// Requires UNIQUE(vendor_name, campaign_name, release_date) constraint — add in migration 045
db.prepare(`
  INSERT OR IGNORE INTO vendor_campaigns
  (id, vendor_name, campaign_name, release_date, caption_body, product_hashtag,
   photo_url, expires_at, frequency_cap, active, source, created_at)
  VALUES
  (@id, @vendor_name, @campaign_name, @release_date, @caption_body, @product_hashtag,
   @photo_url, @expires_at, @frequency_cap, 1, 'pdf_sync', @created_at)
`).run(campaignData);
// Better-sqlite3 is synchronous — no await
```

### vendor_brands Sync Status Update
```javascript
// Source: existing DB update pattern in this codebase
// Run after successful sync (no await — synchronous)
db.prepare(`
  UPDATE vendor_brands
  SET last_sync_at = ?, last_sync_count = ?, last_sync_error = NULL
  WHERE vendor_name = ?
`).run(new Date().toISOString(), importedCount, vendorName);

// On error:
db.prepare(`
  UPDATE vendor_brands SET last_sync_error = ? WHERE vendor_name = ?
`).run(err.message.slice(0, 500), vendorName);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.target().createCDPSession()` | `page.createCDPSession()` | Puppeteer ~v19+ | Use the direct page method; both still work in v24 |
| pdfjs-dist `build/pdf.js` (CommonJS) | `legacy/build/pdf.mjs` (ESM) | pdfjs-dist v3+ | ESM projects must import from legacy build for Node.js |
| pdf-parse for all PDF use cases | pdfjs-dist when hyperlinks needed | Ongoing | pdf-parse has no annotation support — wrong library for this use case |

**Deprecated/outdated:**
- `Page.setDownloadBehavior` CDP command: Replaced by `Browser.setDownloadBehavior` in newer Chrome — use the Browser-scoped version when available.
- `networkidle0` in page navigation: Too slow/unreliable on Render; already flagged in puppeteerRenderer.js — use `domcontentloaded` or `networkidle2`.

---

## DB Schema Changes Needed

### New Migration: 045_vendor_sync_meta.js

```javascript
// Idempotent additions
// 1. vendor_campaigns: add release_date, caption_body, source columns
// 2. vendor_campaigns: add UNIQUE(vendor_name, campaign_name, release_date) for dedup
// 3. vendor_brands: add last_sync_at, last_sync_count, last_sync_error columns
```

**Why `release_date` is needed:** Dedup key. The existing schema has no date field tied to the campaign asset release cycle. Without it, re-running sync on the same month's PDF would require matching on campaign_name alone, which is fragile if names have minor variations.

**Why `caption_body` is needed:** The existing `product_description` column is for product description, not the caption. The PDF provides a ready-to-post caption. This needs its own column so `processCampaign()` in vendorScheduler.js can read it without ambiguity. Alternatively, store it in `product_description` and document that convention — but a dedicated column is cleaner.

**Why `source` is needed:** vendorScheduler.js currently always calls `generateVendorCaption()` (OpenAI). For PDF-sourced campaigns, we bypass AI. `source = 'pdf_sync'` is the gate. Without this, every nightly run would call OpenAI for imported campaigns — incorrect behavior and unnecessary cost.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 |
| Config file | not yet present — Wave 0 task |
| Quick run command | `npx vitest run --reporter=verbose src/core/vendorSync.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VSYNC-03 | Dedup: same campaign+vendor+date returns false on second call | unit | `npx vitest run src/core/vendorSync.test.js -t "dedup"` | ❌ Wave 0 |
| VSYNC-08 | DB insert populates all required vendor_campaigns fields | unit | `npx vitest run src/core/vendorSync.test.js -t "insert"` | ❌ Wave 0 |
| VSYNC-09 | POST /internal/vendors/sync/:vendorName updates last_sync_at | integration | `npx vitest run src/routes/vendorAdmin.test.js -t "sync"` | ❌ Wave 0 |
| VSYNC-10 | Nightly guard prevents double-run within same day | unit | `npx vitest run src/core/vendorSync.test.js -t "nightly guard"` | ❌ Wave 0 |
| VSYNC-11 | Factory: second vendor config processed without code changes | unit | `npx vitest run src/core/vendorConfigs.test.js` | ❌ Wave 0 |

**Manual-only tests (cannot automate without real portal access):**
- VSYNC-01: Puppeteer portal login — requires live AVEDA_PORTAL_USER + AVEDA_PORTAL_PASS credentials and network access to avedapurepro.com
- VSYNC-02: PDF search + download — requires live portal session
- VSYNC-04: Image download — requires real PDF with real image URLs
- VSYNC-05/06/07: PDF field extraction — unit-testable if a sample PDF can be committed to test fixtures

### Sampling Rate
- Per task commit: `npx vitest run src/core/vendorSync.test.js`
- Per wave merge: `npx vitest run`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/core/vendorSync.test.js` — dedup logic, DB insert, nightly guard — covers VSYNC-03, VSYNC-08, VSYNC-10
- [ ] `src/core/vendorConfigs.test.js` — factory config structure validation — covers VSYNC-11
- [ ] `src/routes/vendorAdmin.test.js` — sync route response + last_sync_at update — covers VSYNC-09
- [ ] `vitest.config.js` or `vitest.config.mjs` — vitest is in package.json (v3.2.4) but config not found in project root
- [ ] `tests/fixtures/sample-campaign.pdf` — sample PDF for extraction unit tests (if obtainable)

---

## Open Questions

1. **Aveda portal URL and login type not yet confirmed**
   - What we know: URL is https://avedapurepro.com/ResourceLibrary (from CONTEXT.md); login type unconfirmed from Tasha
   - What's unclear: Is the login an HTML form, OAuth SSO, or captcha-protected? Are CSS selectors for the Download button known?
   - Recommendation: Build vendorConfigs.js with placeholder selectors; make all selectors configurable in the config object so they can be updated without touching vendorSync.js logic. Test login interactively first with a headed Puppeteer session (`headless: false`) before wiring into the singleton.

2. **PDF structure — are image URLs visible text or annotation-only?**
   - What we know: CONTEXT.md says "Clickable link → asset page → Download button → image file"; this implies hyperlinks embedded as annotations.
   - What's unclear: Are the URLs also rendered as visible text on the PDF page (making text extraction sufficient), or are they annotation-only (requiring `getAnnotations()`)?
   - Recommendation: Use BOTH. Extract all links from `getAnnotations()` as primary source; also scan text items for URLs via regex as fallback. On first run with a real PDF, log both and compare.

3. **CDP download events under --single-process**
   - What we know: The existing puppeteerRenderer.js uses `--single-process --no-zygote` for RAM constraints on Render Starter. CDP `Browser.downloadProgress` events may not fire in this mode.
   - What's unclear: Whether the download CDP events work in single-process Chrome on Linux (Render).
   - Recommendation: Implement both strategies. Try CDP events first; if the promise doesn't resolve within 10s, log a warning and switch to file-system polling of the download directory.

4. **Asset page vs direct image URL**
   - What we know: CONTEXT.md says "PDF URL → navigate to URL → find Download button → save file"; imageDownloadStrategy: 'direct' | 'page-click'.
   - What's unclear: Whether the URL in the PDF is a direct image URL (returns image/jpeg directly) or an asset page URL (HTML page with a Download button).
   - Recommendation: Try `fetch(url, { method: 'HEAD' })` to check `Content-Type`. If `image/*`, use direct fetch. If `text/html`, use Puppeteer page-click. Wire this as the 'auto' strategy in the factory config.

---

## Sources

### Primary (HIGH confidence)
- pdfjs-dist npm registry — version 5.5.207 confirmed
- DeepWiki pdfjs-dist annotations docs (deepwiki.com/mozilla/pdfjs-dist/5.4-annotations-and-forms) — `getAnnotations()` API, LINK subtype, `url` property
- ScrapingAnt puppeteer download guide — CDP `Page.setDownloadBehavior` pattern
- pkgpulse.com PDF library comparison (2026) — confirmed pdf-parse lacks annotation support; pdfjs-dist is the correct choice
- lirantal.com pdfjs-dist Node.js guide — ESM import from `legacy/build/pdf.mjs`, worker setup, `getTextContent()` pattern
- Codebase: puppeteerRenderer.js, vendorScheduler.js, vendorAdmin.js, uploadPath.js, celebrationScheduler.js — all read directly

### Secondary (MEDIUM confidence)
- WebShare "Downloading Files in Puppeteer: 5 Methods Explained" — CDP download pattern with `page.createCDPSession()`
- Browserless.io Puppeteer download guide — CDP Network interception as alternative
- Strapi.io "7 PDF Parsing Libraries for Extracting Data in Node.js" — ecosystem overview confirming pdfjs-dist position

### Tertiary (LOW confidence)
- Single-process CDP download behavior: No authoritative source confirming or denying that `Browser.downloadProgress` events fire under `--single-process`. Needs empirical testing on Render.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pdfjs-dist confirmed via npm registry + docs; puppeteer already installed; all other deps existing
- Architecture: HIGH — existing codebase patterns (celebrationScheduler.js, vendorScheduler.js) directly inform the design
- Pitfalls: MEDIUM — PDF text layout behavior and CDP download under --single-process are empirically unknown for this specific environment; other pitfalls are HIGH

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — pdfjs-dist has active releases; recheck version before install)
