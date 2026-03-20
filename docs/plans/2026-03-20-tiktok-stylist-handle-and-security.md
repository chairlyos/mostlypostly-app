# TikTok Stylist Handle + Security Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add `tiktok_handle` to stylist profiles so TikTok posts credit stylists with `@handle`, and patch the `socket.io-parser` high-severity vulnerability.

**Architecture:** Migration adds DB column → stylist edit form exposes the field → `composeFinalCaption` gets a `tiktok` platform branch → scheduler looks up stylist handle and passes it when building TikTok caption. Security fix is a single `npm install` + commit.

**Tech Stack:** Node.js / Express / ESM, `better-sqlite3`, `composeFinalCaption.js`, `src/scheduler.js`, `src/routes/stylistManager.js`

---

## Plan A — TikTok Stylist Handle

### Task A-1: Migration 052 — add `tiktok_handle` to stylists

**Files:**
- Create: `migrations/052_stylist_tiktok_handle.js`

**Step 1: Create the migration file**

```js
// migrations/052_stylist_tiktok_handle.js
export function run(db) {
  const cols = db.prepare(`PRAGMA table_info(stylists)`).all().map(c => c.name);
  if (!cols.includes('tiktok_handle')) {
    db.prepare(`ALTER TABLE stylists ADD COLUMN tiktok_handle TEXT`).run();
  }
  console.log('[Migration 052] stylists: added tiktok_handle TEXT');
}
```

**Step 2: Verify the migration index picks it up automatically**

Open `migrations/index.js` and confirm it imports all numbered files dynamically (no manual registration needed). If it requires explicit import, add `import { run as m052 } from './052_stylist_tiktok_handle.js'` and call `m052(db)` in the run sequence.

**Step 3: Run migrations locally and verify**

```bash
node -e "import('./migrations/index.js').then(m => m.runMigrations())"
```

Then confirm the column exists:

```bash
node -e "import('./db.js').then(({default:db}) => console.log(db.prepare('PRAGMA table_info(stylists)').all().map(c=>c.name)))"
```

Expected: output includes `tiktok_handle`.

**Step 4: Commit**

```bash
git add migrations/052_stylist_tiktok_handle.js
git commit -m "feat(db): migration 052 — add tiktok_handle to stylists"
```

---

### Task A-2: Stylist edit form — add TikTok Handle input

**Files:**
- Modify: `src/routes/stylistManager.js`

Three changes in this file.

**Step 1: Add `tiktok_handle` to the POST destructure (line ~561)**

Find:
```js
const { first_name, last_name, phone, instagram_handle, tone_variant,
        birthday_mmdd, hire_date, bio, profile_url, celebrations_enabled,
        auto_approve, ig_collab } = req.body;
```

Replace with:
```js
const { first_name, last_name, phone, instagram_handle, tiktok_handle, tone_variant,
        birthday_mmdd, hire_date, bio, profile_url, celebrations_enabled,
        auto_approve, ig_collab } = req.body;
```

**Step 2: Add `tiktok_handle` to the UPDATE query (line ~577)**

Find:
```js
  db.prepare(`
    UPDATE stylists SET
      name = ?, first_name = ?, last_name = ?, phone = ?,
      instagram_handle = ?, tone_variant = ?,
      birthday_mmdd = ?, hire_date = ?,
      specialties = ?, bio = ?, profile_url = ?,
      photo_url = ?, celebrations_enabled = ?, auto_approve = ?,
      ig_collab = ?
    WHERE id = ? AND salon_id = ?
  `).run(
    name, first_name || null, last_name || null, normalizePhone(phone),
    instagram_handle || null, tone_variant || null,
```

