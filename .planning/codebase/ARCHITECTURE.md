# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Multi-tenant, event-driven message processing with centralized scheduling.

**Key Characteristics:**
- SMS/Telegram webhooks trigger AI-assisted content generation
- Single-threaded SQLite database with WAL journaling (no migrations/distributed state)
- Async scheduler polls database at regular intervals to publish queued posts
- Request-scoped session-based multi-tenancy (salon_id in session)
- Fire-and-forget publisher pattern (Facebook, Instagram, Google Business)

## Layers

**Presentation (Web Routes):**
- Purpose: Render HTML pages and handle form submissions for managers
- Location: `src/routes/`
- Contains: Dashboard, analytics, team management, billing, integrations, admin panel
- Depends on: Session middleware, storage layer, UI shell
- Used by: Browser clients authenticated via session cookies
- Example files: `src/routes/manager.js`, `src/routes/dashboard.js`, `src/routes/admin.js`

**Inbound Webhook Routes:**
- Purpose: Receive and route messages from external platforms (Twilio SMS, Telegram, Stripe webhooks)
- Location: `src/routes/twilio.js`, `src/routes/telegram.js`, `src/routes/billing.js`
- Contains: Signature verification, message parsing, draft storage
- Depends on: Message router, salon lookup, rate limiters
- Used by: Twilio, Telegram, Stripe APIs (via HTTP POST)
- Webhook endpoints: `/inbound/twilio`, `/inbound/telegram`, `/billing/webhook`

**Authentication & Session:**
- Purpose: Manager login, session persistence, CSRF protection
- Location: `src/routes/managerAuth.js`, `src/middleware/csrf.js`
- Contains: Email/password auth, token-based login links (SMS), password reset, session store
- Session storage: SQLite via `better-sqlite3-session-store` at `/data/sessions.db`
- Auth flow: Manager signs up → hashed password stored → email-based login with SMS confirmation or password reset links

**OAuth Integrations:**
- Purpose: Connect to external platforms (Facebook, Instagram, Google Business Profile)
- Location: `src/routes/facebookAuth.js`, `src/routes/googleAuth.js`
- Contains: OAuth flow, token refresh, permission verification
- Token storage: Long-lived tokens stored in `salons` table columns (`facebook_page_token`, `google_access_token`, `google_refresh_token`)

**Business Logic (Core):**
- Purpose: Central message handling, post generation, availability management
- Location: `src/core/`
- Main entry point: `messageRouter.js` — handles incoming stylist messages
- Key responsibilities:
  - `messageRouter.js`: Route messages (photo → AI caption, or text intent detection)
  - `composeFinalCaption.js`: Build platform-specific captions with UTM tracking
  - `buildAvailabilityImage.js`: Generate story images for appointment availability
  - `buildPromotionImage.js`: Generate promo story images with brand palette overlay
  - `celebrationScheduler.js`: Daily job detecting birthdays/anniversaries
  - `vendorScheduler.js`: Separate scheduler for vendor brand content
  - `zenotiSync.js`: Integration with Zenoti salon software for availability data
  - `salonLookup.js`: Multi-tenant lookup by stylist phone, chat ID, or slug

**Storage Layer:**
- Purpose: Persist posts, stylists, managers, and system state
- Location: `src/core/storage.js`
- Database: SQLite (`postly.db`), synchronous via `better-sqlite3`
- Key operations: `savePost()`, `updatePostStatus()`, `findPendingPostByManager()`
- Schema file: `schema.sql` (idempotent CREATE TABLE)
- Migrations: Numbered files in `migrations/` applied on startup via `migrationRunner.js`

**Scheduler (Publishing):**
- Purpose: Poll database for approved posts and publish to Facebook/Instagram/Google Business
- Location: `src/scheduler.js`
- Polling interval: Configured in environment (typically 5–10 seconds)
- Algorithm: Select posts in priority order (availability > before_after > celebration > standard), respecting:
  - Posting window (salon-specific start/end times, can be per-weekday)
  - Daily feed/story caps (plan-based limits from `PLAN_LIMITS`)
  - Stylist fairness (round-robin by stylist name to avoid monopolization)
  - Spacing rules (min/max gap between posts)
