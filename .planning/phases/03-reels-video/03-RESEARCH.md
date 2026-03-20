# Phase 3: Reels & Video - Research

**Researched:** 2026-03-20
**Domain:** Instagram Reels API, Facebook Reels API, Twilio video MMS, local video file storage, Express static serving
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stylist Video SMS Flow**
- Prompt after video received: `"Got your video! What service is this? Give me a quick description and I'll write your caption."` — same casual tone as the rest of the app
- If stylist doesn't reply within 30 minutes: auto-timeout and generate a generic caption from salon tone alone
- Caption preview wording: `"Here's your Reel caption:"` instead of `"Here's your caption:"` — minor wording change only
- APPROVE, EDIT, REDO all work identically to photo posts — no special cases in messageRouter.js draft handling

**Video File Storage & Public URL**
- Download Twilio video with auth → save to `data/uploads/videos/` — no S3
- Rename to UUID + `.mp4` extension on download
- Serve via `express.static('data/uploads/videos')` mounted at `/uploads/videos/`
- Public video URL constructed using `PUBLIC_BASE_URL` env var
- Store video URL in existing `image_url` column on posts table — no schema change

**Instagram Reels API**
- Three-step: create container (type=REELS) → poll status → publish
- Poll inside the scheduler tick: 3s intervals × 40 attempts = 2 min max timeout
- After 2 min without `FINISHED` status: mark post as failed, surface via existing error flow
- IG and FB publish independently — one failure does not block the other

**Facebook Reels API**
- Use dedicated FB Reels endpoint (`POST /{page_id}/video_reels`) — no fallback to standard video post
- If FB Reels fails: surface error via existing error flow, no silent fallback

**TikTok Stub**
- Create `src/publishers/tiktok.js` with exported `publishReel()` that throws `'TikTok publishing not yet available'`
- Add a greyed-out TikTok card on `/manager/integrations` with "Coming soon — pending approval" text

**Analytics & Leaderboard**
- Add `reel: 20` to `DEFAULT_POINTS` in `src/core/gamification.js`
- `pickNextPost()` already handles `reel` type — do not change
- `postTypeLabel()` and analytics queries need `reel` handled

### Claude's Discretion

- Exact `data/uploads/videos/` directory creation and file path construction
- How `data/` is declared as Express static root (may need to create route)
- Twilio video download implementation (fetch with Basic auth vs using twilio-node SDK)
- IG container creation request body shape and API version
- FB Reels API endpoint exact path (research needed — Graph API v22.0)
- Migration number (next after current highest — check migrations/ directory)
- Whether `gamification_settings` table needs a new `pts_reel` column or if the `DEFAULT_POINTS` fallback in `getPointValue()` is sufficient

### Deferred Ideas (OUT OF SCOPE)