Replace with:
```js
  db.prepare(`
    UPDATE stylists SET
      name = ?, first_name = ?, last_name = ?, phone = ?,
      instagram_handle = ?, tiktok_handle = ?, tone_variant = ?,
      birthday_mmdd = ?, hire_date = ?,
      specialties = ?, bio = ?, profile_url = ?,
      photo_url = ?, celebrations_enabled = ?, auto_approve = ?,
      ig_collab = ?
    WHERE id = ? AND salon_id = ?
  `).run(
    name, first_name || null, last_name || null, normalizePhone(phone),
    instagram_handle || null,
    tiktok_handle ? tiktok_handle.replace(/^@+/, '').trim() || null : null,
    tone_variant || null,
```

**Step 3: Add TikTok Handle field to `buildStylistForm` (line ~955)**

Find:
```js
        ${fieldRow("Instagram Handle", "instagram_handle", "text", s.instagram_handle || "", "Without @")}
```

Add after it:
```js
        ${fieldRow("TikTok Handle", "tiktok_handle", "text", s.tiktok_handle || "", "Without @")}
```

**Step 4: Manual test**

1. Open the edit stylist page for any stylist
2. Enter a TikTok handle (with and without leading `@` — confirm both save correctly without `@`)
3. Reload the form — verify the handle is pre-populated

**Step 5: Commit**

```bash
git add src/routes/stylistManager.js
git commit -m "feat(team): add TikTok handle field to stylist edit form"
```

---

### Task A-3: `composeFinalCaption` — add TikTok platform branch

**Files:**
- Modify: `src/core/composeFinalCaption.js:49-64` (function signature) and `:90-112` (Styled By section)

**Step 1: Add `tiktokHandle` param to the function signature (line ~49)**

Find:
```js
export function composeFinalCaption({
  caption,
  hashtags = [],
  cta,
  instagramHandle,
  stylistName,
  bookingUrl,
  salon,
  platform = "generic",
  asHtml = false,
  salonId = null,
  postId = null,
  postType = null,
  stylistSlug = null,
  noBookingCta = false,
  }) {
```

Replace with:
```js
export function composeFinalCaption({
  caption,
  hashtags = [],
  cta,
  instagramHandle,
  tiktokHandle,
  stylistName,
  bookingUrl,
  salon,
  platform = "generic",
  asHtml = false,
  salonId = null,
  postId = null,
  postType = null,
  stylistSlug = null,
  noBookingCta = false,
  }) {
```

**Step 2: Add TikTok branch to the Styled By section (line ~90)**

Find:
```js
  // --- 2️⃣ "Styled By:" credit ---
  // FB: full name; IG: @handle; fallback: name or generic
  let credit = creditName ? `Styled By: ${creditName}` : "Styled By: Team Member";

  if (platform === "instagram") {
    // IG → @handle if available, else full name
    if (handle) {
      credit = `Styled By: @${handle}`;
    } else if (creditName) {
      credit = `Styled By: ${creditName}`;
    }
  } else {
```

Replace with:
```js
  // --- 2️⃣ "Styled By:" credit ---
  // TikTok: @tiktok_handle if set, else name; IG: @ig_handle if set, else name; FB: full name
  let credit = creditName ? `Styled By: ${creditName}` : "Styled By: Team Member";

  const ttHandle = ((tiktokHandle || "") + "").replace(/^@+/, "").trim();

  if (platform === "tiktok") {
    if (ttHandle) {
      credit = `Styled By: @${ttHandle}`;
    } else if (creditName) {
      credit = `Styled By: ${creditName}`;
    }
  } else if (platform === "instagram") {
    // IG → @handle if available, else full name
    if (handle) {
      credit = `Styled By: @${handle}`;
    } else if (creditName) {
      credit = `Styled By: ${creditName}`;
    }
  } else {
```

**Step 3: Verify non-TikTok caption output unchanged**

Run a quick node eval to confirm Instagram and Facebook paths still work:

```bash
node -e "
import('./src/core/composeFinalCaption.js').then(({composeFinalCaption}) => {
  const base = { caption: 'Test', stylistName: 'Jane', instagramHandle: 'jane', hashtags: [], salon: {} };
  console.log('FB:', composeFinalCaption({...base, platform:'facebook'}));
  console.log('IG:', composeFinalCaption({...base, platform:'instagram'}));
  console.log('TT with handle:', composeFinalCaption({...base, platform:'tiktok', tiktokHandle:'janecuts'}));
  console.log('TT no handle:', composeFinalCaption({...base, platform:'tiktok'}));
});
"
```

