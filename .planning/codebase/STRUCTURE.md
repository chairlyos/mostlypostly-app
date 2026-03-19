# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
mostlypostly-app/
├── server.js                # Express app entry point, middleware setup, route mounting
├── db.js                    # SQLite database singleton, schema application, migrations runner
├── schema.sql               # Base schema (idempotent CREATE TABLE IF NOT EXISTS)
├── package.json             # Node.js dependencies
│
├── migrations/              # Numbered SQL migrations (applied on startup)
│   ├── 001_baseline_patches.js
│   ├── ...
│   ├── 043_utm_tracking.js
│   └── index.js             # Exports array of all migrations
│
├── src/
│   ├── env.js               # Environment variable validation/defaults
│   ├── openai.js            # OpenAI Vision API client for caption generation
│   ├── scheduler.js         # Post publishing scheduler (polls DB, publishes via publishers)
│   │
│   ├── core/                # Business logic (message handling, post generation, integrations)
│   │   ├── messageRouter.js # Main inbound message handler (photo→caption, intent detection)
│   │   ├── salonLookup.js   # Multi-tenant lookup by stylist phone/chat_id/slug
│   │   ├── storage.js       # DB operations (savePost, updatePostStatus, queries)
│   │   ├── composeFinalCaption.js     # Build platform-specific captions with UTM tracking
│   │   ├── buildAvailabilityImage.js  # Generate story images from stylist availability
│   │   ├── buildPromotionImage.js     # Generate promo story images with brand palette
│   │   ├── buildBeforeAfterCollage.js # Combine before/after photos into grid
│   │   ├── celebrationScheduler.js    # Daily birthday/anniversary detection job
│   │   ├── celebrationImageGen.js     # Render dual-format celebration posts
│   │   ├── celebrationCaption.js      # GPT caption for celebrations
│   │   ├── fetchInsights.js           # Sync FB/IG post metrics from Graph API
│   │   ├── fetchGmbInsights.js        # Sync Google Business post metrics
│   │   ├── googleTokenRefresh.js      # Refresh Google OAuth tokens before expiry
│   │   ├── postErrorTranslator.js     # Convert raw API errors to plain English
│   │   │
│   │   ├── zenoti.js                  # Zenoti salon software API client
│   │   ├── zenotiSync.js              # Sync stylist availability from Zenoti
│   │   ├── zenotiAvailability.js      # Availability slot calculation + formatting
│   │   ├── availabilityRequest.js     # SMS intent detection (e.g., "post my availability")
│   │   ├── availabilityProvider.js    # Multi-provider availability abstraction
│   │   │
│   │   ├── vendorScheduler.js         # Auto-queue vendor brand campaigns (Pro plan)
│   │   ├── pexels.js                  # Pexels API client (fallback photo search)
│   │   ├── fontLoader.js              # Load Google Fonts as base64 data URIs for SVG
│   │   │
│   │   ├── joinManager.js             # Onboarding flow state machine
│   │   ├── joinSessionStore.js        # In-memory store for JOIN session state
│   │   ├── joinWizard.js              # Multi-step onboarding dialog builder
│   │   │
│   │   ├── classifyPostType.js        # Post type detection (standard, before_after, etc.)
│   │   ├── postClassifier.js          # Legacy post type classifier (deprecated)
│   │   ├── postTemplates.js           # Template captions for fallback
│   │   ├── toneVariants.js            # Brand voice variations for rewrites
│   │   ├── buildPreviewCaption.js     # Generate brief caption preview for SMS
│   │   │
│   │   ├── gamification.js            # Leaderboard token + analytics
│   │   ├── stylistWelcome.js          # Welcome SMS flow + consent management
│   │   ├── auditLog.js                # Platform audit trail (internal admin)
│   │   │
│   │   ├── trackingUrl.js             # UTM tracking token generation + short URL
│   │   ├── utm.js                     # UTM parameter utilities (append, validate)
│   │   │
│   │   ├── email.js                   # Email sending via Resend
│   │   ├── encrypt.js                 # Encryption utilities (legacy)
│   │   ├── encryption.js              # AES-256 encryption for API keys
│   │   ├── uploadPath.js              # File upload directory configuration
│   │   ├── analyticsDb.js             # Analytics event logging (separate DB or table)
│   │   ├── migrationRunner.js         # Execute numbered migrations on startup
│   │   ├── puppeteerRenderer.js       # Puppeteer singleton for server-side rendering
│   │   ├── timeParser.js              # Parse natural language time strings
│   │   ├── integrationHandlers.js     # Handler for platform integrations
│   │   │
│   │   └── data/                      # Reference data (fallbacks)
│   │       ├── fonts.js               # Hardcoded font fallback data
│   │       └── templates.js           # Default captions if API fails
│   │
│   ├── routes/              # Express route handlers (HTTP endpoints)
│   │   ├── manager.js                 # Manager dashboard (posts, approvals, edits)
│   │   ├── managerAuth.js             # Manager signup/login/forgot/reset (email + phone)
│   │   ├── managerProfile.js          # Manager personal settings
│   │   ├── admin.js                   # Salon admin panel (branding, team, settings)
│   │   ├── stylistManager.js          # Team page (add stylists, manage, grant portal access)
│   │   ├── dashboard.js               # Post queue + recent activity overview
│   │   ├── postQueue.js               # Drag-and-drop post reordering
│   │   ├── posts.js                   # Post CRUD operations (create, read, update, delete)
│   │   │
│   │   ├── twilio.js                  # SMS webhook + `sendViaTwilio()` helper
│   │   ├── telegram.js                # Telegram Bot webhook
│   │   │
│   │   ├── facebookAuth.js            # Facebook OAuth flow + token exchange
│   │   ├── googleAuth.js              # Google OAuth flow (GMB, Drive, Contacts)
│   │   ├── onboarding.js              # New salon signup flow (address, branding, etc.)
│   │   ├── onboardingGuard.js         # Middleware to enforce onboarding completion
│   │   │
│   │   ├── stylistPortal.js           # Stylist web portal (approve/edit posts)
│   │   ├── analytics.js               # Analytics dashboard + sync endpoint
│   │   ├── analyticsScheduler.js      # Scheduled insights sync background job
│   │   ├── schedulerConfig.js         # Posting schedule editor (per-salon, per-day rules)
│   │   ├── integrations.js            # Unified integrations panel (FB, IG, GMB, Zenoti)
│   │   ├── vendorFeeds.js             # Salon's opt-in vendor brand feeds
│   │   ├── vendorAdmin.js             # Internal: vendor campaign management (CSV upload)
│   │   │
│   │   ├── locations.js               # Multi-location management (list, switch, add)
│   │   ├── billing.js                 # Stripe checkout, plans, usage, webhook handler
│   │   ├── mfa.js                     # Multi-factor authentication (2FA)
│   │   ├── help.js                    # Help + feedback page
│   │   ├── teamPerformance.js         # Stylist performance metrics
│   │   ├── leaderboard.js             # Gamification leaderboard
│   │   ├── tracking.js                # Public `/t/:token` redirect + `/t/:slug/book` bio link
│   │   ├── internal.js                # Internal admin console (vendor CSV, plan overrides)
│   │   └── tenantFromLink.js          # Middleware: extract salon from magic link
│   │
│   ├── publishers/          # External platform publishing
│   │   ├── facebook.js      # Facebook Graph API single/multi-photo posts
│   │   ├── instagram.js     # Instagram Graph API (feed + story posts, carousel)
│   │   └── googleBusiness.js # Google Business Profile v4 API (WhatsNew + Offer)
│   │
│   ├── middleware/          # Express middleware
│   │   ├── csrf.js          # CSRF token generation + validation
│   │   └── tenantFromLink.js # Extract salon_id from magic link (stylist portal)
│   │
│   ├── ui/                  # Server-rendered UI components
│   │   └── pageShell.js     # HTML shell (sidebar nav, mobile menu, brand palette)
│   │
│   └── utils/               # Shared utilities
│       ├── logHelper.js     # Logger factory with file output
│       ├── rehostTwilioMedia.js # Re-host Twilio MMS on server for permanence
│       └── moderation.js    # Content moderation (TBD)
│
├── public/                  # Static assets (served as `/public/`)
│   ├── admin.js             # Client-side admin panel (modal system, JS handlers)
│   ├── logo/                # Brand logos
│   │   ├── logo-trimmed.png # Header logo (240px wide)
│   │   └── logo-mark.png    # Mobile menu logo (36px high)
│   ├── uploads/             # User-uploaded files (salon logos, stock photos)
│   ├── manager-login.html   # Legacy login form (may be unused)
│   └── manager-signup.html  # Legacy signup form (may be unused)
│
├── logs/                    # Log files (created at runtime)
│   ├── app.log              # Main application log
│   ├── scheduler.log        # Scheduler tick log
│   ├── posts.log            # Post publishing log
│   ├── queue.log            # Post queue operations
│   └── moderation.log       # Content moderation log
│
├── data/                    # Runtime data (created at runtime)
│   ├── posts.json           # JSON backup of posts (legacy)
│   └── mostlypostly.db      # Production database (symlink or copy)
│
├── salons/                  # JSON salon definitions (local dev only)
│   └── *.json               # Per-salon config files (loaded if APP_ENV=local)
│
├── scripts/                 # Maintenance + debugging scripts
│   ├── migrate-posts-json-to-sqlite.js
│   ├── verify-salon-id.js
│   ├── issue-manager-token.js
│   └── ... (13+ utility scripts)
│
└── tests/                   # Test suite (Jest/Vitest)
    ├── composeFinalCaption.test.js
    ├── vendorHashtags.test.js
    └── rcs.test.js