- ffmpeg frame extraction for video captions (Phase 2 of Reels)
- TikTok full publish flow — pending TikTok Developer app approval
- Video trimming or compression before upload
- Video thumbnail customization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REEL-01 | messageRouter.js detects video/* content type from Twilio MMS and branches to video flow | Twilio webhook already has `MediaContentType0` — branch on `content-type.startsWith('video/')` before existing photo branch |
| REEL-02 | System downloads Twilio video file (auth required) and saves to data/uploads/videos/ | Node.js `fetch` with Basic auth headers; uuid + `.mp4` pattern; `fs.mkdir` recursive; `UPLOADS_DIR` env var pattern from uploadPath.js |
| REEL-03 | System sends SMS prompt to stylist asking for service description to inform caption | `sendViaTwilio` already exists; in-memory `pendingVideoDescriptions` Map keyed by chatId |
| REEL-04 | System generates Reel caption from stylist's SMS answer + salon tone via GPT-4o | Existing `generateCaption()` call with `postType='reel'`; 30-min timeout fallback to generic caption from salon tone |
| REEL-05 | Post is created in DB with post_type=reel and enters standard approval queue | `savePost()` with `post_type='reel'`; `image_url` stores local video URL; standard status flow unchanged |
| REEL-06 | Instagram Reels publisher handles container creation, status polling, and publish (three-step API) | IG API: `POST /{ig_user_id}/media` with `media_type=REELS`, `video_url=<public url>`; poll `status_code`; then `POST /{ig_user_id}/media_publish`; same `waitForContainer` + `publishContainer` pattern as photos |
| REEL-07 | Facebook Reels publisher handles upload + publish independently from Instagram | FB API: `POST /{page_id}/video_reels` with `upload_phase=start` → upload to `rupload.facebook.com` OR pass `file_url` → `POST /{page_id}/video_reels` with `upload_phase=finish`, `video_state=PUBLISHED` |
| REEL-08 | Reel post failures integrate with existing FEAT-033 error flow | Add Reel-specific error strings to `postErrorTranslator.js`; scheduler `MAX_RETRIES` path unchanged |
| REEL-09 | Analytics and leaderboard track reel post_type (20 pts vs 10 for standard) | Add `reel: 20` to `DEFAULT_POINTS`; `getPointValue()` fallback handles it without DB migration; `postTypeLabel()` already maps `reel` → "Reel" |
| REEL-10 | TikTok Developer app submitted in parallel; tiktok.js publisher stub created | Stub file only: `export async function publishReel() { throw new Error('TikTok publishing not yet available'); }` |
</phase_requirements>

## Summary

Phase 3 adds video/Reel publishing to MostlyPostly. A stylist texts a video MMS → system downloads it locally → prompts for a service description → generates a Reel caption → routes through the existing approval flow → scheduler publishes to Instagram Reels and Facebook Reels independently.

The codebase already has the required infrastructure. The Twilio webhook already captures `MediaContentType0` and `MediaUrl0`. The `instagram.js` publisher already implements the create-container → poll-status → publish three-step pattern for photos, and Reels use the same pattern with `media_type=REELS`. The `facebook.js` publisher handles photos; a new `publishFacebookReel()` function uses the dedicated `/{page_id}/video_reels` endpoint (different from photo posts). The scheduler already handles independent FB/IG publish with separate error capture.

The biggest implementation risk is the 30-minute video description timeout in messageRouter — an in-memory Map with `setTimeout` is sufficient and consistent with how `consentSessions` and `noAvailabilityRecent` are already handled. The second risk is the FB Reels upload step: unlike IG (which takes a `video_url`), FB Reels requires either a binary upload to `rupload.facebook.com` or a hosted `file_url`. Since the video is already served publicly at `PUBLIC_BASE_URL/uploads/videos/{uuid}.mp4`, use the `file_url` path — no binary streaming needed.

**Primary recommendation:** Use `file_url` for FB Reels upload (simplest path given locally-served video), use existing `waitForContainer` pattern for IG Reels polling, add `reel: 20` to `DEFAULT_POINTS` without a DB migration (the fallback in `getPointValue()` is sufficient). Next migration is 049.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-fetch | already installed | HTTP requests to Meta Graph API and Twilio | Used throughout publishers and core |
| better-sqlite3 | already installed | DB reads/writes (synchronous) | Project standard — never await DB |
| node:fs/promises | built-in | Download video to disk, mkdir | No new dependency needed |
| node:crypto | built-in | UUID for video filename (randomUUID) | Consistent with rest of codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| twilio (node SDK) | already installed | Twilio Basic auth credentials for video download | Use `process.env.TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` for Basic auth header |
| vitest | already installed | Unit tests | Already used for vendorHashtags, contentRecycler, etc. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` with Basic auth for video download | `twilio-node` SDK media download | SDK adds wrapper complexity; raw fetch with Authorization header is simpler and consistent with how `rehostTwilioMedia.js` already works |
| `file_url` for FB Reels (locked decision) | Binary upload to rupload.facebook.com | Binary streaming adds complexity, requires streaming chunks; since video is locally served with PUBLIC_BASE_URL the `file_url` param is simpler |

**Installation:**
No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure (new files only)
```
src/
├── publishers/
│   ├── instagram.js       # Add publishReelToInstagram() function
│   ├── facebook.js        # Add publishFacebookReel() function
│   └── tiktok.js          # NEW — stub only
├── core/
│   └── videoDownload.js   # NEW — download Twilio video to data/uploads/videos/
data/
└── uploads/
    └── videos/            # NEW directory (created at module load, like UPLOADS_DIR)
```

### Pattern 1: Twilio Video Detection in twilio.js
**What:** Check `MediaContentType0` for `video/` prefix before the existing photo branch
**When to use:** Any MMS with NumMedia > 0

The existing webhook already collects `imageUrls` from all `MediaUrl{i}` entries. A video MMS sends `MediaContentType0: video/mp4`. Detection is a single `startsWith('video/')` check on `req.body.MediaContentType0`.

```javascript
// Source: verified from twilio.js line 106-111 — existing MediaContentType0 pattern
const primaryContentType = req.body.MediaContentType0 || '';
const isVideo = primaryContentType.startsWith('video/');
// Pass isVideo flag to handleIncomingMessage alongside imageUrls
```

### Pattern 2: Video Download with Basic Auth
**What:** Fetch Twilio MMS video URL with HTTP Basic auth, save to disk as UUID.mp4
**When to use:** When `isVideo=true` in messageRouter

```javascript
// Source: verified — Twilio MMS URLs require Basic auth (ACCOUNT_SID:AUTH_TOKEN)
// Pattern consistent with rehostTwilioMedia.js approach
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import fetch from 'node-fetch';

const VIDEO_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR, 'videos')
  : path.resolve('data/uploads/videos');

await fs.mkdir(VIDEO_DIR, { recursive: true });

async function downloadTwilioVideo(twilioUrl) {
  const creds = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');
  const resp = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${creds}` }
  });
  if (!resp.ok) throw new Error(`Video download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const filename = `${randomUUID()}.mp4`;
  const filePath = path.join(VIDEO_DIR, filename);
  await fs.writeFile(filePath, buffer);
  const publicUrl = `${process.env.PUBLIC_BASE_URL}/uploads/videos/${filename}`;
  return { filePath, publicUrl };
}
```

### Pattern 3: Instagram Reels — Three-Step API
**What:** Create container with `media_type=REELS`, poll `status_code`, publish
**When to use:** When `post_type='reel'` in scheduler's publish path

The existing `waitForContainer()` and `publishContainer()` functions in `instagram.js` are reusable unchanged. Only the container creation differs (use `video_url` instead of `image_url`, set `media_type=REELS`).

```javascript
// Source: Instagram Graph API docs (verified 2026-03-20)
// POST /v24.0/{ig_user_id}/media
async function createIgReelContainer({ userId, videoUrl, caption, token, graphVer }) {
  const url = `https://graph.facebook.com/${graphVer}/${userId}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,   // public HTTPS URL — no Twilio URLs
    caption: caption || '',
    share_to_feed: 'true',
    access_token: token,
  });
  const resp = await fetch(url, { method: 'POST', body: params });
  const data = await resp.json();
  if (!resp.ok || !data?.id) {
    throw new Error(`IG Reel container create failed: ${resp.status} ${JSON.stringify(data)}`);
  }
  return data.id;
}
// Then: waitForContainer(creationId, token, graphVer) — reuse existing function
// Then: publishContainer(creationId, userId, token, graphVer) — reuse existing function
```

**Polling:** The existing `waitForContainer()` already polls `status_code` for `FINISHED` / `ERROR`. The context decision specifies 3s intervals × 40 attempts = 120s max. Current implementation uses `IG_MEDIA_POLL_INTERVAL_MS` (default 1500ms) and `IG_MEDIA_MAX_WAIT_MS` (default 30000ms). For reels, these env vars need to be increased — or pass explicit overrides: `pollIntervalMs=3000`, `maxWaitMs=120000`.

### Pattern 4: Facebook Reels — Two-Phase with file_url
**What:** Initialize upload session, pass `file_url` to rupload.facebook.com, then publish
**When to use:** When `post_type='reel'` in scheduler's publish path

```javascript
// Source: Facebook Reels Publishing API docs (verified 2026-03-20)
// Step 1: Initialize
async function initFbReelUpload({ pageId, token, graphVer }) {
  const resp = await fetch(
    `https://graph.facebook.com/${graphVer}/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_phase: 'start', access_token: token }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || !data.video_id) throw new Error(`FB Reel init failed: ${JSON.stringify(data)}`);
  return { videoId: data.video_id, uploadUrl: data.upload_url };
}

// Step 2: Upload via file_url (no binary streaming needed since video is publicly hosted)
async function uploadFbReelByUrl({ uploadUrl, videoPublicUrl, token }) {
  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_url: videoPublicUrl }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(`FB Reel upload failed: ${JSON.stringify(data)}`);
}

// Step 3: Publish
async function publishFbReel({ pageId, videoId, caption, token, graphVer }) {
  const resp = await fetch(
    `https://graph.facebook.com/${graphVer}/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption || '',
        access_token: token,
      }),
    }
  );
  const data = await resp.json();
  if (!data.success) throw new Error(`FB Reel publish failed: ${JSON.stringify(data)}`);
  return data;
}
```

### Pattern 5: Video Description Timeout (in-memory)
**What:** 30-minute timeout after sending the description prompt
**When to use:** After downloading video and sending the "Got your video!" SMS

```javascript
// Source: consistent with noAvailabilityRecent Map pattern in messageRouter.js
const pendingVideoDescriptions = new Map();
// Map<chatId, { videoPublicUrl, salonId, stylistId, expiresAt }>
const VIDEO_DESC_TTL_MS = 30 * 60 * 1000;

// On video received:
pendingVideoDescriptions.set(chatId, {
  videoPublicUrl,
  salonId,
  expiresAt: Date.now() + VIDEO_DESC_TTL_MS,
});

// On next text message from same chatId:
const pending = pendingVideoDescriptions.get(chatId);
if (pending && Date.now() < pending.expiresAt) {
  // Use text as service description → generate caption
  pendingVideoDescriptions.delete(chatId);
  // proceed to generateCaption with notes=text
}

// Cleanup: check expiresAt, generate generic caption on timeout
// (timeout check happens when any other message arrives from that chatId, or via periodic cleanup)
```

**Timeout behavior:** When the 30 minutes expire and no description was provided, generate caption with `notes=''` (same as a photo post with no text). This means the reel still enters the queue with a generic caption.

### Pattern 6: Scheduler Integration
**What:** Add reel branch to scheduler's publish section
**When to use:** `post.post_type === 'reel'` in `runSchedulerOnce()`

```javascript
// In scheduler.js publish section (lines ~499-528), add before the isMulti check:
if (postType === 'reel') {
  // FB Reels and IG Reels publish independently
  try {
    fbResp = await publishFacebookReel(salon, post.image_url, fbCaption);
  } catch (fbErr) {
    console.error(`[Scheduler] FB Reel failed for ${post.id}:`, fbErr.message);
    // fbResp stays null — IG still proceeds
  }
  try {
    igResp = await publishReelToInstagram({
      salon_id: salon.slug,
      videoUrl: post.image_url,
      caption: igCaption,
    });
  } catch (igErr) {
    // If both fail, the outer catch handles retry
    if (!fbResp) throw igErr; // re-throw only if both failed
    console.error(`[Scheduler] IG Reel failed for ${post.id}:`, igErr.message);
  }
}
```

### Pattern 7: Express Static for Videos
**What:** Serve `data/uploads/videos/` at `/uploads/videos/`
**When to use:** When app starts up

The existing `UPLOADS_DIR` pattern in `uploadPath.js` shows production uses `/data/uploads` (Render persistent disk). Videos go in a `videos/` subdirectory of that same root. Mount in `server.js` using `express.static`:

```javascript
// In server.js (check where other express.static mounts are)
import path from 'path';
const videoDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR, 'videos')
  : path.resolve('data/uploads/videos');
app.use('/uploads/videos', express.static(videoDir));
```

### Anti-Patterns to Avoid
- **Do not rehost Twilio video URLs via `rehostTwilioMedia.js`** — that utility is for images. Videos need the dedicated download + local storage path (REEL-02).
- **Do not pass a Twilio MMS URL as `video_url` to Instagram** — IG's servers cannot authenticate Twilio URLs. The video must be publicly accessible first.
- **Do not block the scheduler tick while waiting for IG container** — the current `waitForContainer()` uses async/await with `setTimeout` inside the scheduler's async loop, which is acceptable on Render's always-on instance.
- **Do not use `IG_MEDIA_MAX_WAIT_MS` default (30s) for reels** — reels need up to 120s. Pass explicit timeout values to the reel polling call, or increase the env var. Do NOT change the default for photos.
- **Do not check `if (postType === 'reel')` in the image-guard check** — the guard at line ~478 throws `"No image URL available"` but `image_url` on a reel post contains the video URL, so it will pass correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IG container status polling | Custom poll loop | Reuse `waitForContainer()` from instagram.js | Already handles `FINISHED`/`ERROR` states, configurable timeout |
| IG publish step | Custom POST | Reuse `publishContainer()` from instagram.js | Identical endpoint and response shape for reels |
| Salon credential lookup | Manual DB query | Reuse `resolveIgCredentials(salon_id)` from instagram.js | Already handles fallback to env vars |
| Post error translation | Custom error messages | Extend `postErrorTranslator.js` RULES array | Consistent with all other post types |
| File path + URL construction | Custom logic | Follow `uploadPath.js` pattern exactly | UPLOADS_DIR env var ensures Render persistent disk works correctly |
| UUID filename | Custom filename generation | `randomUUID()` from `node:crypto` | Already used in `savePost()`, `stylist_portal_tokens`, etc. |

**Key insight:** The three-step IG publish flow is already fully implemented for images (create → poll → publish). Reels use the same three calls at the same endpoints — only the creation parameters differ (`media_type=REELS`, `video_url` instead of `image_url`).

## Common Pitfalls

### Pitfall 1: IG Reel Container Poll Timeout Too Short
**What goes wrong:** Reels take 30-120 seconds to process on Instagram's servers. The existing photo polling timeout (`IG_MEDIA_MAX_WAIT_MS=30000`) will time out before the reel is ready, marking the post as failed.
**Why it happens:** The `waitForContainer()` function uses `IG_MEDIA_MAX_WAIT_MS` (env var, default 30s). Photos typically finish in 5-15s. Reels can take 60-120s.
**How to avoid:** Add explicit override params to the Reel poll call: `maxWaitMs=120000`, `pollIntervalMs=3000`. Do not change the env var default (that would slow down photo publishing).
**Warning signs:** Post fails with "Timed out waiting for IG container" within 30s of scheduler pick.

### Pitfall 2: FB Reels Requires `pages_manage_posts` Permission
**What goes wrong:** The `POST /{page_id}/video_reels` endpoint requires `pages_manage_posts` permission. Existing salons may have connected Facebook before this permission was required by the app.
**Why it happens:** The Facebook OAuth flow in `facebookAuth.js` may not include `pages_manage_posts` in the requested scope.
**How to avoid:** Check `src/routes/facebookAuth.js` to confirm `pages_manage_posts` is in the scope list. Add it if missing. Existing connected salons may need to re-authorize.
**Warning signs:** FB Reel publish returns `OAuthException` or `permissions` error.

### Pitfall 3: Video Not Yet Served When IG/FB Tries to Fetch It
**What goes wrong:** The scheduler picks up a reel post and passes the video URL to IG/FB before Express has had a chance to serve the file, or the URL is incorrect.
**Why it happens:** Race between file write and scheduler tick. Also possible: `PUBLIC_BASE_URL` env var missing trailing slash handling.
**How to avoid:** `videoDownload.js` awaits `fs.writeFile()` before returning the URL. The scheduler tick is async — by the time the post is enqueued and scheduled, the file is on disk. Verify `PUBLIC_BASE_URL` has no trailing slash (already handled by `toUploadUrl()` pattern: `base.replace(/\/$/, '')`).
**Warning signs:** IG/FB returns "unable to fetch video" or 404 on the video URL.

### Pitfall 4: In-Memory Video Description Map Leaks on Restart
**What goes wrong:** `pendingVideoDescriptions` Map is in-memory. If the server restarts between the stylist sending a video and sending their description, the Map is empty and the next text message from that stylist will not be recognized as a description reply.
**Why it happens:** Same issue exists with `consentSessions` and `noAvailabilityRecent` — it is accepted behavior in this codebase.
**How to avoid:** Handle the "no pending video" path gracefully: if the text doesn't match any other command and there is no pending video context, fall through to the normal text handler (which will prompt for a photo). Log a warning. Do not try to persist the Map to DB.
**Warning signs:** Stylist complains their video description was ignored after a server restart.

### Pitfall 5: FB Reels upload_url Host Is rupload.facebook.com, Not graph.facebook.com
**What goes wrong:** Using `file_url` means POSTing to the `upload_url` returned by Step 1, which points to `rupload.facebook.com`. This is a different host than Graph API calls. HTTP client must handle this correctly.
**Why it happens:** The `upload_url` from Step 1 is a fully-qualified URL to `rupload.facebook.com`. Just pass it directly to `fetch()` — do not prepend `graph.facebook.com`.
**How to avoid:** Use the `upload_url` verbatim from the Step 1 response. Do not construct the URL manually.
**Warning signs:** Step 2 returns 404 or connection refused.

### Pitfall 6: Reel Post_Type in Scheduler Image Guard
**What goes wrong:** Scheduler has a guard at line ~478: `if (allImages.length === 0 || !allImages[0]) throw new Error("No image URL available")`. Reel posts store the video URL in `image_url`, so `allImages[0]` will contain the video URL. This is fine — but the `allRaw` array construction uses `post.image_urls` (JSON array) first, then falls back to `post.image_url`. For reel posts, `image_urls` may be empty and `image_url` will be the video URL.
**Why it happens:** Existing image URL resolution logic was written for photos.
**How to avoid:** Ensure `savePost()` for reel posts sets `image_url = videoPublicUrl`. The `image_urls` JSON array can be empty or `[videoPublicUrl]`. The fallback path in scheduler handles this correctly already.
**Warning signs:** Scheduler throws "No image URL available" for reel posts.

## Code Examples

Verified patterns from existing codebase and official docs:

### IG Reel Container Creation (new, builds on existing)
```javascript
// Source: Instagram Graph API docs (verified 2026-03-20) + existing instagram.js pattern
// POST /{ig_user_id}/media — media_type=REELS, video_url instead of image_url
async function createIgReelContainer({ userId, videoUrl, caption, token, graphVer }) {
  const url = `https://graph.facebook.com/${graphVer}/${userId}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: 'true',
    access_token: token,
  });
  const resp = await fetch(url, { method: 'POST', body: params });
  const data = await resp.json();
  if (!resp.ok || !data?.id) {
    throw new Error(`IG Reel container create failed: ${resp.status} ${JSON.stringify(data)}`);
  }
  return data.id;
}
```

### waitForContainer with Custom Timeout (reusing existing function signature)
```javascript
// Source: instagram.js lines 105-119 — existing function
// For reels, call with overridden timeout values:
await waitForContainer(creationId, token, graphVer,
  /* maxWaitMs */ 120_000,
  /* pollIntervalMs */ 3_000
);
// Requires adding optional params to waitForContainer signature
```

### postErrorTranslator.js new rules for Reels
```javascript
// Add to RULES array in postErrorTranslator.js
{ match: /IG Reel container create failed|IG Reel/i,
  text: "Instagram couldn't start the Reel upload. Check that your Instagram Business account is still connected." },
{ match: /Timed out waiting for IG container/i,
  text: "Instagram took too long to process the video. Will retry automatically." },
{ match: /FB Reel init failed|FB Reel upload failed|FB Reel publish failed/i,
  text: "Facebook Reel failed to publish. Check your Facebook connection in Admin → Integrations." },
{ match: /TikTok publishing not yet available/i,
  text: "TikTok publishing is coming soon — not yet available." },