- Publishers called: `publishToFacebook()`, `publishToInstagram()`, `publishWhatsNewToGmb()`
- On success: `fb_post_id` / `ig_media_id` / `google_post_id` stored, status → `published`
- On failure: `error_message` logged, status → `failed`, manager notified via SMS

**Publishers:**
- Purpose: Interface with external social media / booking APIs
- Location: `src/publishers/`
- Facebook: `publishToFacebook()` — POST to Graph API `/photos` or `/feed`
- Instagram: `publishToInstagram()`, `publishToInstagramCarousel()`, `publishStoryToInstagram()` — POST to Graph API
- Google Business: `publishWhatsNewToGmb()`, `publishOfferToGmb()` — POST to GMB API v4
- Token handling: Multi-tenant aware; pulls from `salon` object or env vars
- Error translation: `postErrorTranslator.js` converts API errors to plain English for UI

**Analytics:**
- Purpose: Sync post performance metrics from platforms
- Location: `src/core/fetchInsights.js`, `src/core/fetchGmbInsights.js`
- Main entry: `syncSalonInsights(salon)` — called from analytics dashboard
- Metrics synced: impressions, reach, likes, comments, shares, saves, engagement rate
- Target: `post_insights` table (upsert by `post_id + platform`)
- GMB insights: Calls `localPosts:reportInsights` API for views + clicks

**UI Components:**
- Purpose: Shared HTML shell and form rendering
- Location: `src/ui/pageShell.js`
- Exported as Express middleware: `pageShell({title, body, current, salon_id, manager_id})`
- Includes: Left sidebar nav (role-based visibility), mobile hamburger menu, location indicator chip
- Styling: Tailwind CSS CDN + MostlyPostly brand palette tokens

## Data Flow

**Stylist Photo + SMS → Approved Post → Published:**

1. **Stylist texts photo** to salon's Twilio number or Telegram bot
2. **Webhook route** (`/inbound/twilio` or `/inbound/telegram`) validates signature, extracts media URL + text notes
3. **messageRouter.js** called with image URL + notes:
   - Looks up stylist by phone/chat ID → `lookupStylist()`
   - Looks up salon by stylist → `getSalonByStylist()`
   - Detects intent: photo (standard post) vs. availability request vs. celebration
   - Calls `generateCaption()` (OpenAI Vision with salon brand guidelines)
   - Saves draft in in-memory `drafts` Map (keyed by chat ID)
   - Sends preview to stylist via SMS
4. **Stylist replies:** APPROVE, EDIT, REDO, CANCEL
5. **If APPROVE:**
   - Message router updates draft status
   - If `require_manager_approval=1`: saves as `manager_pending`, sends manager approval link
   - Else: directly calls `enqueuePost()` → status becomes `manager_approved`, `scheduled_for` set
6. **Scheduler polls** every 5–10 seconds:
   - Queries `posts WHERE status='manager_approved' AND scheduled_for <= NOW()`
   - Selects next post by priority + fairness rules
   - Calls appropriate publisher (Facebook, Instagram, GMB)
   - Stores response IDs, updates status → `published`, sets `published_at`
7. **Stylist receives SMS confirmation** with post details

**Manager Approval Flow (if required):**

1. Manager receives SMS link: `/manager/posts/:postId?action=approve`
2. Clicks link → renders post detail page via `manager.js`
3. Edits caption if desired, clicks **Approve** button
4. `POST /manager/posts/approve` → `handleManagerApproval()` in `messageRouter.js`
5. Enqueues post via `enqueuePost()`

**Post Queue Reordering:**

