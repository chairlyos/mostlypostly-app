# Celebration Templates + Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3 font-style checkboxes with a 5-template visual selector in Admin → Branding, backed by a shared template registry and a live preview endpoint that generates a test image (no post created) and opens it in a new browser tab.

**Architecture:** A new `src/core/postTemplates.js` exports `TEMPLATES.celebration[key]` — each value is a `buildHtml(opts)` function. `celebrationImageGen.js` delegates to this registry instead of owning its own `buildHtml`. The admin UI replaces font-style checkboxes with 5 template cards; a GET preview route generates and redirects to the image URL. Migration 036 adds `celebration_template TEXT DEFAULT 'script'` to `salons`.

**Tech Stack:** Node.js ESM, better-sqlite3 (synchronous), Puppeteer (via existing `renderHtmlToJpeg`), Express, server-rendered HTML with Tailwind CDN.

---

### Task 1: Migration 036 + template registry scaffold

**Files:**
- Create: `migrations/036_celebration_template.js`
- Modify: `migrations/index.js`
- Create: `src/core/postTemplates.js`
- Modify: `src/core/celebrationImageGen.js`

**Step 1: Create migration 036**

Create `migrations/036_celebration_template.js`:

```js
// migrations/036_celebration_template.js
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(salons)`).all();
  if (cols.some(c => c.name === "celebration_template")) {
    console.log("[036] celebration_template column already exists, skipping");
    return;
  }
  db.prepare(`ALTER TABLE salons ADD COLUMN celebration_template TEXT DEFAULT 'script'`).run();
  console.log("[036] Added celebration_template to salons");
}
```

**Step 2: Register migration in index.js**

In `migrations/index.js`, add after the run035 import:

```js
import { run as run036 } from "./036_celebration_template.js";
```

And add to the migrations array after the run035 entry:

```js
{ name: "036_celebration_template", run: run036 },
```

**Step 3: Create `src/core/postTemplates.js`**

This file owns all 5 template `buildHtml` functions and exports the registry. Create it with the first template (`script`) extracted from the existing `celebrationImageGen.js` logic, plus stubs for the other 4:

```js
// src/core/postTemplates.js
// Shared post image template registry.
// TEMPLATES[postType][key] = buildHtml(opts) → HTML string
// opts shape: { width, height, photoDataUri, logoDataUri, firstName,
//               celebrationType, subLabel, accentHex }

