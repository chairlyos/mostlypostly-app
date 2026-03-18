# Availability Post Templates — Implementation Plan
_2026-03-17_

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace 4 random SVG overlay templates in `buildAvailabilityImage.js` with 5 visually distinct HTML/Puppeteer templates matching the celebration template family, with a manager-selectable default and live preview in Admin → Branding.

**Architecture:** Extend `postTemplates.js` with availability-specific builders, refactor `buildAvailabilityImage.js` to use Puppeteer renderer + salon.availability_template, add availability template selector + preview UI below the existing Celebration Post Style section in Admin → Branding.

**Tech Stack:** Node.js ESM, better-sqlite3 (synchronous), Puppeteer via `renderHtmlToJpeg`, Express, Google Fonts CDN (same as celebration templates)

---

## Task A: Migration 037 + availability template registry in postTemplates.js

**Files:**
- Create: `migrations/037_availability_template.js`
- Modify: `migrations/index.js`
- Modify: `src/core/postTemplates.js`

### Step 1: Create migration file

Create `migrations/037_availability_template.js`:

```js
// migrations/037_availability_template.js
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(salons)`).all();
  if (cols.some(c => c.name === "availability_template")) return;
  db.prepare(`ALTER TABLE salons ADD COLUMN availability_template TEXT DEFAULT 'script'`).run();
}
```

### Step 2: Register migration in index.js

In `migrations/index.js`, add after the existing run036 import and array entry:

```js
// Add to imports (after run036 line):
import { run as run037 } from "./037_availability_template.js";

// Add to migrations array (after the 036 entry):
  { name: "037_availability_template", run: run037 },
```

### Step 3: Add 5 availability builders to postTemplates.js

Append the following before the `// ─── Registry` section in `postTemplates.js`.

---

#### Availability Template 1: script — Handwritten Elegance

Full-bleed photo with heavy bottom vignette, Great Vibes "Now Booking" script eyebrow, bold uppercase stylist name, slot rows with accent dash, accent pill CTA.

```js
// ─── Availability Template 1: script — Handwritten Elegance ──────────────

function buildAvailHtml_script({ width, height, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex }) {
  const W = width, H = height;
  const pad = Math.round(W * 0.055);
  const displaySlots = (slots && slots.length) ? slots.slice(0, 5) : ["Check back soon"];

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#1a1c22 0%,#2B2D35 100%);"></div>`;

  const slotRows = displaySlots.map(slot => `
    <div style="display:flex;align-items:center;gap:${Math.round(W*0.022)}px;padding:${Math.round(H*0.012)}px 0;border-top:1px solid rgba(255,255,255,0.10);">
      <div style="width:${Math.round(W*0.025)}px;height:1px;background:${accentHex};flex-shrink:0;"></div>
      <span style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.022)}px;font-weight:400;color:rgba(255,255,255,0.90);">${safe(slot)}</span>
    </div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(0,0,0,0.08) 25%,rgba(0,0,0,0.65) 50%,rgba(0,0,0,0.92) 72%,rgba(0,0,0,0.97) 100%);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:${Math.round(H*0.048)}px ${pad}px ${Math.round(H*0.065)}px;">
    <div style="width:${Math.round(W*0.075)}px;height:${Math.round(H*0.003)}px;background:${accentHex};border-radius:2px;margin-bottom:${Math.round(H*0.016)}px;"></div>
    <div style="font-family:'Great Vibes',cursive;font-size:${Math.round(H*0.065)}px;color:rgba(255,255,255,0.85);margin-bottom:${Math.round(H*0.010)}px;line-height:1.1;">Now Booking</div>
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.040)}px;font-weight:700;color:#fff;letter-spacing:6px;text-transform:uppercase;margin-bottom:${Math.round(H*0.022)}px;">${safe(stylistName)}</div>
    <div>${slotRows}</div>
    <div style="margin-top:${Math.round(H*0.028)}px;display:inline-block;background:${accentHex};border-radius:999px;padding:${Math.round(H*0.012)}px ${Math.round(W*0.07)}px;font-family:'Lato',sans-serif;font-size:${Math.round(H*0.018)}px;font-weight:700;color:#fff;letter-spacing:2px;text-transform:uppercase;">${safe(bookingCta || "Book via link in bio")}</div>
  </div>
  ${logoHtml(logoDataUri, W, H, pad)}
  ${watermarkHtml(H, pad)}
</body></html>`;
}
```

---

#### Availability Template 2: editorial — Magazine Split

White panel left (44%), full-bleed photo right. Lato 300 "Now Available" tracked eyebrow, Playfair Display italic stylist name, slot list with accent dots, muted CTA line.

```js
// ─── Availability Template 2: editorial — Magazine Split ──────────────────