1. Manager visits `/manager/queue` — shows all approved scheduled posts chronologically
2. Drags post to new position (SortableJS on client)
3. `POST /manager/queue/reorder` with new order
4. Server extracts current `scheduled_for` timestamps, sorts them, reassigns in DB transaction
5. Time slots preserved, post order changed

**State Management:**

- **In-Memory:** `drafts` Map per chat session (lost on server restart — acceptable for local-only state)
- **Database:** All persistent state (posts, stylists, managers, integrations, tokens, sessions)
- **External:** Facebook/Instagram/GMB APIs hold published post IDs and engagement metrics
- **Session:** `req.session` stores `manager_id`, `salon_id`, `group_id` (multi-location scope)

## Key Abstractions

**Salon (Multi-Tenant Root):**
- Purpose: Isolate all data for one salon location
- Examples: `src/routes/manager.js`, `src/scheduler.js`, storage queries
- Pattern: All queries include `WHERE salon_id = ?` using `req.session.salon_id`
- Lookup: `salonLookup.js` — `getSalonByStylist()` finds salon from stylist phone

**Stylist (SMS/Telegram User):**
- Purpose: Represent someone who sends photos/messages
- Fields: phone, name, Instagram handle, specialties, photo_url, last_activity_at
- Pattern: Looked up by phone (Twilio) or chat_id (Telegram) on inbound
- Draft ownership: Keyed by chat_id in `drafts` Map

**Manager (Portal User):**
- Purpose: Authenticated user who approves posts, manages team
- Role system: owner (full access + billing), manager (full access, no billing), coordinator (limited dashboard view)
- Authentication: Email + password OR SMS token-based link (7-day expiry)
- Session: `manager_id` stored in Express session, validated on each request

**Post (Content Unit):**
- Purpose: Single piece of content ready to publish
- Fields: caption (base/final/manual), image_url(s), post_type, status, scheduled_for, published_at
- Status state machine: draft → manager_pending → manager_approved → published (or failed)
- Multi-platform: Can publish to Facebook + Instagram in same post via `platform` field or dual publish

**Vendor Campaign (Pro Plan):**
- Purpose: Brand-supplied content template for hair salons
- Fields: vendor_name, campaign_name, product_name, photo_url, hashtags, tone_direction, cta_instructions, expires_at
- Activation: Salon enables brand feed in Admin, system auto-queues eligible campaigns via `vendorScheduler.js`
- Constraints: Category filters, frequency caps, salon-specific affiliate URLs

**Tracking Token (UTM):**
- Purpose: Opaque link for analytics
- Fields: 8-char base64url token, destination URL with UTM params, click_type (booking/vendor/bio)
- Clicks: Logged in `utm_clicks` table with first-click timestamp + IP hash
- URL generation: `/t/{token}` redirects with 302, logs click, forwards to destination

## Entry Points

**Web Server:**
- Location: `server.js`
- Starts Express app, applies middleware (session, CSRF, helmet, rate limiters)
- Mounts all route handlers
- Initializes scheduler via `startScheduler()` on startup

**Inbound SMS:**
- Location: `src/routes/twilio.js` → `/inbound/twilio`
- Triggered by: Twilio webhook configured in Twilio Console
- Validates: Twilio request signature
- Calls: `messageRouter.js` → `handleIncomingMessage()`

**Inbound Telegram:**
- Location: `src/routes/telegram.js` → `/inbound/telegram`
- Triggered by: Telegram bot webhook
- Validates: Update ID uniqueness (anti-duplicate)
- Calls: `messageRouter.js` → `handleIncomingMessage()`

**Scheduler Tick:**
- Location: `src/scheduler.js` → `runSchedulerOnce()`
- Triggered by: Interval loop started in `startScheduler()`
- Selects next post, publishes, logs result
- No external trigger — fully internal polling

**Manager Dashboard:**
- Location: `src/routes/manager.js` → `GET /manager/dashboard`
- Requires: Valid session with `manager_id`
- Renders: Post queue, recent posts, pending approvals

