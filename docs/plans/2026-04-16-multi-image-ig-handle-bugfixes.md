# Multi-Image APPROVE Redirect + IG Handle Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Fix two bugs: (1) SMS APPROVE on multi-image drafts now redirects to the portal instead of publishing 1 image; (2) Facebook captions show `@handle` instead of a full IG URL, and portal-submitted captions pass `instagramHandle` to caption builders.

**Architecture:** Two independent changes in three files. Bug 1 is a guard clause added to the APPROVE handler in `messageRouter.js`. Bug 2 is a one-line change to `insertIGUnderStyledBy` in `messageRouter.js` plus adding `instagramHandle` to two `composeFinalCaption` calls in `videoUpload.js`.

**Tech Stack:** Node.js, Express, ESM, better-sqlite3

---

### Task 1: Fix `insertIGUnderStyledBy` to output `@handle` instead of full URL

**Files:**
- Modify: `src/core/messageRouter.js` (~line 204)

**Context:**
`insertIGUnderStyledBy` is called inside `buildFacebookCaption` and inserts a line under "Styled By:" in every Facebook caption. Currently produces `IG: https://instagram.com/handle`. Goal is `@handle` instead — cleaner and matches how creators tag on social.

**Step 1: Make the change**

In `messageRouter.js`, find the `insertIGUnderStyledBy` function. Change line 204:

```js
// BEFORE
const igLine = `IG: https://instagram.com/${rawHandle}`;

// AFTER
const igLine = `@${rawHandle}`;
```

Also update line 208 which guards against double-insertion — it checks for the old format:

```js
// BEFORE
if (lines[idx + 1] && lines[idx + 1].trim() === igLine) return caption;

// AFTER (no change needed — igLine is already the new value at this point)
```

Also update `removeIGUrlLine` (~line 233) which strips this line from IG captions. It currently matches `^IG:\s` — update to also match bare `@handle` lines that appear right after a "Styled By:" line, otherwise the @handle will leak into IG captions:

```js
// BEFORE
function removeIGUrlLine(caption) {
  const lines = String(caption || "").split("\n").filter((l) => !/^IG:\s/.test(l.trim()));
  return lines.join("\n");
}

// AFTER
function removeIGUrlLine(caption) {
  const lines = String(caption || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Remove old "IG: https://..." format
    if (/^IG:\s/i.test(l.trim())) continue;
    // Remove bare "@handle" line that sits directly after a "Styled By:" line
    if (i > 0 && /^Styled [Bb]y[:]?\s/i.test(lines[i - 1].trim()) && /^@\w+$/.test(l.trim())) continue;
    out.push(l);
  }
  return out.join("\n");
}
```

**Step 2: Manual test**

Temporarily add a console.log after `buildFacebookCaption` in the APPROVE path to verify the output format:
```js
console.log('[TEST] FB caption sample:', fbCaption.slice(0, 200));
```
Remove after confirming output contains `@vincentgingerich` style (not `IG: https://...`).

**Step 3: Commit**

```bash
git add src/core/messageRouter.js
git commit -m "fix: replace full IG URL with @handle in Facebook captions"
```

---

### Task 2: Pass `instagramHandle` in `videoUpload.js` caption calls

**Files:**
- Modify: `src/routes/videoUpload.js` (~lines 172, 281)

**Context:**
Two calls to `composeFinalCaption` in this file are missing `instagramHandle`. The stylist object is available in both call sites — `stylist.instagram_handle` is the field to use. The `/regen` route has the `post` DB row (not the stylist object), so it needs a quick DB lookup first.

**Step 1: Fix the initial upload call (~line 281)**

Find the `composeFinalCaption` call inside the `POST /:token` handler. Add `instagramHandle`:

```js
// BEFORE
caption = composeFinalCaption({
  caption: aiJson?.caption || "",
  hashtags: aiJson?.hashtags || [],
  stylistName: stylist.name || "",
  salon: fullSalon,
  platform: "instagram",
});

// AFTER
caption = composeFinalCaption({
  caption: aiJson?.caption || "",
  hashtags: aiJson?.hashtags || [],
  stylistName: stylist.name || "",
  instagramHandle: stylist.instagram_handle || "",
  salon: fullSalon,
  platform: "instagram",
});
```

**Step 2: Fix the regen call (~line 172)**

The `/regen` route has `post` (the DB row) and `stylist` loaded from the token's stylist_id. Confirm `stylist` is in scope at this point by checking the top of the route handler. If `stylist` is available, add:

```js
// BEFORE
const caption = composeFinalCaption({
  caption: aiJson?.caption || "",
  hashtags: aiJson?.hashtags || [],
  stylistName: post.stylist_name || "",
  salon: fullSalon,
  platform: "instagram",
});

// AFTER
const caption = composeFinalCaption({
  caption: aiJson?.caption || "",
  hashtags: aiJson?.hashtags || [],
  stylistName: post.stylist_name || "",
  instagramHandle: stylist?.instagram_handle || "",
  salon: fullSalon,
  platform: "instagram",
});
```

If `stylist` is NOT in scope at the regen route, add a DB lookup before the call:
```js
const stylistRow = db.prepare(
  "SELECT instagram_handle FROM stylists WHERE name = ? AND salon_id = ? LIMIT 1"
).get(post.stylist_name, post.salon_id);
// then use: instagramHandle: stylistRow?.instagram_handle || ""
```

**Step 3: Commit**

```bash
git add src/routes/videoUpload.js
git commit -m "fix: pass instagramHandle to composeFinalCaption in video upload portal"
```

---

### Task 3: Redirect SMS APPROVE to portal for multi-image drafts

**Files:**
- Modify: `src/core/messageRouter.js` (~line 1443, after draft is loaded)

**Context:**
The APPROVE handler loads the draft (from memory or DB). At that point `draft.image_urls` is an array of all images. If it has more than 1 image, we redirect to the portal instead of publishing. The portal token for the post was already created when the draft was saved (`stylist_portal_tokens` table). We look it up by `post_id` (`draft._db_id`). If no token exists (server restart edge case), generate a fresh one.

**Step 1: Add the multi-image guard after draft is loaded**

Find the line (~1447): `let imageUrl = draft?.image_url || null;`

Insert the guard block immediately after the draft is confirmed non-null (after the `if (!draft)` block at ~1451):

```js
// Multi-image guard: redirect to portal instead of publishing directly
if ((draft?.image_urls?.length ?? 0) > 1) {
  const postId = draft._db_id;
  let portalUrl = null;

  if (postId) {
    // Try to reuse an existing unexpired portal token
    const existingToken = db.prepare(
      `SELECT token FROM stylist_portal_tokens
       WHERE post_id = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       ORDER BY rowid DESC LIMIT 1`
    ).get(postId);

    if (existingToken) {
      const baseUrl = process.env.PUBLIC_BASE_URL || "";
      portalUrl = `${baseUrl}/stylist/${postId}?token=${existingToken.token}`;
    } else {
      // Generate fresh token (server restart edge case)
      const freshToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        "INSERT INTO stylist_portal_tokens (id, post_id, token, expires_at) VALUES (?, ?, ?, ?)"
      ).run(crypto.randomUUID(), postId, freshToken, expiresAt);
      const baseUrl = process.env.PUBLIC_BASE_URL || "";
      portalUrl = `${baseUrl}/stylist/${postId}?token=${freshToken}`;
    }
  }

  const msg = portalUrl
    ? `You sent ${draft.image_urls.length} photos — tap here to review and confirm before posting:\n${portalUrl}`
    : `You sent ${draft.image_urls.length} photos — please use your preview link to review and submit.`;

  await sendMessage.sendText(chatId, msg);
  endTimer(start);
  return;
}
```

**Step 2: Verify single-image path is unaffected**

Read through the APPROVE path below the guard and confirm it still reaches `publishToFacebook` for single-image drafts. No other changes needed.

**Step 3: Commit**

```bash
git add src/core/messageRouter.js
git commit -m "fix: redirect SMS APPROVE to portal when draft has multiple images"
```

---

### Task 4: Manual end-to-end verification

**Checklist:**

- [ ] **Multi-image redirect**: Send 2 photos via SMS as a test stylist. Confirm you receive a portal link redirect instead of an auto-publish. Open the link and verify both images appear. Submit via portal → manager_pending.
- [ ] **Single-image unaffected**: Send 1 photo, text APPROVE. Confirm it still publishes directly (if salon has `require_manager_approval = 0`) or routes to manager_pending (if `= 1`).
- [ ] **Facebook @handle**: Approve a post via SMS (single image). Check the published Facebook post — "Styled By:" should be followed by `@handle` on the next line, not `IG: https://instagram.com/handle`.
- [ ] **Portal IG caption**: Upload a reel via the video portal. Check the generated caption — "Styled By:" should show `@handle` (if stylist has instagram_handle set) not just the full name.
- [ ] **IG caption clean**: Confirm the IG publish from the portal does NOT include the `@handle` line or any URL in the caption (removeIGUrlLine strips it).

**Step 1: Commit any remaining cleanup**

```bash
git add -p
git commit -m "fix: remove debug console.log from Task 1"
```

**Step 2: Deploy to staging and run through checklist above**