Expected:
- FB → `Styled By: Jane`
- IG → `Styled By: @jane`
- TT with handle → `Styled By: @janecuts`
- TT no handle → `Styled By: Jane`

**Step 4: Commit**

```bash
git add src/core/composeFinalCaption.js
git commit -m "feat(caption): add tiktok platform branch — Styled By: @tiktok_handle"
```

---

### Task A-4: Scheduler — build TikTok caption with stylist handle

**Files:**
- Modify: `src/scheduler.js:642-668` (TikTok publish block)

**Step 1: Find the TikTok caption block (line ~651)**

Find:
```js
          if (tiktokEligible && tiktokPostedToday < tiktokDailyCap) {
            try {
              // TikTok doesn't render clickable links — strip the "Book:" line
              const tiktokCaption = fbCaption
                .replace(/\n\nBook: https?:\/\/\S+/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
```

Replace with:
```js
          if (tiktokEligible && tiktokPostedToday < tiktokDailyCap) {
            try {
              // Build a dedicated TikTok caption: @tiktok_handle credit, no booking URL
              const tiktokStylist = post.stylist_id
                ? db.prepare('SELECT tiktok_handle, name FROM stylists WHERE id = ?').get(post.stylist_id)
                : null;
              const tiktokCaption = composeFinalCaption({
                caption:      post.base_caption || post.final_caption || "",
                hashtags:     (() => { try { return JSON.parse(post.hashtags || "[]"); } catch { return []; } })(),
                stylistName:  post.stylist_name || "",
                tiktokHandle: tiktokStylist?.tiktok_handle || "",
                salon,
                platform:     "tiktok",
                noBookingCta: true,
              }).trim();
```

**Step 2: Verify `composeFinalCaption` is imported in scheduler**

Check the top of `src/scheduler.js` for:
```js
import { composeFinalCaption } from "./core/composeFinalCaption.js";
```

If not present, add it with the other imports at the top of the file.

**Step 3: Manual integration test (staging)**

Deploy to staging. Create or reuse a TikTok-connected salon. Set a `tiktok_handle` on a test stylist. Force-publish a post and check the TikTok caption in logs (`[TikTok] Photo post published...`). Confirm "Styled By: @handle" appears.

**Step 4: Commit**

```bash
git add src/scheduler.js
git commit -m "feat(tiktok): build dedicated TikTok caption with stylist @handle"
```

---

## Plan B — Dependabot Security Fix

### Task B-1: Upgrade socket.io

**Files:**
- Modify: `package.json`, `package-lock.json` (auto-updated by npm)

**Step 1: Install latest socket.io**

```bash
npm install socket.io@latest
```

**Step 2: Verify socket.io-parser is patched**

```bash
npm list socket.io-parser
```

Expected: `socket.io-parser@4.2.6` or higher (not `4.2.4`).

**Step 3: Verify audit is clean**

```bash
npm audit
```

Expected: 0 high or critical vulnerabilities.

**Step 4: Smoke test**

Start the app locally and confirm socket connections still work (admin panel live refresh, if used).

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): upgrade socket.io to patch socket.io-parser CVE GHSA-677m-j7p3-52f9"
```

---

## Acceptance Criteria

### Plan A
- [ ] `stylists.tiktok_handle` column exists after migration 052 runs
- [ ] Stylist edit form shows TikTok Handle input; saves without leading `@`
- [ ] TikTok post for a stylist with a handle → `Styled By: @handle` in caption
- [ ] TikTok post for a stylist without a handle → `Styled By: Name` in caption
- [ ] Facebook and Instagram caption behavior unchanged

### Plan B
- [ ] `npm list socket.io-parser` shows `>=4.2.6`
- [ ] `npm audit` reports 0 high/critical vulnerabilities
- [ ] No socket.io regressions on staging