**Admin Panel:**
- Location: `src/routes/admin.js` → `GET /manager/admin`
- Requires: Owner role
- Manages: Salon branding, team, stock photos, integrations

## Error Handling

**Strategy:** Try-catch at boundary + logged to files + user notification

**Patterns:**

**Post Publishing Failure:**
- In `scheduler.js` `enqueuePost()` wrapped in try-catch
- On error: `status = 'failed'`, `error_message` stored in DB
- Manager notification: SMS sent to all salon managers with plain-English error via `postErrorTranslator.js`
- Retry: Manager can click **Retry** on dashboard → resets status to `manager_approved`, `scheduled_for = now+2min`

**API Call Failures (OpenAI, Twilio, Facebook, Pexels):**
- Wrapped in try-catch
- Fallback: Use template caption (generic) or placeholder image (solid color)
- Logged: Full error stack to `logs/app.log`
- User-facing: Graceful degradation without crashing post flow

**Image Generation Failure:**
- Pexels API fails → tries salon stock photos → tries stylist photos → falls back to solid color
- Renders successfully in all cases; no broken posts

**Database Lock (concurrent writes):**
- WAL mode prevents most contention
- Timeout: 10 seconds (set in `db.js` → `new Database(..., { timeout: 10000 })`)
- Rare: If timeout hit, throws and is caught at route level

## Cross-Cutting Concerns

**Logging:**
- Files: `logs/app.log` (main), `logs/scheduler.log` (scheduler), `logs/posts.log` (publishing)
- Helper: `src/utils/logHelper.js` → `createLogger(name)`
- Pattern: `log.info()`, `log.warn()`, `log.error()` throughout
- Console output: Prefixed with emoji (🚀, ❌, 📤, etc.) for quick scanning

**Validation:**
- Input: Request body validated at route level (HTML form fields or JSON)
- Database: Prepared statements prevent SQL injection
- External: API responses validated before use (JSON schema informal)
- Salon data: Always filtered by `req.session.salon_id` to prevent IDOR

**Authentication:**
- Managers: Email + password (bcrypt hashed) OR SMS token-based link (7-day expiry)
- Stylists: No persistent login; interact via SMS/Telegram only
- Sessions: Express-session + SQLite store, 7-day cookie max-age
- Middleware: `requireAuth(req, res, next)` checks `req.session.manager_id`

**Multi-Tenancy:**
- Root: `salon_id` stored in `req.session.salon_id` after login
- Isolation: All queries include `WHERE salon_id = ?` with session value
- Switching: `POST /manager/locations/switch` updates session `salon_id`
- Groups: Salons grouped under `salon_groups` for multi-location users; `group_id` also in session

**Rate Limiting:**
- Applied at `server.js` before route handlers
- Auth routes: 10 attempts per 15 minutes (production)
- Reset routes: 5 attempts per hour
- Webhook routes: 200 per minute (Stripe/Twilio need bursts)
- General API: 300 per minute
- Disabled in local mode (`APP_ENV=local`)

**CSRF Protection:**
- Middleware: `src/middleware/csrf.js`
- Token per session, validated on POST/PUT/DELETE/PATCH
- Excluded routes: Webhooks (Twilio, Stripe, Telegram validate via signature instead)
- Pattern: All HTML forms include `<input type="hidden" name="_csrf" value="{token}">`

**Image Proxying:**
- Twilio MMS URLs: Expire ~90 days, require auth header
- Proxy endpoint: `GET /api/media-proxy?url=<twilio-url>`
- Flow: Browser can't fetch Twilio URLs directly → request proxy → proxy adds Twilio auth header → streams response
- Applied in: Manager dashboard, stylist portal, analytics (all use `toProxyUrl()` helper)

**UTF-8 & International:**
- Database: UTF-8 default (SQLite)
- Captions: Sent as UTF-8 to Facebook/Instagram Graph API
- Timeouts: Luxon DateTime library (timezone-aware) for scheduling
