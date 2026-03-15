# Birthday & Anniversary Posts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Generate dual-format (feed + story) branded celebration images for stylist birthdays and work anniversaries, with 3 selectable font styles per salon, auto-approve, and daily detection.

**Architecture:** Rewrite celebrationImageGen.js to output both 1080x1080 and 1080x1920 images using sharp + SVG with embedded Google Font base64. A new celebrationScheduler.js runs inside the existing scheduler tick, scanning stylists for today birthdays/anniversaries at 6am salon-local time. Font style preferences stored per salon in the DB; cycled via index.

**Tech Stack:** Node.js ESM, sharp 0.34.5, better-sqlite3, node-fetch, OpenAI GPT-4o-mini, Luxon for timezone handling, sendViaTwilio for manager SMS.

---

### Task 1: Migration 033 — celebration font style columns

**Files:**
- Create: migrations/033_celebration_styles.js
- Modify: migrations/index.js

```js
// migrations/033_celebration_styles.js
export function run(db) {
  db.exec(`ALTER TABLE salons ADD COLUMN celebration_font_styles TEXT DEFAULT '["script"]';`);
  db.exec(`ALTER TABLE salons ADD COLUMN celebration_font_index INTEGER DEFAULT 0;`);
  console.log("[033] Added celebration_font_styles and celebration_font_index to salons");
}
```

Register in migrations/index.js after run032.

Verify: start server, see [033] log line. Commit.

---

### Task 2: Font loader utility (src/core/fontLoader.js)

Fetches Google Font TTF files and returns base64 data URIs for SVG @font-face embedding. Cached in memory after first fetch.

Fonts needed:
- "Great Vibes" — https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.ttf
- "Montserrat"  — https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw0aXp-p7K4KLjztg.ttf
- "Pacifico"    — https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf
- "Lato"        — https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXg.ttf

Export: getFontBase64(fontName) => Promise<string|null>
Falls back to null on fetch error (SVG then falls back to system font).

---

### Task 3: Rewrite celebrationImageGen.js — dual format + font styles

Full rewrite of src/core/celebrationImageGen.js.

Key changes from existing file:
- Add fontStyle param ("script"|"editorial"|"playful")
- FONT_STYLES map: headlineFont, headlineSize (square/story), headlineWeight, labelFont, letterSpacing
- loadPhotoBuffer(url, w, h, accentHex) — handles URL/local/fallback gradient
- buildOverlaySvg({ width, height, celebrationType, firstName, subLabel, accentHex, fontStyle })
  - Loads font base64 via fontLoader, embeds in SVG @font-face
  - Layers: vignette gradient, short accent bar, eyebrow text (caps, wide tracking), large first name, optional sub-label, #MostlyPostly watermark bottom-left
- buildLogoLayer(salonLogoPath, canvasW, canvasH) — bottom-right, 110px wide, 70% opacity via SVG blend
- renderImage({ photoBuffer, svgOverlay, logoLayer }) — sharp composite
- Main export: generateCelebrationImage({ profilePhotoUrl, salonLogoPath, firstName, lastName, celebrationType, anniversaryYears, salonName, accentColor, fontStyle })
  Returns: { feedUrl, storyUrl }
  Generates BOTH 1080x1080 (feed) and 1080x1920 (story) in parallel.

Smoke test all 3 font styles. Commit.

---

### Task 4: Caption generator (src/core/celebrationCaption.js)

GPT-4o-mini prompt: "Write a short warm social media caption for [firstName]'s [birthday/N-year work anniversary] at [salonName]. Tone: [tone]. Under 3 sentences. End with #MostlyPostly. No other hashtags."

Fallback templates:
- Birthday: "Happy Birthday [Name]! We're so lucky to have you. — [Salon] #MostlyPostly"
- Anniversary: "Happy Work Anniversary [Name]! [N] incredible years. — [Salon] #MostlyPostly"

Export: generateCelebrationCaption({ firstName, salonName, tone, celebrationType, anniversaryYears }) => Promise<string>

---

### Task 5: Celebration Post Style card — Admin Branding tab

In src/routes/admin.js:

1. Parse celebration_font_styles at top of GET handler:
   const celebStyles = JSON.parse(salonRow.celebration_font_styles || '["script"]')

2. Add card HTML inside admin-panel-branding after brand palette section:
   - Title: "Celebration Post Style"
   - Three checkboxes: script/editorial/playful with names and descriptions
   - Submit button → POST /manager/admin/celebration-styles

3. Add POST route:
   - Validate: at least 1 style required, filter to known keys
   - UPDATE salons SET celebration_font_styles = ? WHERE slug = ?
   - Redirect to /manager/admin#branding

---

### Task 6: Team page completeness nudge

In src/routes/stylistManager.js GET handler:

Query:
  SELECT COUNT(*) AS n FROM stylists
  WHERE salon_id = ? AND celebrations_enabled = 1
    AND (birthday_mmdd IS NULL OR hire_date IS NULL)

If n > 0, show yellow banner at top of page:
  "[N] team members are missing a birthday or hire date — add them to enable celebration posts."

---

### Task 7: Daily celebration detection (src/core/celebrationScheduler.js + scheduler.js)

New file: src/core/celebrationScheduler.js

runCelebrationCheck() — called from scheduler tick:

1. Fetch all salons with FB or IG tokens
2. For each salon:
   a. Check if current salon-local hour === 6 (6am window)
   b. Check duplicate guard: any celebration post created today? Skip if yes.
   c. Get today's MM-DD in salon timezone
   d. Query birthday stylists: birthday_mmdd = today, celebrations_enabled = 1
   e. Query anniversary stylists: strftime('%m-%d', hire_date) = today, celebrations_enabled = 1
   f. For each stylist found:
      - Pick fontStyle via celebration_font_index cycle
      - generateCelebrationImage() => { feedUrl, storyUrl }
      - generateCelebrationCaption()
      - Insert TWO posts rows (celebration + celebration_story), both manager_approved
      - Send manager SMS notification
   g. Increment celebration_font_index by number of posts created

Wire into scheduler.js:
- import { runCelebrationCheck } from "./core/celebrationScheduler.js"
- Call runCelebrationCheck().catch(...) as fire-and-forget at top of each tick
- Add "celebration_story" to isStoryOnly() and DEFAULT_PRIORITY (after "celebration")

---

### Task 8: FEATURES.md + CLAUDE.md updates

- FEAT-008 status: idea → done
- CLAUDE.md: add celebrationImageGen, celebrationCaption, celebrationScheduler, fontLoader to Core Logic table
- Note new salon columns: celebration_font_styles, celebration_font_index
- Note #MostlyPostly global convention for AI captions

---

### Task 9: Deploy to production

```bash
git checkout main && git merge dev && git push origin main && git checkout dev
```

Monitor logs for migration [033] and no startup errors.
