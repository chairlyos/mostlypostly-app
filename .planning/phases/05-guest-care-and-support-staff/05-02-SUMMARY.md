---
phase: 05-guest-care-and-support-staff
plan: "02"
subsystem: coordinator-posting-flow
tags:
  - coordinator
  - messageRouter
  - stylistPortal
  - portalUpload
  - submitted_by
  - GPT-name-extraction
dependency_graph:
  requires:
    - 05-01 (isCoordinator flag in lookupStylist, submitted_by column in posts)
  provides:
    - Coordinator SMS posting branch with GPT name extraction
    - "Who is this for?" fallback flow with pending state
    - Coordinator portal approval card with stylist dropdown and flood warning
    - Direct portal photo upload form at /manager/coordinator/upload
  affects:
    - src/core/messageRouter.js
    - src/routes/stylistPortal.js
    - src/routes/manager.js
tech_stack:
  added:
    - multer (already in package.json — now imported in manager.js for coordinator uploads)
    - OpenAI GPT-4o-mini (new usage for coordinator name extraction with json_object format)
  patterns:
    - pendingCoordinatorPosts Map with 10-min TTL (mirrors pendingVideoDescriptions pattern)
    - fuzzy first-name matching with exact + prefix fallback
    - submitted_by tracking for all coordinator-created posts
    - isCoordinatorFlow detection via post.submitted_by IS NOT NULL in portal
key_files:
  created: []
  modified:
    - src/core/messageRouter.js
    - src/routes/stylistPortal.js
    - src/routes/manager.js
decisions:
  - "GPT-4o-mini with json_object response_format used for name extraction — lightweight and fast for this simple task"
  - "Coordinator pending reply stored in-memory (pendingCoordinatorPosts) with 10-min TTL — same pattern as pendingVideoDescriptions"
  - "fuzzyMatchStylist checks exact first-name then prefix match — handles 'Tay' for 'Taylor' without fuzzy library dependency"
  - "createCoordinatorPost saves as draft status with portal token — coordinator gets confirmation link like a stylist"
  - "isCoordinatorFlow detection uses post.submitted_by IS NOT NULL — clean and backward-compatible"
  - "Flood warning threshold is 3+ posts in 7 days per coordinator+stylist pair"
  - "Coordinator upload saves to manager_pending directly — no draft review step since manager is the submitter"
  - "multer coordinatorUpload uses dest (not diskStorage) to simplify rename to UUID filename"
metrics:
  duration_seconds: 413
  completed_date: "2026-03-20"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 05 Plan 02: Coordinator Posting Flow Summary

**One-liner:** Coordinator SMS branch with GPT-4o-mini stylist name extraction, "Who is this for?" pending state, portal confirmation with stylist dropdown + flood warning, and direct portal photo upload at /manager/coordinator/upload.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add coordinator SMS branch and GPT name extraction to messageRouter | 713b3e8 | src/core/messageRouter.js |
| 2 | Add stylist dropdown and flood warning to coordinator portal approval | 271f316 | src/routes/stylistPortal.js |
| 3 | Add coordinator portal photo upload form | 8ddd77f | src/routes/manager.js |

## What Was Built

### Task 1: messageRouter.js coordinator branch

Added four new module-level constructs:

- `pendingCoordinatorPosts` Map with 10-min TTL — stores pending entries when no stylist name found in photo message
- `extractStylistName(messageText, salonId)` — calls GPT-4o-mini with `response_format: { type: "json_object" }`, passes known stylist first names as context, returns matched name or null
- `fuzzyMatchStylist(extractedName, salonId)` — exact first-name match first, then prefix match (handles "Tay" for "Taylor"), queries active stylists only
- `createCoordinatorPost(...)` — generates AI caption via `generateCaption`, saves post with `stylist_name` set to matched stylist and `submitted_by` set to coordinator's manager_id, creates portal token, sends confirmation link via Twilio
- `handleCoordinatorPost(...)` — orchestrates the flow: extract name → match → create or ask "Who is this for?"

Wired two branches into `handleIncomingMessage`:
1. Coordinator pending reply check (before video description check) — catches plain-text stylist name reply
2. Coordinator photo branch (`stylist?.isCoordinator && primaryImageUrl && !isVideo`) — before video MMS section

### Task 2: stylistPortal.js coordinator portal card

In the `GET /:id` route:
- Detects coordinator flow via `const isCoordinatorFlow = !!post.submitted_by`
- Renders `<select name="attributed_stylist">` pre-filled with current `post.stylist_name`, bound to the submit form via `form="submit-form"`
- Flood check query: `COUNT(*) FROM posts WHERE salon_id=? AND submitted_by=? AND stylist_name=? AND created_at >= datetime('now', '-7 days')`
- Shows amber warning card when `cnt >= 3`

In the `POST /:id/submit` route:
- If `req.body.attributed_stylist` is present and `post.submitted_by` is set, updates `stylist_name` in DB before setting status to `manager_pending`

### Task 3: manager.js coordinator upload

Added at top of file:
- `import path, { renameSync }` — for file rename
- `import multer` — for multipart upload
- `import { savePost }` — from storage.js
- `coordinatorUpload` multer config (dest `public/uploads/`, images only, 10MB max)

Added routes:
- `GET /manager/coordinator/upload` — renders form with stylist dropdown (active stylists for salon), file input, optional caption note textarea, error query param handling
- `POST /manager/coordinator/upload` — accepts uploaded file, renames to `UUID + ext`, generates AI caption, saves post as `manager_pending` with `submitted_by: manager_id`

Added "Upload a Post" button in dashboard header next to "Create Promotion".

Also added `submitted_by` badge display on pending cards (linter-injected addition, shows "via [Coordinator Name] on behalf of [Stylist]").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed curly/smart quote encoding in manager.js imports**
- **Found during:** Task 3 commit
- **Issue:** The Edit tool replaced straight ASCII double-quotes with Unicode curly quotes (U+201C/U+201D) in the import lines when rewriting the top of manager.js. This would break Node.js ESM parsing.
- **Fix:** Python script to replace all `\xe2\x80\x9c`/`\xe2\x80\x9d` bytes with ASCII `"` (`0x22`)
- **Files modified:** src/routes/manager.js
- **Commit:** 8ddd77f

## Self-Check: PASSED

All 3 modified files exist. All 3 task commits verified in git log (713b3e8, 271f316, 8ddd77f).