```

### gamification.js DEFAULT_POINTS addition
```javascript
// Source: src/core/gamification.js lines 14-22 — verified
export const DEFAULT_POINTS = {
  standard_post:     10,
  before_after:      15,
  availability:       8,
  promotions:        12,
  celebration:        5,
  product_education: 10,
  vendor_promotion:   5,
  reel:              20,   // ADD THIS — REEL-09
};
// No DB migration needed — getPointValue() fallback (line 56) handles it
```

### analytics.js postTypeLabel — reel already handled
```javascript
// Source: analytics.js lines 62-71 — verified (reel is already in the map)
function postTypeLabel(t) {
  const map = {
    standard: "Standard Post", standard_post: "Standard Post",
    before_after: "Before & After", before_after_post: "Before & After",
    availability: "Availability",
    promotion: "Promotion",
    reel: "Reel",     // already exists — no change needed
    story: "Story",
  };
  return map[t] || (t ? t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Standard Post");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-step video post (`/videos` endpoint) | Three-step async (IG) / Two-phase upload (FB) | IG API v22+, FB Reels API | Polling required; can't publish synchronously |
| IG impressions metric | IG `reach` + `plays` (Reels) | Graph API v22 | `impressions` deprecated for Reels — `plays` is Reels-specific metric |
| Any content-type photo post | Dedicated `media_type=REELS` | IG Graph API ~2022 | Must use REELS type or video is rejected |

**Deprecated/outdated:**
- `POST /{page_id}/videos` for FB Reels: Do not use this endpoint. FB now requires the dedicated `/{page_id}/video_reels` flow for Reels content. The `/videos` endpoint publishes as a standard video post, not a Reel.
- IG `impressions` field for Reels insights: Use `plays` for Reels-specific reach. `reach` still works for unique accounts.

## Open Questions

1. **Does `facebookAuth.js` include `pages_manage_posts` scope?**
   - What we know: The FB Reels endpoint requires this permission. The existing photo post endpoint does not.
   - What's unclear: Whether existing connected salons have this permission granted.
   - Recommendation: Check `facebookAuth.js` scope list during implementation. If missing, add it and note that some salons may need to re-authorize. Document in KB article.

2. **FB Reels upload_url: `file_url` vs binary upload**
   - What we know: The docs show both options. `file_url` requires the video to be publicly accessible, which it will be via `PUBLIC_BASE_URL/uploads/videos/`.
   - What's unclear: Whether `rupload.facebook.com` can reach the Render-hosted URL (it should — Render URLs are publicly accessible).
   - Recommendation: Use `file_url`. If it fails in staging, fall back to binary upload.

3. **gamification_settings DB column for `pts_reel`**
   - What we know: `getPointValue()` checks `settings[pts_${key}]` first, then falls back to `DEFAULT_POINTS[key]`. Adding `reel: 20` to `DEFAULT_POINTS` is sufficient for salons without custom point overrides.
   - What's unclear: Whether any salon will want to customize reel points independently.
   - Recommendation: No migration needed this phase. The fallback handles it. If custom reel points are needed later, add the column then.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 |
| Config file | vitest.config.js (or package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REEL-01 | Video content-type detection branches correctly | unit | `npx vitest run tests/videoDetection.test.js` | ❌ Wave 0 |
| REEL-02 | Twilio video download saves file and returns public URL | unit (mock fetch) | `npx vitest run tests/videoDownload.test.js` | ❌ Wave 0 |
| REEL-04 | Caption generation called with postType=reel | unit | `npx vitest run tests/videoCaption.test.js` | ❌ Wave 0 |
| REEL-08 | postErrorTranslator translates Reel error strings | unit | `npx vitest run tests/reelErrors.test.js` | ❌ Wave 0 |
| REEL-09 | gamification returns 20pts for reel post_type | unit | `npx vitest run tests/reelPoints.test.js` | ❌ Wave 0 |
| REEL-06 | IG Reel container/poll/publish flow | manual smoke | Manual — requires live IG credentials | manual-only |
| REEL-07 | FB Reel upload + publish flow | manual smoke | Manual — requires live FB credentials | manual-only |
| REEL-10 | tiktok.js stub throws expected error | unit | `npx vitest run tests/tiktokStub.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/videoDetection.test.js` — covers REEL-01 (content-type branching logic)
- [ ] `tests/videoDownload.test.js` — covers REEL-02 (mock fetch + fs.writeFile, verify UUID filename + public URL construction)
- [ ] `tests/videoCaption.test.js` — covers REEL-04 (caption generation called with correct params)
- [ ] `tests/reelErrors.test.js` — covers REEL-08 (translatePostError with Reel error strings)
- [ ] `tests/reelPoints.test.js` — covers REEL-09 (getPointValue returns 20 for 'reel')
- [ ] `tests/tiktokStub.test.js` — covers REEL-10 (stub throws expected string)

## Sources

### Primary (HIGH confidence)
- Instagram Graph API docs (verified 2026-03-20) — `/{ig_user_id}/media` with `media_type=REELS`, `video_url` parameter, container polling, `share_to_feed` option
- Facebook Reels Publishing API docs (verified 2026-03-20) — `POST /{page_id}/video_reels`, upload phases, `file_url` vs binary upload, required permissions
- `src/publishers/instagram.js` — existing three-step container pattern (`createIgMedia`, `waitForContainer`, `publishContainer`)
- `src/publishers/facebook.js` — existing publisher patterns; FB Reels needs a new function
- `src/scheduler.js` — publish section (lines 449-628); reel branch goes in the existing `if/else if/else` chain
- `src/core/gamification.js` — `DEFAULT_POINTS` map and `getPointValue()` fallback logic
- `src/routes/analytics.js` — `postTypeLabel()` already maps `reel` → "Reel" (line 67)
- `src/core/uploadPath.js` — `UPLOADS_DIR` pattern for persistent disk on Render
- `src/core/postErrorTranslator.js` — RULES array structure for adding Reel-specific error translations
- `migrations/` directory — highest existing migration is `048_content_recycler.js`; next is **049**

### Secondary (MEDIUM confidence)
- Instagram Graph API docs — video format requirements (MOV/MP4, H264/HEVC, 9:16 recommended, 300MB max, 3s-15min)
- Facebook Reels API docs — video specs (MP4, 9:16, H.264/H.265, 3-90s, `pages_manage_posts` required)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase; no new dependencies
- Architecture: HIGH — IG Reel API verified from official docs; existing publisher patterns confirmed from source
- FB Reels: MEDIUM — endpoint and flow verified from docs; `file_url` vs binary upload path is untested in production (recommend staging validation)
- Pitfalls: HIGH — derived from direct code inspection of existing polling timeouts, permission requirements from official docs, and in-memory Map patterns already in codebase

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Graph API versions are stable; permissions may change)
