# Birthday & Anniversary Posts — Design Document
_2026-03-15_

## Overview

Automatically generate branded celebration posts for stylist birthdays and work anniversaries. Posts publish to both the feed (1080×1080) and as a story/reel (1080×1920) on the day of the milestone. No manager action required — posts auto-approve with an SMS notification.

---

## Image Design

### Two formats per celebration
- **Square 1080×1080** — standard feed post (Facebook + Instagram)
- **Vertical 1080×1920** — story/reel (Instagram)

### Composition layers (bottom to top)
1. Stylist profile photo — fills full canvas, object-fit cover. Fallback: dark gradient using `brand_palette.primary`
2. Dark radial vignette — ensures text readability over any photo
3. Thin horizontal accent bar — above text block, `brand_palette.cta` color
4. Text block (lower 40%):
   - Eyebrow: `HAPPY BIRTHDAY` or `HAPPY WORK ANNIVERSARY` (caps, wide tracking, small)
   - Headline: `[First Name]` in selected font style (large, styled)
   - Anniversary only: milestone line `"5 Years · [Salon Name]"`
5. Salon logo watermark — bottom-right, ~120px wide, white-tinted 70% opacity
6. MostlyPostly watermark — bottom-left, `#MostlyPostly` in small light gray text

### Font styles
Three options, stored as checkboxes per salon. If multiple selected, cycle through them.

| Key | Name | Headline Font | Label Font |
|-----|------|--------------|------------|
| `script` | Script + Elegant | Great Vibes | Light serif |
| `editorial` | Modern Editorial | Montserrat Bold | Tight tracking sans |
| `playful` | Warm & Playful | Pacifico | Rounded sans |

---

## Font Style Settings (Admin → Branding Tab)

New **Celebration Post Style** card in Admin → Branding tab.

- Three checkboxes — salon selects 1, 2, or all 3
- If multiple selected: cycle through on each post
- Minimum 1 must be selected (validation)

### New DB columns (migration 033)
```sql
ALTER TABLE salons ADD COLUMN celebration_font_styles TEXT DEFAULT '["script"]';
ALTER TABLE salons ADD COLUMN celebration_font_index INTEGER DEFAULT 0;
```

### Cycle logic
```js
const styles = JSON.parse(salon.celebration_font_styles); // e.g. ["script", "editorial"]
const fontStyle = styles[salon.celebration_font_index % styles.length];
// After generating: UPDATE salons SET celebration_font_index = celebration_font_index + 1
```

---

## Team Page Completeness Nudge

Dismissible yellow banner on `/manager/stylists`:
> "3 team members are missing birthday or anniversary dates. Add them to enable celebration posts →"

Query: stylists where `celebrations_enabled = 1` AND (`birthday_mmdd IS NULL` OR `hire_date IS NULL`)

---

## Caption Generation

**Primary:** GPT-4o-mini prompt with stylist name, salon name, salon tone of voice, celebration type, anniversary years.

**Fallback templates:**
- Birthday: `"Happy Birthday [Name]! 🎂 We're so lucky to have you on our team. — [Salon Name] #MostlyPostly"`
- Anniversary: `"Happy Work Anniversary [Name]! 🎉 [X] years of amazing work. — [Salon Name] #MostlyPostly"`

`#MostlyPostly` always appended to all captions.

---

## Daily Detection Job

### Trigger
Runs inside the existing scheduler interval. Checks once per salon per day during the **6:00–6:59am window** in salon local time.

### Detection queries
```js
// Birthday
WHERE birthday_mmdd = 'MM-DD' // today in salon timezone
  AND celebrations_enabled = 1

// Anniversary
WHERE strftime('%m-%d', hire_date) = 'MM-DD' // today in salon timezone
  AND hire_date IS NOT NULL
  AND celebrations_enabled = 1
```

### Duplicate guard
Before generating: check if a `celebration` post already exists for this stylist today. Skip if yes.

### Publishing pipeline
1. `generateCelebrationImage()` → `{ feedUrl, storyUrl }`
2. Pick font style via `celebration_font_index` cycle
3. Generate caption (AI with fallback)
4. Insert two `posts` rows: `standard_post` (feedUrl) + `story` (storyUrl)
5. Both inserted as `status = 'manager_approved'` (skip approval queue)
6. Increment `salon.celebration_font_index`
7. Send manager SMS: `"🎂 Birthday post for [Name] queued for today. Tap to review: [link]"`

---

## Implementation Tasks

| Task ID | Description |
|---------|-------------|
| #3 | Build `buildCelebrationImage.js` — dual-format image generator |
| #4 | Add font style checkboxes to Admin → Branding + migration 033 + Team page nudge |
| #5 | Daily detection job + caption generation + publishing pipeline |

---

## Global Convention: #MostlyPostly

All AI-generated captions system-wide should append `#MostlyPostly`. This applies to celebration posts and should be adopted for promotion, availability, and standard post captions going forward.