```

## Directory Purposes

**src/core/:**
- Purpose: All business logic independent of HTTP; can be called from routes, scheduler, or jobs
- No route handling; no `res.send()` or `res.render()`
- Exports pure functions + async operations
- Examples: Message classification, image generation, API calls, database queries

**src/routes/:**
- Purpose: HTTP endpoint handlers; receive `req`, call core logic, return `res`
- Each file typically handles one domain (e.g., `manager.js` for dashboard endpoints)
- Applies `requireAuth` middleware to protected routes
- Calls core functions, formats responses (HTML or JSON)

**src/publishers/:**
- Purpose: Isolated platform API clients (Facebook, Instagram, GMB)
- No business logic; pure adapters
- Signatures accept salon object + content, return platform response
- Error handling: Throws on failure (caught by scheduler)

**public/:**
- Purpose: Static assets served directly by Express via `express.static()`
- `admin.js`: Client-side code for admin panel modals (loaded on admin.html)
- Logos: Logo files used in HTML templates via `<img>` tags
- Uploads: User-uploaded photos + salon logos (stored on disk)

**logs/:**
- Purpose: Persistent log files for debugging
- Created at runtime by `logHelper.js`
- Rotation: Manual cleanup recommended (no automatic rolling)
- Permissions: Read by developers or monitoring tools

**migrations/:**
- Purpose: Schema evolution
- Numbered sequentially (001, 002, ..., 043+)
- Applied in order on startup by `migrationRunner.js`
- Tracked in `schema_migrations` table to prevent re-running
- Never edited after committed; new changes = new migration

## Key File Locations

**Entry Points:**
- `server.js`: HTTP server startup (Express.js, routes, middleware)
- `db.js`: Database connection + schema application + migration runner
- `src/scheduler.js`: Background polling scheduler (post publishing)

**Configuration:**
- `.env` / `process.env`: Environment variables (Twilio keys, API keys, etc.)
- `src/env.js`: Validation + defaults for env vars
- `schema.sql`: Base schema (applied before migrations)
- `migrations/`: Schema evolution (applied after base schema)

**Core Logic:**
- `src/core/messageRouter.js`: Main message handler (photo → caption, intents)
- `src/core/salonLookup.js`: Multi-tenant lookup utilities
- `src/core/storage.js`: Database operations (queries + inserts)
- `src/core/composeFinalCaption.js`: Caption generation with UTM tracking
- `src/scheduler.js`: Post publishing (polls, selects, publishes)

**Testing:**
- `tests/`: Test files (Jest or Vitest)
- Run with: `npm test` (if configured in package.json scripts)

**Authentication & Routing:**
- `src/routes/managerAuth.js`: Manager login/signup
- `src/routes/facebookAuth.js`, `src/routes/googleAuth.js`: OAuth flows
- `src/middleware/csrf.js`: CSRF token handling
- `src/ui/pageShell.js`: Shared HTML shell (nav, styling)

## Naming Conventions

**Files:**
- Routes: `src/routes/{domain}.js` (e.g., `manager.js`, `admin.js`, `analytics.js`)
- Core logic: `src/core/{action}.js` (e.g., `buildPromotionImage.js`, `fetchInsights.js`)
- Publishers: `src/publishers/{platform}.js` (e.g., `facebook.js`, `instagram.js`)
- Middleware: `src/middleware/{concern}.js` (e.g., `csrf.js`, `tenantFromLink.js`)
- Tests: `tests/{unit}.test.js` (e.g., `composeFinalCaption.test.js`)

**Directories:**
- Lowercase, hyphens for multi-word (e.g., `src/core/`, `src/utils/`, `public/uploads/`)
- Plural for collections (e.g., `routes/`, `migrations/`, `publishers/`)

**Functions:**
- Camel case: `savePost()`, `buildAvailabilityImage()`, `publishToFacebook()`
- Async functions: same convention (no special prefix)
- Internal helpers: prefixed with `_` if only used in one file (optional; prefer exporting)

**Database Identifiers:**
- Tables: Plural, snake_case (e.g., `posts`, `managers`, `stylists`, `salon_vendor_feeds`)
- Columns: Snake_case (e.g., `salon_id`, `stylist_name`, `published_at`)
- Foreign keys: `{table_singular}_id` (e.g., `salon_id`, `stylist_id`)
- Timestamps: Suffixed `_at` (e.g., `created_at`, `published_at`, `last_activity_at`)

**URL Patterns:**
- Authenticated routes: `/manager/{page}` (e.g., `/manager/dashboard`, `/manager/admin`)
- Webhooks: `/inbound/{platform}` (e.g., `/inbound/twilio`, `/inbound/telegram`)
- API: `/api/{resource}` (e.g., `/api/media-proxy`, `/api/insights/sync`)
- Billing: `/billing/{action}` (e.g., `/billing/checkout`, `/billing/webhook`)
- Public tracking: `/t/{token}` (UTM short link)

## Where to Add New Code

**New Feature (e.g., new post type):**
- **Decision logic:** Add classifier to `src/core/classifyPostType.js`
- **Image generation:** New file `src/core/build{PostType}Image.js`
- **Database schema:** New migration in `migrations/{NNN}_{feature}.js`
- **Route handler:** Add endpoint in relevant `src/routes/` file (e.g., `manager.js`)
- **Tests:** `tests/{feature}.test.js`

**New Integration (e.g., Zenoti → Pinterest):**
- **API client:** `src/core/pinterest.js` (reusable functions)
- **Publisher:** `src/publishers/pinterest.js` (public interface)
- **Scheduler integration:** Update `src/scheduler.js` to call new publisher
- **Settings UI:** Add card to `src/routes/integrations.js`

**New Route/Page (e.g., new dashboard view):**
- **Route handler:** Add endpoint to `src/routes/manager.js` (or new file if large)
- **HTML shell:** Call `pageShell({...})` from `src/ui/pageShell.js`
- **Navigation:** Update sidebar in `pageShell.js` to include new link
- **Authentication:** Wrap with `requireAuth()` middleware
- **Style:** Use Tailwind CDN classes (no CSS files needed)

**Utilities & Helpers:**
- **Shared helpers:** `src/utils/{concern}.js` (e.g., `logHelper.js`)
- **Single-use logic:** Inline in the route or core file that uses it (don't premature abstract)
- **Pure functions:** Export from `src/core/{domain}.js` even if called from one place

## Special Directories

**migrations/:**
- Purpose: Track schema changes over time
- Generated: Manually created (no auto-generation tool)
- Committed: Always committed to git
- Tracked: Applied migrations stored in `schema_migrations` table
- Idempotent: Safe to re-run (use `CREATE TABLE IF NOT EXISTS`, etc.)
- Rollback: No automatic rollback; delete data = new migration to re-add columns

**public/:**
- Purpose: Static assets served directly
- Committed: Logo files and admin.js committed; uploaded user files may not be
- Upload flow: Manager uploads file → server saves to `public/uploads/` → stored in DB as URL
- Serving: Express serves via `express.static("/public", ...)`

**logs/:**
- Purpose: Debugging and monitoring
- Generated: Created by `logHelper.js` at runtime
- Not committed: Add `logs/` to `.gitignore`
- Cleanup: Manual (developers or ops script) — no automatic rotation
- Access: Read by developers, monitoring tools, or support team

**salons/ (local dev only):**
- Purpose: JSON-based salon config for local development (APP_ENV=local)
- Files: Named by salon slug (e.g., `studio-500-salon.json`)
- Content: Salon config (name, phone, tokens, settings)
- Committed: May be committed for reference; overridden by DB in staging/prod
- Ignored in prod: Staging/production use SQLite only

**data/ (runtime):**
- Purpose: Ephemeral runtime data
- Contents: `posts.json` (backup), database files
- Not committed: Add `data/` to `.gitignore`
- Cleanup: Safe to delete; will be recreated on restart

---

## Summary: Navigation Guide

**To find where X is handled:**

| What | Where |
|---|---|
| Stylist sends SMS | → `src/routes/twilio.js` |
| Message routed to AI caption | → `src/core/messageRouter.js` |
| Caption generated | → `src/openai.js` |
| Post stored in DB | → `src/core/storage.js` |
| Manager approves post | → `src/routes/manager.js` |
| Post published to Facebook | → `src/scheduler.js` calls `src/publishers/facebook.js` |
| Image generated for availability | → `src/core/buildAvailabilityImage.js` |
| Post type classified | → `src/core/classifyPostType.js` |
| Zenoti integration syncs | → `src/core/zenotiSync.js` |
| Vendor campaigns auto-queued | → `src/core/vendorScheduler.js` |
| Insights fetched from FB/IG | → `src/core/fetchInsights.js` |
| Multi-location switching | → `src/routes/locations.js` |
| Salon branding configured | → `src/routes/admin.js` |
| Manager signs up | → `src/routes/managerAuth.js` |
| Environment variables validated | → `src/env.js` |
| Database schema applied | → `db.js` → `schema.sql` → `migrations/` |
| Logs written | → `src/utils/logHelper.js` → `logs/*.log` |