function buildAvailHtml_editorial({ width, height, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex }) {
  const W = width, H = height;
  const panelW = Math.round(W * 0.44);
  const pad    = Math.round(panelW * 0.12);
  const displaySlots = (slots && slots.length) ? slots.slice(0, 5) : ["Check back soon"];

  const photo = photoDataUri
    ? `<img style="position:absolute;right:0;top:0;width:${W - panelW}px;height:100%;object-fit:cover;object-position:center top;" src="${photoDataUri}" />`
    : `<div style="position:absolute;right:0;top:0;width:${W - panelW}px;height:100%;background:linear-gradient(160deg,${accentHex}88 0%,#1a1c22 100%);"></div>`;

  const slotItems = displaySlots.map(slot => `
    <div style="display:flex;align-items:flex-start;gap:${Math.round(panelW*0.06)}px;margin-bottom:${Math.round(H*0.018)}px;">
      <div style="width:${Math.round(panelW*0.026)}px;height:${Math.round(panelW*0.026)}px;border-radius:50%;background:${accentHex};flex-shrink:0;margin-top:${Math.round(H*0.008)}px;"></div>
      <span style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.020)}px;font-weight:400;color:rgba(26,28,34,0.80);line-height:1.4;">${safe(slot)}</span>
    </div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#fff;}</style>
</head><body>
  ${photo}
  <!-- Feather blend -->
  <div style="position:absolute;left:${panelW - 2}px;top:0;width:${Math.round(panelW*0.14)}px;height:100%;background:linear-gradient(to right,#fff 0%,transparent 100%);z-index:1;pointer-events:none;"></div>
  <!-- Left white editorial panel -->
  <div style="position:absolute;top:0;left:0;width:${panelW}px;height:100%;background:#fff;z-index:1;
    display:flex;flex-direction:column;justify-content:center;
    padding:${Math.round(H*0.07)}px ${pad}px;">
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(panelW*0.046)}px;font-weight:300;
      color:rgba(26,28,34,0.40);letter-spacing:${Math.round(panelW*0.046*0.22)}px;
      text-transform:uppercase;margin-bottom:${Math.round(H*0.020)}px;">Now Available</div>
    <div style="width:${Math.round(panelW*0.15)}px;height:2px;background:${accentHex};margin-bottom:${Math.round(H*0.022)}px;"></div>
    <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:${Math.round(panelW*0.19)}px;font-weight:700;
      color:#1a1c22;line-height:1.0;word-break:break-word;margin-bottom:${Math.round(H*0.028)}px;">${safe(stylistName)}</div>
    <div>${slotItems}</div>
    <div style="margin-top:${Math.round(H*0.022)}px;font-family:'Lato',sans-serif;font-size:${Math.round(H*0.016)}px;font-weight:300;
      color:rgba(26,28,34,0.42);letter-spacing:1px;">${safe(bookingCta || "Book via link in bio")}</div>
  </div>
  <!-- Logo over photo, top-right -->
  ${logoHtml(logoDataUri, W, H, Math.round(W*0.03))}
  <!-- Watermark: dark text on white panel -->
  <div style="position:absolute;bottom:${Math.round(H*0.022)}px;left:${pad}px;z-index:2;
    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:${Math.round(H*0.013)}px;font-weight:400;
    color:rgba(26,28,34,0.22);letter-spacing:0.5px;">#MostlyPostly</div>
</body></html>`;
}
```

---

#### Availability Template 3: bold — Vertical Statement

Full-bleed photo with brightness filter. Stylist name vertical on left edge. Dark right panel: "NOW BOOKING" eyebrow + slot list with accent left-border, muted CTA.

```js
// ─── Availability Template 3: bold — Vertical Statement ───────────────────

function buildAvailHtml_bold({ width, height, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex }) {
  const W = width, H = height;
  const pad = Math.round(W * 0.055);
  const panelW = Math.round(W * 0.44);
  const nameFontSize    = Math.round(H * 0.13);
  const eyebrowFontSize = Math.round(panelW * 0.09);
  const displaySlots = (slots && slots.length) ? slots.slice(0, 5) : ["Check back soon"];

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.65);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${accentHex}cc 0%,#1a1c22 100%);"></div>`;

  const slotRows = displaySlots.map(slot => `
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(panelW*0.075)}px;font-weight:300;
      color:rgba(255,255,255,0.82);margin-bottom:${Math.round(H*0.016)}px;
      border-left:2px solid ${accentHex};padding-left:${Math.round(panelW*0.07)}px;line-height:1.3;">${safe(slot)}</div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <!-- Right dark panel -->
  <div style="position:absolute;top:0;right:0;width:${panelW}px;height:100%;
    background:rgba(0,0,0,0.80);
    display:flex;flex-direction:column;justify-content:center;
    padding:${Math.round(H*0.06)}px ${Math.round(panelW*0.12)}px;">
    <div style="width:${Math.round(panelW*0.18)}px;height:3px;background:${accentHex};margin-bottom:${Math.round(H*0.025)}px;"></div>
    <div style="font-family:'Lato',sans-serif;font-size:${eyebrowFontSize}px;font-weight:400;
      color:rgba(255,255,255,0.55);letter-spacing:${Math.round(eyebrowFontSize*0.08)}px;
      text-transform:uppercase;margin-bottom:${Math.round(H*0.030)}px;line-height:1.3;">NOW BOOKING</div>
    <div style="margin-bottom:${Math.round(H*0.032)}px;">${slotRows}</div>
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(panelW*0.065)}px;font-weight:300;
      color:rgba(255,255,255,0.42);letter-spacing:1px;">${safe(bookingCta || "Book via link in bio")}</div>
  </div>
  <!-- Vertical name text — left strip -->
  <div style="position:absolute;left:0;top:0;bottom:0;width:${nameFontSize*1.25}px;
    display:flex;align-items:center;justify-content:center;">
    <div style="writing-mode:vertical-rl;transform:rotate(180deg);
      font-family:'Montserrat',sans-serif;font-size:${nameFontSize}px;font-weight:800;
      color:rgba(255,255,255,0.92);text-transform:uppercase;letter-spacing:8px;
      text-shadow:0 4px 32px rgba(0,0,0,0.6);">${safe(stylistName)}</div>
  </div>
  ${logoHtml(logoDataUri, W, H, pad)}
  ${watermarkHtml(H, pad)}
</body></html>`;
}
```

---

#### Availability Template 4: luxury — Frosted Card

Full-bleed darkened photo. Centered frosted glass card positioned at ~62% vertical. "Now Available" tracked eyebrow, accent divider, Playfair italic stylist name, slot rows separated by thin rules, muted CTA.

```js
// ─── Availability Template 4: luxury — Frosted Card ───────────────────────

function buildAvailHtml_luxury({ width, height, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex }) {
  const W = width, H = height;
  const pad   = Math.round(W * 0.055);
  const cardW = Math.round(W * 0.78);
  const displaySlots = (slots && slots.length) ? slots.slice(0, 5) : ["Check back soon"];

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.40) saturate(0.85);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${accentHex}99 0%,#1a1c22 100%);"></div>`;

  const slotRows = displaySlots.map((slot, i) => `
    ${i > 0 ? `<div style="width:100%;height:1px;background:rgba(255,255,255,0.12);margin:${Math.round(H*0.015)}px 0;"></div>` : ""}
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.021)}px;font-weight:300;
      color:rgba(255,255,255,0.85);text-align:center;padding:${Math.round(H*0.008)}px 0;">${safe(slot)}</div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400;1,700&family=Lato:wght@300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#1a1c22;}</style>
</head><body>
  ${photoBg}
  <!-- Frosted glass card -->
  <div style="position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);
    width:${cardW}px;
    background:rgba(255,255,255,0.10);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    border:1px solid rgba(255,255,255,0.18);
    border-radius:${Math.round(H*0.022)}px;
    padding:${Math.round(H*0.055)}px ${Math.round(cardW*0.10)}px;
    text-align:center;">
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.019)}px;font-weight:300;
      color:rgba(255,255,255,0.60);letter-spacing:${Math.round(H*0.019*0.7)}px;
      text-transform:uppercase;margin-bottom:${Math.round(H*0.025)}px;">Now Available</div>
    <div style="width:${Math.round(cardW*0.22)}px;height:1px;background:${accentHex};
      margin:0 auto ${Math.round(H*0.028)}px;opacity:0.8;"></div>
    <div style="font-family:'Playfair Display',serif;font-size:${Math.round(H*0.065)}px;font-style:italic;font-weight:700;
      color:#fff;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,0.4);
      margin-bottom:${Math.round(H*0.028)}px;">${safe(stylistName)}</div>
    <div style="width:${Math.round(cardW*0.22)}px;height:1px;background:rgba(255,255,255,0.18);
      margin:0 auto ${Math.round(H*0.022)}px;"></div>
    <div>${slotRows}</div>
    <div style="width:${Math.round(cardW*0.22)}px;height:1px;background:rgba(255,255,255,0.12);
      margin:${Math.round(H*0.022)}px auto ${Math.round(H*0.018)}px;"></div>
    <div style="font-family:'Lato',sans-serif;font-size:${Math.round(H*0.016)}px;font-weight:300;
      color:rgba(255,255,255,0.42);letter-spacing:2px;text-transform:uppercase;">${safe(bookingCta || "Book via link in bio")}</div>
  </div>
  ${logoHtml(logoDataUri, W, H, pad)}
  ${watermarkHtml(H, pad)}
</body></html>`;
}
```

---

#### Availability Template 5: minimal — Moody Centered

Full-bleed photo at brightness 0.28. All content centered. Thin "Now Booking" caps, large thin stylist name, accent line, centered slot list, accent pill CTA.

```js
// ─── Availability Template 5: minimal — Moody Centered ────────────────────

function buildAvailHtml_minimal({ width, height, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex }) {
  const W = width, H = height;
  const pad = Math.round(W * 0.055);
  const displaySlots = (slots && slots.length) ? slots.slice(0, 5) : ["Check back soon"];

  const photoBg = photoDataUri ? `
    <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.28) saturate(0.8);" src="${photoDataUri}" />`
    : `<div style="position:absolute;inset:0;background:#0f1015;"></div>`;

  const slotItems = displaySlots.map(slot => `
    <div style="font-family:'Montserrat',sans-serif;font-size:${Math.round(H*0.022)}px;font-weight:300;
      color:rgba(255,255,255,0.70);text-align:center;margin-bottom:${Math.round(H*0.014)}px;
      letter-spacing:1px;">${safe(slot)}</div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#0f1015;}</style>
</head><body>
  ${photoBg}
  <!-- Centered content -->
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;text-align:center;
    padding:${Math.round(H*0.08)}px ${Math.round(W*0.10)}px;">
    <div style="font-family:'Montserrat',sans-serif;font-size:${Math.round(H*0.018)}px;font-weight:300;
      color:rgba(255,255,255,0.45);letter-spacing:${Math.round(H*0.018*0.9)}px;
      text-transform:uppercase;margin-bottom:${Math.round(H*0.025)}px;">Now Booking</div>
    <div style="font-family:'Montserrat',sans-serif;font-size:${Math.round(H*0.088)}px;font-weight:200;
      color:#fff;letter-spacing:4px;line-height:1.05;margin-bottom:${Math.round(H*0.028)}px;">${safe(stylistName)}</div>
    <div style="width:${Math.round(W*0.12)}px;height:1px;background:${accentHex};
      margin:0 auto ${Math.round(H*0.032)}px;"></div>
    <div style="margin-bottom:${Math.round(H*0.032)}px;">${slotItems}</div>
    <div style="display:inline-block;background:${accentHex};border-radius:999px;
      padding:${Math.round(H*0.012)}px ${Math.round(W*0.07)}px;
      font-family:'Montserrat',sans-serif;font-size:${Math.round(H*0.016)}px;font-weight:300;
      color:rgba(255,255,255,0.9);letter-spacing:${Math.round(H*0.016*0.4)}px;
      text-transform:uppercase;">${safe(bookingCta || "Book via link in bio")}</div>
  </div>
  ${logoHtml(logoDataUri, W, H, pad)}
  ${watermarkHtml(H, pad)}
</body></html>`;
}
```

---

### Step 4: Add availability entries to TEMPLATE_META and TEMPLATES registries

In `postTemplates.js`, extend the existing `TEMPLATE_META` and `TEMPLATES` exports:

Replace the existing export block:

```js
export const TEMPLATE_META = {
  celebration: {
    script:    { label: "Handwritten Elegance", desc: "Script font · Photo-first" },
    editorial: { label: "Magazine Split",       desc: "White panel · Serif italic · Photo right" },
    bold:      { label: "Vertical Statement",   desc: "High-impact · Vertical name" },
    luxury:    { label: "Frosted Card",         desc: "Frosted glass · Serif italic" },
    minimal:   { label: "Moody Centered",       desc: "Minimal · Dark mood" },
  },
  availability: {
    script:    { label: "Handwritten Elegance", desc: "Script eyebrow · Photo-first · Slot rows" },
    editorial: { label: "Magazine Split",       desc: "White panel · Serif name · Slot list" },
    bold:      { label: "Vertical Statement",   desc: "Vertical name · Dark panel · Slots" },
    luxury:    { label: "Frosted Card",         desc: "Frosted glass card · Centered slots" },
    minimal:   { label: "Moody Centered",       desc: "Dark mood · Centered · Pill CTA" },
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
  availability: {
    script:    buildAvailHtml_script,
    editorial: buildAvailHtml_editorial,
    bold:      buildAvailHtml_bold,
    luxury:    buildAvailHtml_luxury,
    minimal:   buildAvailHtml_minimal,
  },
};
```

### Step 5: Verify

Start the server and confirm it boots without errors. No tests needed for template functions at this stage (visual output is verified via preview in Task C).

```bash
node --input-type=module <<'EOF'
import { TEMPLATES, TEMPLATE_META } from "./src/core/postTemplates.js";
console.log("celebration keys:", Object.keys(TEMPLATES.celebration));
console.log("availability keys:", Object.keys(TEMPLATES.availability));
console.log("meta keys:", Object.keys(TEMPLATE_META.availability));
EOF
```

Expected output:
```
celebration keys: [ 'script', 'editorial', 'bold', 'luxury', 'minimal' ]
availability keys: [ 'script', 'editorial', 'bold', 'luxury', 'minimal' ]
meta keys: [ 'script', 'editorial', 'bold', 'luxury', 'minimal' ]
```

### Step 6: Commit

```bash
git add migrations/037_availability_template.js migrations/index.js src/core/postTemplates.js
git commit -m "feat: add availability_template migration + 5 HTML template builders"
```

---

## Task B: Refactor buildAvailabilityImage.js to use Puppeteer + template registry

**Blocked by:** Task A
**Files:**
- Modify: `src/core/buildAvailabilityImage.js`

### Step 1: Rewrite buildAvailabilityImage.js

The new file keeps `parseAvailabilitySlots()` and `pickBackground()` verbatim. It removes the 4 SVG overlay functions, the sharp/FONT_PATH/FONT_B64 code, and `buildOverlaySvg()`. It adds `toBase64DataUri()` and rewires the main export.

Replace the entire file with:

```js
// src/core/buildAvailabilityImage.js
// HTML/Puppeteer availability story image generator.
// Template selected per salon via salons.availability_template column.

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import crypto from "crypto";
import { db } from "../../db.js";
import { UPLOADS_DIR, toUploadUrl } from "./uploadPath.js";
import { renderHtmlToJpeg } from "./puppeteerRenderer.js";
import { TEMPLATES } from "./postTemplates.js";
import { fetchPexelsBackground } from "./pexels.js";

// Instagram Story: 9:16
const W = 1080;
const H = 1920;
const FALLBACK_TEMPLATE = "script";

// ─────────────────────────────────────────────────────────
// Parse availability slots from free-form text via GPT
// ─────────────────────────────────────────────────────────
export async function parseAvailabilitySlots(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [text]; // fallback: treat whole text as one slot

  const systemPrompt = `You extract appointment availability from a stylist's message.
Return ONLY a JSON array of concise slot strings. Each string should be max 35 chars.
Format each slot as: "Day: Time for Service" (e.g. "Friday: 2pm for Color Service")
If no service is mentioned, use: "Day: Time" (e.g. "Friday: 2pm")
If a time range is given, use: "Friday: 2pm–4pm for Color"
Use the actual day name (Monday, Tuesday, etc.) not a date number.
Examples: ["Friday: 2pm for Color Service", "Saturday: 10am–12pm", "Monday: 3pm for Highlights"]
If no clear times exist, return the message split into short meaningful lines.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 6);
  } catch (err) {
    console.warn("[Availability] Slot parse failed:", err.message);
  }

  // Fallback: split on commas or newlines
  return text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
}

// ─────────────────────────────────────────────────────────
// Pick background: stylist photo → stylist stock → salon stock → Pexels
// ─────────────────────────────────────────────────────────
function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function pickBackground(stylistId, salonId) {
  // 1. Personal profile photo from stylists table
  if (stylistId) {
    const stylistRow = db.prepare(`SELECT photo_url FROM stylists WHERE id = ?`).get(stylistId);
    if (stylistRow?.photo_url) {
      console.log("[Availability] Using stylist personal photo");
      return stylistRow.photo_url;
    }

    // 2. Stylist-linked stock photos — pick randomly for variety
    const stylistPhotos = db.prepare(
      `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id = ? ORDER BY RANDOM() LIMIT 5`
    ).all(salonId, stylistId);
    const pick = pickRandom(stylistPhotos);
    if (pick?.url) {
      console.log("[Availability] Using stylist stock photo");
      return pick.url;
    }
  }

  // 3. Salon-wide stock photos — pick randomly
  const salonPhotos = db.prepare(
    `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id IS NULL ORDER BY RANDOM() LIMIT 10`
  ).all(salonId);
  const salonPick = pickRandom(salonPhotos);
  if (salonPick?.url) {
    console.log("[Availability] Using salon-wide stock photo");
    return salonPick.url;
  }

  // 4. Pexels real photo fallback
  console.log("[Availability] No stock photo found — fetching Pexels background");
  return await fetchPexelsBackground("availability");
}

// ─────────────────────────────────────────────────────────
// Convert URL or local file path to base64 data URI
// Handles Twilio authenticated URLs, HTTP URLs, and local paths.
// ─────────────────────────────────────────────────────────
async function toBase64DataUri(source) {
  try {
    let buf;
    if (source?.startsWith("http")) {
      const isTwilio = /^https:\/\/api\.twilio\.com/i.test(source);
      const headers = isTwilio
        ? { Authorization: "Basic " + Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64") }
        : {};
      const resp = await fetch(source, { headers, redirect: "follow", timeout: 10000 });
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
 * Build the availability story image.
 *
 * @param {object} opts
 * @param {string}   opts.text            - Raw availability message from stylist (used if slots not pre-built)
 * @param {string[]} [opts.slots]         - Pre-built slot strings (e.g. from Zenoti sync) — skips GPT parse
 * @param {string}   opts.stylistName
 * @param {string}   opts.salonName
 * @param {string}   opts.salonId
 * @param {string}   [opts.stylistId]
 * @param {string}   [opts.instagramHandle]
 * @param {string}   [opts.bookingCta]
 * @param {string}   [opts.submittedImageUrl] - Photo submitted with the message (wins over stock)
 * @returns {Promise<string>}  Public URL of the saved story JPEG
 */
export async function buildAvailabilityImage({ text, slots: prebuiltSlots, stylistName, salonName, salonId, stylistId, instagramHandle, bookingCta, submittedImageUrl }) {
  console.log("[Availability] Building story image…");

  // 1. Parse slots — skip GPT if pre-structured slots provided (e.g. from Zenoti sync)
  const slots = prebuiltSlots && prebuiltSlots.length
    ? prebuiltSlots
    : await parseAvailabilitySlots(text);
  console.log("[Availability] Slots parsed:", slots);

  // 2. Pick background URL
  const bgUrl = submittedImageUrl || await pickBackground(stylistId, salonId);

  // 3. Load salon row: template key, palette, logo
  const salonRow = db.prepare(
    `SELECT availability_template, brand_palette, logo_url FROM salons WHERE slug = ?`
  ).get(salonId) || {};

  const template = salonRow.availability_template || FALLBACK_TEMPLATE;
  let palette = {};
  try { if (salonRow.brand_palette) palette = JSON.parse(salonRow.brand_palette); } catch {}

  const accentHex = palette.cta || palette.accent || "#3B72B9";
  const bandHex   = palette.primary || "#1a1c22";

  // 4. Resolve logo path (prefer local file over HTTP self-fetch)
  const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  let logoSource = null;
  if (salonRow.logo_url) {
    if (PUBLIC_BASE && salonRow.logo_url.startsWith(PUBLIC_BASE + "/uploads/")) {
      const rel = salonRow.logo_url.slice(PUBLIC_BASE.length);
      const abs = path.resolve("public" + rel);
      logoSource = fs.existsSync(abs) ? abs : salonRow.logo_url;
    } else if (salonRow.logo_url.startsWith("/uploads/")) {
      const abs = path.resolve("public" + salonRow.logo_url);
      logoSource = fs.existsSync(abs) ? abs : null;
    } else {
      logoSource = salonRow.logo_url;
    }
  }

  // 5. Convert photo and logo to base64 data URIs for Puppeteer
  const [photoDataUri, logoDataUri] = await Promise.all([
    bgUrl ? toBase64DataUri(bgUrl) : Promise.resolve(null),
    logoSource ? toBase64DataUri(logoSource) : Promise.resolve(null),
  ]);

  // 6. Select template builder with fallback
  const buildHtml = TEMPLATES.availability[template] || TEMPLATES.availability[FALLBACK_TEMPLATE];
  if (!TEMPLATES.availability[template]) {
    console.warn(`[Availability] Unknown template "${template}", falling back to "${FALLBACK_TEMPLATE}"`);
  }

  // 7. Build HTML and render via Puppeteer
  const html = buildHtml({ width: W, height: H, photoDataUri, logoDataUri, stylistName, salonName, slots, bookingCta, instagramHandle, accentHex, bandHex });
  const buf  = await renderHtmlToJpeg(html, W, H);

  // 8. Save and return public URL
  const fileName = `availability-${crypto.randomUUID()}.jpg`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, buf);

  const publicUrl = toUploadUrl(fileName);
  console.log("[Availability] Story image saved:", publicUrl);
  return publicUrl;
}
```

### Step 2: Verify the module loads

```bash
node --input-type=module <<'EOF'
import { buildAvailabilityImage, parseAvailabilitySlots } from "./src/core/buildAvailabilityImage.js";
console.log("buildAvailabilityImage loaded:", typeof buildAvailabilityImage);
console.log("parseAvailabilitySlots loaded:", typeof parseAvailabilitySlots);
EOF
```

Expected: `buildAvailabilityImage loaded: function` and `parseAvailabilitySlots loaded: function`

### Step 3: Commit

```bash
git add src/core/buildAvailabilityImage.js
git commit -m "refactor: replace sharp/SVG availability image builder with Puppeteer + template registry"
```

---

## Task C: Admin UI — availability template selector + preview + save routes

**Blocked by:** Task A, Task B
**Files:**
- Modify: `src/routes/admin.js`

### Step 1: Add import for buildAvailabilityImage

At the top of `src/routes/admin.js`, add after the existing `generateCelebrationImage` import:

```js
import { buildAvailabilityImage } from "../core/buildAvailabilityImage.js";
```

### Step 2: Read availability_template in the GET handler

In the GET `/` handler, after the line `const celebTemplate = salonRow.celebration_template || "script";` (line ~212), add:

```js
  const availTemplate = salonRow.availability_template || "script";
```

### Step 3: Add Availability Post Style section to Branding tab HTML

Find the closing `</div><!-- end admin-panel-branding -->` comment (line ~690). Insert the new section immediately before it:

```html
    <!-- AVAILABILITY POST STYLE SECTION -->
    <section class="mb-6">
      <div class="rounded-2xl border border-mpBorder bg-white px-5 py-5">
        <h2 class="text-sm font-semibold text-mpCharcoal mb-1">Availability Post Style</h2>
        <p class="text-xs text-mpMuted mb-4">Choose a visual template for availability posts. Preview any template before saving.</p>

        <!-- Template cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          ${Object.entries(TEMPLATE_META.availability).map(([key, meta]) => {
            const isActive = key === availTemplate;
            return `
            <div class="relative rounded-xl border-2 p-4
              ${isActive ? "border-mpAccent bg-mpAccentLight" : "border-mpBorder bg-mpBg"}">
              ${isActive ? `<div class="absolute top-2 right-2 w-5 h-5 rounded-full bg-mpAccent flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>` : ""}
              <p class="text-sm font-semibold text-mpCharcoal pr-6">${meta.label}</p>
              <p class="text-xs text-mpMuted mt-0.5 mb-3">${meta.desc}</p>
              <form method="POST" action="/manager/admin/availability-template">
                <input type="hidden" name="template" value="${key}" />
                <button type="submit"
                  class="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
                    ${isActive
                      ? "border-mpAccent bg-mpAccent text-white cursor-default"
                      : "border-mpBorder bg-white text-mpCharcoal hover:border-mpAccent hover:text-mpAccent"}">
                  ${isActive ? "Active" : "Set as Default"}
                </button>
              </form>
            </div>`;
          }).join("")}
        </div>

        <!-- Preview generator -->
        <div class="rounded-xl border border-mpBorder bg-mpBg px-4 py-4">
          <p class="text-xs font-semibold text-mpCharcoal mb-3">Generate a test preview (opens in new tab — no post created)</p>
          <form method="GET" action="/manager/admin/availability-preview" target="_blank"
                class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="block text-[11px] text-mpMuted mb-1">Template</label>
              <select name="template" class="rounded-lg border border-mpBorder bg-white px-3 py-2 text-sm text-mpCharcoal focus:outline-none focus:border-mpAccent">
                ${Object.entries(TEMPLATE_META.availability).map(([key, meta]) =>
                  `<option value="${key}" ${key === availTemplate ? "selected" : ""}>${meta.label}</option>`
                ).join("")}
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-mpMuted mb-1">Stylist</label>
              <select name="stylist" class="rounded-lg border border-mpBorder bg-white px-3 py-2 text-sm text-mpCharcoal focus:outline-none focus:border-mpAccent">
                ${db.prepare("SELECT id, name FROM stylists WHERE salon_id = ? ORDER BY name ASC").all(salon_id)
                  .map(s => `<option value="${s.id}">${s.name}</option>`).join("") || '<option value="">No stylists yet</option>'}
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

Note: This HTML is inside the existing template literal in the GET handler, so backtick/template-string context applies. The `${Object.entries(...)}` expressions and `${db.prepare...}` calls are the same pattern already used for the celebration section directly above.

### Step 4: Add GET availability-preview route

Add this route immediately after the `router.post("/celebration-template", ...)` route (before the export line):

```js
// GET: Availability template preview (opens image in new tab, no post created)
router.get("/availability-preview", requireAuth, async (req, res) => {
  const salon_id = req.manager.salon_id;
  const validTemplates = Object.keys(TEMPLATE_META.availability);
  const rawTemplate = req.query.template;
  const template = validTemplates.includes(rawTemplate) ? rawTemplate : "script";
  const { stylist: stylistId } = req.query;

  if (!stylistId) return res.redirect("/manager/admin?tab=branding&err=No+stylist+selected");

  const stylist = db.prepare(`SELECT * FROM stylists WHERE id = ? AND salon_id = ?`).get(stylistId, salon_id);
  if (!stylist) return res.redirect("/manager/admin?tab=branding&err=Stylist+not+found");

  const salon = db.prepare(`SELECT name, brand_palette, logo_url FROM salons WHERE slug = ?`).get(salon_id);

  // Temporarily override template for this preview call
  // We pass it directly to buildAvailabilityImage via a mock salonId override.
  // Simplest approach: update the column, generate, restore — but that's racey.
  // Better: inject template directly. buildAvailabilityImage reads from DB, so
  // write the requested template to DB for this call, generate, restore.
  // Actually cleanest: just call the builder directly from postTemplates.js.

  const palette = (() => { try { return JSON.parse(salon.brand_palette || "{}"); } catch { return {}; } })();
  const accentHex = palette.cta || palette.accent || "#3B72B9";
  const bandHex   = palette.primary || "#1a1c22";

  const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  let logoSource = null;
  if (salon.logo_url) {
    if (PUBLIC_BASE && salon.logo_url.startsWith(PUBLIC_BASE + "/uploads/")) {
      const rel = salon.logo_url.slice(PUBLIC_BASE.length);
      const abs = path.resolve("public" + rel);
      logoSource = fs.existsSync(abs) ? abs : salon.logo_url;
    } else if (salon.logo_url.startsWith("/uploads/")) {
      const abs = path.resolve("public" + salon.logo_url);
      logoSource = fs.existsSync(abs) ? abs : null;
    } else {
      logoSource = salon.logo_url;
    }
  }

  try {
    // Call buildAvailabilityImage but force the template by temporarily setting it on the salon row.
    // Safer: pass template override directly. Since buildAvailabilityImage reads the DB column,
    // we save the requested template temporarily (it's a preview — low-stakes write), generate,
    // then restore the original value.
    const originalTemplate = db.prepare(`SELECT availability_template FROM salons WHERE slug = ?`).get(salon_id)?.availability_template || "script";
    db.prepare(`UPDATE salons SET availability_template = ? WHERE slug = ?`).run(template, salon_id);

    const MOCK_SLOTS = ["Tuesday: 2:00pm · Color", "Wednesday: 10:00am · Haircut", "Friday: 3:30pm · Blowout"];
    const imageUrl = await buildAvailabilityImage({
      slots: MOCK_SLOTS,
      stylistName:     stylist.name,
      salonName:       salon.name,
      salonId:         salon_id,
      stylistId:       stylist.id,
      instagramHandle: stylist.instagram_handle || null,
      bookingCta:      "Book via link in bio",
    });

    db.prepare(`UPDATE salons SET availability_template = ? WHERE slug = ?`).run(originalTemplate, salon_id);
    res.redirect(imageUrl);
  } catch (err) {
    console.error("[Admin] Availability preview failed:", err.message);
    res.status(500).send(`<p style="font-family:sans-serif;padding:2rem">Preview failed: ${err.message}</p>`);
  }
});

// POST: Save availability template selection
router.post("/availability-template", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const valid    = Object.keys(TEMPLATE_META.availability);
  const template = valid.includes(req.body.template) ? req.body.template : "script";
  db.prepare(`UPDATE salons SET availability_template = ? WHERE slug = ?`).run(template, salon_id);
  res.redirect("/manager/admin#branding");
});
```

### Step 5: Manual smoke test

1. Log into the app as a manager
2. Go to Admin → Branding tab — confirm the new "Availability Post Style" section appears below "Celebration Post Style"
3. Click "Set as Default" on any template card — confirm it saves (green checkmark appears, redirect to #branding)
4. In the preview form: select a template + stylist, click Preview → — confirm image opens in new tab (JPEG, 1080×1920)
5. Test all 5 templates in the preview — confirm all render without errors
6. Test with a stylist who has no photo — confirm fallback works

### Step 6: Commit

```bash
git add src/routes/admin.js
git commit -m "feat: availability template selector + preview + save routes in admin branding"
```

---

## Task D: Push to dev and main, smoke test

**Blocked by:** Task A, Task B, Task C

### Step 1: Push to dev

```bash
git push origin dev
```

Wait for Render staging deploy to complete (watch Render dashboard or `gh run watch`).

### Step 2: Smoke test on staging

1. Log in to staging as a manager with stylists configured
2. Admin → Branding → scroll to Availability Post Style section
3. Preview each of the 5 templates
4. Set a non-default template (e.g. "luxury") as the default
5. Trigger an availability post (SMS "post my availability" from a stylist phone, or use the Zenoti sync if available) — confirm the image uses the luxury template
6. Verify no regressions in celebration post template selector or preview

### Step 3: Merge to main

```bash
git checkout main
git merge dev
git push origin main
```

Confirm production auto-deploy succeeds on Render.

### Step 4: Update CLAUDE.md

In `CLAUDE.md`, add `availability_template` to the `salons` table schema section:

```
| availability_template | TEXT | Template key for availability posts (migration 037). Default `'script'`. See `TEMPLATES.availability` in `postTemplates.js`. |
```

### Step 5: Commit

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with availability_template column"
```

---

## Error Handling Reference

| Scenario | Handling |
|----------|----------|
| Unknown template key | Fall back to `script`, log warning |
| Stylist not found / wrong salon | Redirect to admin with `?err=` param |
| Puppeteer render failure | 500 error page |
| Missing stylist photo | Dark gradient fallback (photoDataUri = null handled in each template) |
| Missing logo | `logoHtml()` returns `""` when logoDataUri is null |
| Empty slots array | Show "Check back soon" placeholder row (handled in each template with `displaySlots` fallback) |