function safe(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function logoHtml(logoDataUri, width, height, pad) {
  if (!logoDataUri) return "";
  return `
  <div style="position:absolute;top:${Math.round(height*0.028)}px;right:${pad}px;
    background:rgba(0,0,0,0.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    border-radius:${Math.round(height*0.012)}px;padding:${Math.round(height*0.012)}px ${Math.round(width*0.022)}px;
    display:flex;align-items:center;justify-content:center;">
    <img src="${logoDataUri}"
      style="max-width:${Math.round(width*0.20)}px;max-height:${Math.round(height*0.055)}px;
      object-fit:contain;display:block;filter:brightness(0) invert(1);" />
  </div>`;
}

function watermarkHtml(height, pad) {
  return `<div style="position:absolute;bottom:${Math.round(height*0.022)}px;left:${pad}px;
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:${Math.round(height*0.014)}px;font-weight:400;
    color:rgba(255,255,255,0.35);letter-spacing:0.5px;">#MostlyPostly</div>`;
}

// ─── Template 1: script — Handwritten Elegance ────────────────────────────

function buildHtml_script({ width, height, photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex }) {
  const pad = Math.round(width * 0.055);
  const nameFontSize   = Math.round(height * 0.165);
  const eyebrowFontSize = Math.round(height * 0.022);
  const subFontSize    = Math.round(height * 0.028);
  const eyebrow = celebrationType === "birthday" ? "Happy Birthday" : "Happy Anniversary";

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:-30px;width:calc(100% + 60px);height:calc(100% + 60px);
      object-fit:cover;object-position:center top;filter:blur(22px) brightness(0.45) saturate(1.1);" src="${photoDataUri}" />
    <img style="position:absolute;top:0;left:0;width:100%;height:68%;
      object-fit:contain;object-position:center top;" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${accentHex}cc 0%,#1a1c22 100%);"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(0,0,0,0.08) 30%,rgba(0,0,0,0.60) 58%,rgba(0,0,0,0.90) 75%,rgba(0,0,0,0.97) 100%);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:${Math.round(height*0.05)}px ${pad}px ${Math.round(height*0.07)}px;">
    <div style="width:${Math.round(width*0.075)}px;height:${Math.round(height*0.004)}px;background:${accentHex};border-radius:2px;margin-bottom:${Math.round(height*0.018)}px;"></div>
    <div style="font-family:'Great Vibes',cursive;font-size:${eyebrowFontSize * 2.2}px;color:rgba(255,255,255,0.85);margin-bottom:${Math.round(height*0.005)}px;line-height:1.1;">${safe(eyebrow)}</div>
    <div style="font-family:'Lato',sans-serif;font-size:${nameFontSize * 0.55}px;font-weight:700;color:#fff;letter-spacing:6px;text-transform:uppercase;line-height:1.05;text-shadow:0 4px 24px rgba(0,0,0,0.5);">${safe(firstName)}</div>
    ${subLabel ? `<div style="font-family:'Lato',sans-serif;font-size:${subFontSize}px;font-weight:300;color:rgba(255,255,255,0.65);margin-top:${Math.round(height*0.014)}px;letter-spacing:2px;">${safe(subLabel)}</div>` : ""}
  </div>
  ${logoHtml(logoDataUri, width, height, pad)}
  ${watermarkHtml(height, pad)}
</body></html>`;
}

// ─── Template 2: editorial — Magazine Split ────────────────────────────────

function buildHtml_editorial({ width, height, photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex }) {
  const pad = Math.round(width * 0.07);
  const splitPct = 0.56;
  const photoH = Math.round(height * splitPct);
  const bandH  = height - photoH;
  const nameFontSize   = Math.round(bandH * 0.38);
  const eyebrowFontSize = Math.round(bandH * 0.10);
  const subFontSize    = Math.round(bandH * 0.115);
  const eyebrow = celebrationType === "birthday" ? "HAPPY BIRTHDAY" : "HAPPY ANNIVERSARY";

  const photoBg = photoDataUri
    ? `<img style="position:absolute;top:0;left:0;width:100%;height:${photoH}px;object-fit:cover;object-position:center top;" src="${photoDataUri}" />`
    : `<div style="position:absolute;top:0;left:0;width:100%;height:${photoH}px;background:linear-gradient(135deg,${accentHex}99 0%,#1a1c22 100%);"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <!-- Accent bar at split edge -->
  <div style="position:absolute;top:${photoH - 3}px;left:0;right:0;height:5px;background:${accentHex};"></div>
  <!-- Color band -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:${bandH}px;background:#1a1c22;
    display:flex;flex-direction:column;justify-content:center;padding:0 ${pad}px;">
    <div style="font-family:'Montserrat',sans-serif;font-size:${eyebrowFontSize}px;font-weight:400;
      color:rgba(255,255,255,0.5);letter-spacing:${Math.round(eyebrowFontSize * 0.5)}px;
      text-transform:uppercase;margin-bottom:${Math.round(bandH * 0.04)}px;">${safe(eyebrow)}</div>
    <div style="font-family:'Montserrat',sans-serif;font-size:${nameFontSize}px;font-weight:800;
      color:#fff;text-transform:uppercase;letter-spacing:2px;line-height:0.9;">${safe(firstName)}</div>
    ${subLabel ? `<div style="font-family:'Montserrat',sans-serif;font-size:${subFontSize}px;font-weight:400;
      color:rgba(255,255,255,0.55);margin-top:${Math.round(bandH*0.06)}px;letter-spacing:3px;text-transform:uppercase;">${safe(subLabel)}</div>` : ""}
  </div>
  ${logoHtml(logoDataUri, width, height, Math.round(width * 0.055))}
  ${watermarkHtml(height, Math.round(width * 0.055))}
</body></html>`;
}

// ─── Template 3: bold — Vertical Statement ────────────────────────────────

function buildHtml_bold({ width, height, photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex }) {
  const pad = Math.round(width * 0.055);
  const panelW = Math.round(width * 0.44);
  const nameFontSize   = Math.round(height * 0.13);
  const eyebrowFontSize = Math.round(panelW * 0.09);
  const typeFontSize   = Math.round(panelW * 0.13);
  const eyebrow = celebrationType === "birthday" ? "HAPPY BIRTHDAY" : "HAPPY ANNIVERSARY";
  const typeWord = celebrationType === "birthday" ? "BIRTHDAY" : "ANNIVERSARY";

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.65);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${accentHex}cc 0%,#1a1c22 100%);"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <!-- Right dark panel -->
  <div style="position:absolute;top:0;right:0;width:${panelW}px;height:100%;
    background:rgba(0,0,0,0.78);
    display:flex;flex-direction:column;justify-content:center;
    padding:${Math.round(height*0.06)}px ${Math.round(panelW*0.12)}px;">
    <div style="width:${Math.round(panelW*0.18)}px;height:3px;background:${accentHex};margin-bottom:${Math.round(height*0.03)}px;"></div>
    <div style="font-family:'Lato',sans-serif;font-size:${eyebrowFontSize}px;font-weight:400;
      color:rgba(255,255,255,0.55);letter-spacing:${Math.round(eyebrowFontSize*0.35)}px;
      text-transform:uppercase;margin-bottom:${Math.round(height*0.02)}px;line-height:1.3;">${safe(eyebrow)}</div>
    <div style="font-family:'Montserrat',sans-serif;font-size:${typeFontSize}px;font-weight:800;
      color:${accentHex};text-transform:uppercase;letter-spacing:2px;">${safe(typeWord)}</div>
    ${subLabel ? `<div style="font-family:'Lato',sans-serif;font-size:${Math.round(panelW*0.08)}px;font-weight:300;
      color:rgba(255,255,255,0.5);margin-top:${Math.round(height*0.04)}px;letter-spacing:2px;">${safe(subLabel)}</div>` : ""}
  </div>
  <!-- Vertical name text — left strip -->
  <div style="position:absolute;left:0;top:0;bottom:0;width:${nameFontSize * 1.25}px;
    display:flex;align-items:center;justify-content:center;">
    <div style="writing-mode:vertical-rl;transform:rotate(180deg);
      font-family:'Montserrat',sans-serif;font-size:${nameFontSize}px;font-weight:800;
      color:rgba(255,255,255,0.92);text-transform:uppercase;letter-spacing:8px;
      text-shadow:0 4px 32px rgba(0,0,0,0.6);">${safe(firstName)}</div>
  </div>
  ${logoHtml(logoDataUri, width, height, pad)}
  ${watermarkHtml(height, pad)}
</body></html>`;
}

// ─── Template 4: luxury — Frosted Card ────────────────────────────────────

function buildHtml_luxury({ width, height, photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex }) {
  const pad = Math.round(width * 0.055);
  const cardW = Math.round(width * 0.74);
  const nameFontSize    = Math.round(height * 0.085);
  const eyebrowFontSize = Math.round(height * 0.019);
  const subFontSize     = Math.round(height * 0.022);
  const eyebrow = celebrationType === "birthday" ? "Happy Birthday" : "Happy Anniversary";

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.45) saturate(0.9);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${accentHex}99 0%,#1a1c22 100%);"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400;1,700&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <!-- Frosted glass card, centered -->
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    width:${cardW}px;
    background:rgba(255,255,255,0.11);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    border:1px solid rgba(255,255,255,0.18);
    border-radius:${Math.round(height*0.025)}px;
    padding:${Math.round(height*0.065)}px ${Math.round(cardW*0.10)}px;
    text-align:center;">
    <div style="font-family:'Lato',sans-serif;font-size:${eyebrowFontSize}px;font-weight:300;
      color:rgba(255,255,255,0.6);letter-spacing:${Math.round(eyebrowFontSize*0.7)}px;
      text-transform:uppercase;margin-bottom:${Math.round(height*0.03)}px;">${safe(eyebrow)}</div>
    <!-- Thin divider -->
    <div style="width:${Math.round(cardW*0.22)}px;height:1px;background:${accentHex};
      margin:0 auto ${Math.round(height*0.04)}px;opacity:0.8;"></div>
    <div style="font-family:'Playfair Display',serif;font-size:${nameFontSize}px;font-style:italic;font-weight:700;
      color:#fff;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,0.4);">${safe(firstName)}</div>
    ${subLabel ? `
    <div style="width:${Math.round(cardW*0.22)}px;height:1px;background:rgba(255,255,255,0.2);
      margin:${Math.round(height*0.04)}px auto ${Math.round(height*0.03)}px;"></div>
    <div style="font-family:'Lato',sans-serif;font-size:${subFontSize}px;font-weight:300;
      color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;">${safe(subLabel)}</div>` : ""}
  </div>
  ${logoHtml(logoDataUri, width, height, pad)}
  ${watermarkHtml(height, pad)}
</body></html>`;
}

// ─── Template 5: minimal — Moody Centered ─────────────────────────────────

function buildHtml_minimal({ width, height, photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex }) {
  const pad = Math.round(width * 0.055);
  const nameFontSize    = Math.round(height * 0.12);
  const eyebrowFontSize = Math.round(height * 0.018);
  const pillFontSize    = Math.round(height * 0.016);
  const eyebrow = celebrationType === "birthday" ? "HAPPY BIRTHDAY" : "HAPPY ANNIVERSARY";

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.3) saturate(0.8);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:#0f1015;"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:#0f1015;}</style>
</head><body>
  ${photoBg}
  <!-- Centered content -->
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;text-align:center;
    padding:${Math.round(height*0.08)}px ${Math.round(width*0.10)}px;">
    <div style="font-family:'Montserrat',sans-serif;font-size:${eyebrowFontSize}px;font-weight:300;
      color:rgba(255,255,255,0.45);letter-spacing:${Math.round(eyebrowFontSize*0.9)}px;
      text-transform:uppercase;margin-bottom:${Math.round(height*0.03)}px;">${safe(eyebrow)}</div>
    <div style="font-family:'Montserrat',sans-serif;font-size:${nameFontSize}px;font-weight:200;
      color:#fff;letter-spacing:4px;line-height:1.05;">${safe(firstName)}</div>
    <!-- Thin line -->
    <div style="width:${Math.round(width*0.12)}px;height:1px;background:${accentHex};
      margin:${Math.round(height*0.035)}px auto;"></div>
    ${subLabel ? `<div style="font-family:'Montserrat',sans-serif;font-size:${Math.round(height*0.020)}px;font-weight:300;
      color:rgba(255,255,255,0.5);letter-spacing:3px;text-transform:uppercase;
      margin-bottom:${Math.round(height*0.03)}px;">${safe(subLabel)}</div>` : ""}
    <!-- Pill -->
    <div style="display:inline-block;background:${accentHex};border-radius:999px;
      padding:${Math.round(height*0.012)}px ${Math.round(width*0.07)}px;
      font-family:'Montserrat',sans-serif;font-size:${pillFontSize}px;font-weight:300;
      color:rgba(255,255,255,0.9);letter-spacing:${Math.round(pillFontSize*0.4)}px;
      text-transform:uppercase;">
      ${safe(celebrationType === "birthday" ? "Celebrating You" : "Thank You")}
    </div>
  </div>
  ${logoHtml(logoDataUri, width, height, pad)}
  ${watermarkHtml(height, pad)}
</body></html>`;
}

// ─── Registry ──────────────────────────────────────────────────────────────

export const TEMPLATE_META = {
  celebration: {
    script:    { label: "Handwritten Elegance", desc: "Script font · Photo-first" },
    editorial: { label: "Magazine Split",       desc: "Bold type · Color band" },
    bold:      { label: "Vertical Statement",   desc: "High-impact · Vertical name" },
    luxury:    { label: "Frosted Card",         desc: "Frosted glass · Serif italic" },
    minimal:   { label: "Moody Centered",       desc: "Minimal · Dark mood" },
  },
};

export const TEMPLATES = {
  celebration: {
    script:    buildHtml_script,
    editorial: buildHtml_editorial,
    bold:      buildHtml_bold,
    luxury:    buildHtml_luxury,
    minimal:   buildHtml_minimal,
  },
};
```

**Step 4: Refactor `celebrationImageGen.js` to use the registry**

Replace the existing `FONT_STYLES` constant and `buildHtml` function in `src/core/celebrationImageGen.js` with an import from the registry. Change the `generateCelebrationImage` signature to accept `template` instead of `fontStyle`.

The new `celebrationImageGen.js` should look like this in full:

```js
// src/core/celebrationImageGen.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";
import { UPLOADS_DIR, toUploadUrl } from "./uploadPath.js";
import { renderHtmlToJpeg } from "./puppeteerRenderer.js";
import { TEMPLATES } from "./postTemplates.js";

const CELEBRATIONS_DIR = path.join(UPLOADS_DIR, "celebrations");
fs.mkdirSync(CELEBRATIONS_DIR, { recursive: true });

const ACCENT_COLOR = "#3B72B9";
const FALLBACK_TEMPLATE = "script";

async function toBase64DataUri(source) {
  try {
    let buf;
    if (source?.startsWith("http")) {
      const resp = await fetch(source, { timeout: 10000 });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      buf = Buffer.from(await resp.arrayBuffer());
    } else if (source && fs.existsSync(source)) {
      buf = fs.readFileSync(source);
    } else {
      throw new Error("no source");
    }
    const mime = buf[0] === 0x89 ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Generate birthday/anniversary images in square (feed) and vertical (story) formats.
 *
 * @param {object} opts
 * @param {string}  opts.profilePhotoUrl
 * @param {string}  [opts.salonLogoPath]
 * @param {string}  opts.firstName
 * @param {"birthday"|"anniversary"} opts.celebrationType
 * @param {number}  [opts.anniversaryYears]
 * @param {string}  [opts.salonName]
 * @param {string}  [opts.accentColor]
 * @param {string}  [opts.template]   — key from TEMPLATES.celebration (default "script")
 * @returns {Promise<{ feedUrl: string, storyUrl: string }>}
 */
export async function generateCelebrationImage({
  profilePhotoUrl,
  salonLogoPath,
  firstName,
  celebrationType,
  anniversaryYears,
  salonName = "",
  accentColor = ACCENT_COLOR,
  template = FALLBACK_TEMPLATE,
}) {
  const buildHtml = TEMPLATES.celebration[template] || TEMPLATES.celebration[FALLBACK_TEMPLATE];
  if (!TEMPLATES.celebration[template]) {
    console.warn(`[CelebrationImage] Unknown template "${template}", falling back to "${FALLBACK_TEMPLATE}"`);
  }

  const subLabel = celebrationType === "anniversary" && anniversaryYears
    ? `${anniversaryYears} Year${anniversaryYears === 1 ? "" : "s"} · ${salonName}`
    : "";

  const [photoDataUri, logoDataUri] = await Promise.all([
    toBase64DataUri(profilePhotoUrl),
    salonLogoPath ? toBase64DataUri(salonLogoPath) : Promise.resolve(null),
  ]);

  const SQUARE_W = 1080, SQUARE_H = 1080;
  const STORY_W  = 1080, STORY_H  = 1920;

  const sharedOpts = { photoDataUri, logoDataUri, firstName, celebrationType, subLabel, accentHex: accentColor };

  const [squareBuf, storyBuf] = await Promise.all([
    renderHtmlToJpeg(buildHtml({ width: SQUARE_W, height: SQUARE_H, ...sharedOpts }), SQUARE_W, SQUARE_H),
    renderHtmlToJpeg(buildHtml({ width: STORY_W,  height: STORY_H,  ...sharedOpts }), STORY_W,  STORY_H),
  ]);

  const feedFile  = `${crypto.randomUUID()}-feed.jpg`;
  const storyFile = `${crypto.randomUUID()}-story.jpg`;
  fs.writeFileSync(path.join(CELEBRATIONS_DIR, feedFile),  squareBuf);
  fs.writeFileSync(path.join(CELEBRATIONS_DIR, storyFile), storyBuf);

  return {
    feedUrl:  toUploadUrl(`celebrations/${feedFile}`),
    storyUrl: toUploadUrl(`celebrations/${storyFile}`),
  };
}
```

**Step 5: Verify server starts**

```bash
node server.js
```

Expected: server starts with no import errors, migration 036 runs and logs `[036] Added celebration_template to salons`.

**Step 6: Commit**

```bash
git add migrations/036_celebration_template.js migrations/index.js \
        src/core/postTemplates.js src/core/celebrationImageGen.js
git commit -m "feat: celebration template registry + 5 templates (migration 036)"
```

---

### Task 2: Update celebrationScheduler.js

**Files:**
- Modify: `src/core/celebrationScheduler.js`

**Step 1: Update the DB query to select `celebration_template`**

In `celebrationScheduler.js`, find the `runCelebrationCheck` function. The salon query at the top currently selects `celebration_font_styles, celebration_font_index`. Replace that section:

Find:
```js
  const salons = db.prepare(`
    SELECT slug, name, timezone, tone,
           brand_palette, celebration_font_styles, celebration_font_index,
           logo_url
    FROM salons
  `).all();
```

Replace with:
```js
  const salons = db.prepare(`
    SELECT slug, name, timezone, tone,
           brand_palette, celebration_template,
           logo_url
    FROM salons
  `).all();
```

**Step 2: Update `generateCelebrationImage` call to use `template`**

Find the block that reads font style and calls `generateCelebrationImage`. Currently:

```js
      const styles = (() => {
        try { return JSON.parse(salon.celebration_font_styles || '["script"]'); }
        catch { return ["script"]; }
      })();
      const fontStyle = styles[(salon.celebration_font_index || 0) % styles.length];
      // ...
          const { feedUrl, storyUrl } = await generateCelebrationImage({
            // ...
            fontStyle,
          });
```

Replace the `styles`/`fontStyle` block and the `fontStyle` param with:

```js
      const template = salon.celebration_template || "script";
      // ...
          const { feedUrl, storyUrl } = await generateCelebrationImage({
            profilePhotoUrl: stylist.photo_url,
            salonLogoPath:   logoPath,
            firstName,
            celebrationType: stylist.celebrationType,
            anniversaryYears: stylist.anniversaryYears,
            salonName: salon.name,
            accentColor,
            template,
          });
```

**Step 3: Remove `fontIndexBump` logic**

Find and remove these lines (the font index cycle is no longer used):

```js
      let fontIndexBump = 0;
      // ...
          fontIndexBump++;
      // ...
      if (fontIndexBump > 0) {
        db.prepare(`UPDATE salons SET celebration_font_index = celebration_font_index + ? WHERE slug = ?`)
          .run(fontIndexBump, salon.slug);
      }
```

**Step 4: Verify server starts cleanly**

```bash
node server.js
```

Expected: no errors, scheduler tick logs normally.

**Step 5: Commit**

```bash
git add src/core/celebrationScheduler.js
git commit -m "feat: scheduler reads celebration_template instead of cycling font styles"
```

---

### Task 3: Admin UI — template selector + preview + save routes

**Files:**
- Modify: `src/routes/admin.js`

This task has four parts: (A) update the GET handler to read `celebration_template`, (B) replace the branding tab HTML, (C) add the preview GET route, (D) add the template save POST route.

**Step A: Update the GET /manager/admin handler**

In the `GET /` handler for admin (around line 211), find:

```js
  const celebStyles = (() => {
    try { return JSON.parse(salonRow.celebration_font_styles || '["script"]'); }
    catch { return ["script"]; }
  })();
```

Replace with:

```js
  const celebTemplate = salonRow.celebration_template || "script";
```

Also add the import for `TEMPLATE_META` at the top of the file (after the existing imports):

```js
import { TEMPLATE_META } from "../core/postTemplates.js";
```

**Step B: Replace branding tab — Celebration Post Style section**

Find the entire `<!-- CELEBRATION POST STYLE -->` section (lines ~622–650):

```html
    <!-- CELEBRATION POST STYLE -->
    <section class="mb-6">
      <div class="rounded-2xl border border-mpBorder bg-white px-5 py-5">
        <h2 class="text-sm font-semibold text-mpCharcoal mb-1">Celebration Post Style</h2>
        <p class="text-xs text-mpMuted mb-4">Font styles used for birthday and anniversary posts. If multiple are selected, MostlyPostly cycles through them.</p>
        <form method="POST" action="/manager/admin/celebration-styles" class="space-y-3">
          ${[ ... checkboxes ... ]}
          ...
        </form>
      </div>
    </section>
```

Replace the entire section with:

```js
    <!-- CELEBRATION POST STYLE -->
    <section class="mb-6">
      <div class="rounded-2xl border border-mpBorder bg-white px-5 py-5">
        <h2 class="text-sm font-semibold text-mpCharcoal mb-1">Celebration Post Style</h2>
        <p class="text-xs text-mpMuted mb-4">Choose a visual template for birthday and anniversary posts. Preview any template with a test stylist before saving.</p>

        <!-- Template cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          ${Object.entries(TEMPLATE_META.celebration).map(([key, meta]) => {
            const isActive = key === celebTemplate;
            return `
            <div class="relative rounded-xl border-2 p-4 cursor-pointer transition-colors
              ${isActive ? "border-mpAccent bg-mpAccentLight" : "border-mpBorder bg-mpBg hover:border-mpAccent/50"}">
              ${isActive ? `<div class="absolute top-2 right-2 w-5 h-5 rounded-full bg-mpAccent flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>` : ""}
              <p class="text-sm font-semibold text-mpCharcoal pr-6">${meta.label}</p>
              <p class="text-xs text-mpMuted mt-0.5 mb-3">${meta.desc}</p>
              <!-- Save this template -->
              <form method="POST" action="/manager/admin/celebration-template" class="inline">
                <input type="hidden" name="template" value="${key}" />
                <button type="submit"
                  class="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors
                    ${isActive
                      ? "bg-mpAccent text-white cursor-default"
                      : "border border-mpBorder bg-white text-mpCharcoal hover:border-mpAccent hover:text-mpAccent"}">
                  ${isActive ? "Active" : "Set as Default"}
                </button>
              </form>
            </div>`;
          }).join("")}
        </div>

        <!-- Preview generator -->
        <div class="rounded-xl border border-mpBorder bg-mpBg px-4 py-4">
          <p class="text-xs font-semibold text-mpCharcoal mb-3">Generate a test preview (opens in new tab — no post created)</p>
          <form method="GET" action="/manager/admin/celebration-preview" target="_blank"
                class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="block text-[11px] text-mpMuted mb-1">Template</label>
              <select name="template" class="rounded-lg border border-mpBorder bg-white px-3 py-2 text-sm text-mpCharcoal focus:outline-none focus:border-mpAccent">
                ${Object.entries(TEMPLATE_META.celebration).map(([key, meta]) =>
                  `<option value="${key}" ${key === celebTemplate ? "selected" : ""}>${meta.label}</option>`
                ).join("")}
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-mpMuted mb-1">Stylist</label>
              <select name="stylist" class="rounded-lg border border-mpBorder bg-white px-3 py-2 text-sm text-mpCharcoal focus:outline-none focus:border-mpAccent">
                ${db.prepare(`SELECT id, name FROM stylists WHERE salon_id = ? ORDER BY name ASC`).all(salon_id)
                  .map(s => `<option value="${s.id}">${s.name}</option>`).join("") || '<option value="">No stylists yet</option>'}
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-mpMuted mb-1">Type</label>
              <select name="type" class="rounded-lg border border-mpBorder bg-white px-3 py-2 text-sm text-mpCharcoal focus:outline-none focus:border-mpAccent">
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
              </select>
            </div>
            <button type="submit"
              class="rounded-full bg-mpCharcoal px-5 py-2 text-sm font-semibold text-white hover:bg-mpCharcoalDark transition-colors">
              Preview →
            </button>
          </form>
        </div>
      </div>
    </section>
```

**Step C: Add the preview GET route**

Add this route in `admin.js` after the existing `router.post("/celebration-styles", ...)` handler:

```js
// -------------------------------------------------------
// GET: Celebration template preview (opens image in new tab)
// -------------------------------------------------------
router.get("/celebration-preview", requireAuth, async (req, res) => {
  const salon_id = req.manager.salon_id;
  const { template = "script", stylist: stylistId, type = "birthday" } = req.query;

  if (!stylistId) return res.redirect("/manager/admin?tab=branding&err=No+stylist+selected");

  const stylist = db.prepare(`SELECT * FROM stylists WHERE id = ? AND salon_id = ?`).get(stylistId, salon_id);
  if (!stylist) return res.redirect("/manager/admin?tab=branding&err=Stylist+not+found");

  const salon = db.prepare(`SELECT name, brand_palette, logo_url FROM salons WHERE slug = ?`).get(salon_id);

  const palette = (() => { try { return JSON.parse(salon.brand_palette || "{}"); } catch { return {}; } })();
  const accentColor = palette.cta || palette.accent || "#3B72B9";
  const logoPath = salon.logo_url
    ? (salon.logo_url.startsWith("http") ? salon.logo_url : path.resolve("public" + salon.logo_url))
    : null;
  const firstName = stylist.first_name || stylist.name?.split(" ")[0] || stylist.name || "Team";
  const celebrationType = type === "anniversary" ? "anniversary" : "birthday";

  try {
    const { generateCelebrationImage } = await import("../core/celebrationImageGen.js");
    const { feedUrl } = await generateCelebrationImage({
      profilePhotoUrl: stylist.photo_url,
      salonLogoPath:   logoPath,
      firstName,
      celebrationType,
      anniversaryYears: celebrationType === "anniversary" ? 3 : undefined,
      salonName: salon.name,
      accentColor,
      template,
    });
    res.redirect(feedUrl);
  } catch (err) {
    console.error("[Admin] Celebration preview failed:", err.message);
    res.status(500).send(`<p style="font-family:sans-serif;padding:2rem">Preview failed: ${err.message}</p>`);
  }
});
```

Note: `path` is already imported at the top of `admin.js`. The `generateCelebrationImage` dynamic import avoids any potential circular dependency issues; a static import at the top of the file is also fine if there are no circular deps — use whichever is cleaner.

**Step D: Add the template save POST route**

Replace the existing `router.post("/celebration-styles", ...)` handler entirely with this new one (keep the old one commented out or deleted):

```js
// -------------------------------------------------------
// POST: Save celebration template selection
// -------------------------------------------------------
router.post("/celebration-template", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const isOwner  = req.manager.role === "owner";
  if (!isOwner) return res.redirect("/manager/admin?notice=Not+authorized");

  const { TEMPLATE_META } = await import("../core/postTemplates.js"); // use static import at top instead
  const valid = Object.keys(TEMPLATE_META.celebration);
  const template = valid.includes(req.body.template) ? req.body.template : "script";

  db.prepare(`UPDATE salons SET celebration_template = ? WHERE slug = ?`).run(template, salon_id);
  res.redirect("/manager/admin#branding");
});
```

**Important:** Because `router.post` callback is synchronous (better-sqlite3 is sync), the `await import(...)` won't work inside a sync handler. Instead, add a static import at the top of `admin.js`:

```js
import { TEMPLATE_META } from "../core/postTemplates.js";
```

Then the route becomes:

```js
router.post("/celebration-template", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const isOwner  = req.manager.role === "owner";
  if (!isOwner) return res.redirect("/manager/admin?notice=Not+authorized");

  const valid = Object.keys(TEMPLATE_META.celebration);
  const template = valid.includes(req.body.template) ? req.body.template : "script";

  db.prepare(`UPDATE salons SET celebration_template = ? WHERE slug = ?`).run(template, salon_id);
  res.redirect("/manager/admin#branding");
});
```

Similarly for the preview route — make `generateCelebrationImage` a static import at the top of `admin.js`:

```js
import { generateCelebrationImage } from "../core/celebrationImageGen.js";
```

And remove the `await import(...)` inside the route handler, calling `generateCelebrationImage(...)` directly (it's still async, so keep `await`).

**Step E: Delete the old `celebration-styles` route**

Remove the entire `router.post("/celebration-styles", ...)` block — it's replaced by `celebration-template`.

**Step F: Manual verification**

1. Start the server: `node server.js`
2. Navigate to Admin → Branding tab
3. Verify 5 template cards are shown with the active one highlighted
4. Click "Set as Default" on a different template — page reloads with that one active
5. Select a stylist in the Preview section, click "Preview →" — new tab opens showing the generated JPEG
6. Try each of the 5 templates in the preview dropdown

**Step G: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat: celebration template selector UI + preview endpoint in Admin → Branding"
```

---

### Task 4: Push to dev and main

**Step 1: Push dev branch**

```bash
git push origin dev
```

**Step 2: Merge to main and deploy**

```bash
git checkout main
git merge dev
git push origin main
git checkout dev
```

Expected: Render auto-deploys. Check the deploy log for migration 036 confirmation: `[036] Added celebration_template to salons`.

**Step 3: Smoke test on production**

1. Log into production as owner
2. Admin → Branding tab — confirm template cards render
3. Generate a preview with each template — confirm images open in new tab
4. Set a non-default template — confirm it persists on page reload
