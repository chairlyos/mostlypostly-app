# INTEGRATIONS.md — External Integrations

## Database
- **SQLite** (via `better-sqlite3`) — local file, synchronous, single connection
- File: `db.js` — singleton connection imported across all route/core files
- Migrations: `migrations/001` through `043+` — run on startup via `migrationRunner.js`

## SMS / MMS
- **Twilio** — primary stylist communication channel
- Webhook: `POST /twilio/webhook` (`src/routes/twilio.js`)
- Helpers: `sendViaTwilio(to, body)`, `sendViaRcs(to, body, buttons)`
- RCS chips supported when `RCS_ENABLED=true` + Messaging Service configured
- Inbound MMS photos trigger the full caption-generation pipeline
- Image proxy: `/api/media-proxy` — proxies Twilio MMS URLs (require auth) for browser display
- Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_MESSAGING_SERVICE_SID`

## Telegram Bot
- Secondary stylist channel (alternative to SMS)
- Webhook: `POST /telegram/webhook` (`src/routes/telegram.js`)
- Raw HTTP calls to Telegram Bot API
- Env var: `TELEGRAM_BOT_TOKEN`

## OpenAI
- **GPT-4o Vision** — caption generation from MMS photos (`src/core/openai.js`)
- **GPT-4o-mini** — celebration captions (`src/core/celebrationCaption.js`), brand palette extraction
- Used in: `messageRouter.js`, `onboarding.js` (brand palette), `celebrationCaption.js`
- Env var: `OPENAI_API_KEY`

## Facebook / Meta Graph API
- **Version**: v22.0
- Photo posts: `src/publishers/facebook.js`
- OAuth flow: `src/routes/facebookAuth.js` — short-lived → long-lived user token → page token
- Insights sync: `src/core/fetchInsights.js` → `syncSalonInsights()`
- Analytics debug: `GET /analytics/debug?salon=<slug>`
- Env vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_TOKEN` (fallback)
- Token storage: `salons.facebook_page_token` (long-lived, never expires)
- Scopes needed: `read_insights`, `pages_read_engagement`

## Instagram Graph API
- Business account publishing via `src/publishers/instagram.js`
- Insights: v22+ uses `reach`, `saved`, `total_interactions` (`impressions` deprecated)
- IG media access: `/{igBusinessId}/media` list → match by ID or timestamp (±5 min)
- Collaborator tagging: `stylists.ig_collab` flag, SMS keywords COLLAB/NOCOLLAB
- Storage: `salons.instagram_business_id`, `salons.instagram_handle`

## Google Business Profile (GMB)
- **API v4** — `localPosts` CRUD, insights
- Publisher: `src/publishers/googleBusiness.js`
- OAuth flow: `src/routes/googleAuth.js`
  - `GET /auth/google/login`
  - `GET /auth/google/callback`
  - `POST /auth/google/select-location`
  - `POST /auth/google/disconnect`
- Token refresh: `src/core/googleTokenRefresh.js` — silently refreshes if expired or within 5 min
- Insights: `src/core/fetchGmbInsights.js` → `syncGmbInsights(salon)`
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Storage: `salons.google_location_id`, `salons.google_access_token`, `salons.google_refresh_token`, `salons.google_token_expiry`, `salons.gmb_enabled`

## Stripe
- Subscription billing: Starter ($49/mo), Growth ($149/mo), Pro ($249/mo)
- Checkout sessions, customer portal, webhooks
- Webhook endpoint: `POST /billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Trial guard: one 7-day trial per salon lifetime (`salons.trial_used`)
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL`, `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`
- Route: `src/routes/billing.js`

## Resend (Email)
- Transactional email: password reset, welcome emails
- Used in: `src/core/email.js`
- Env vars: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `hello@mostlypostly.com`)

## Pexels API
- Stock photo backgrounds for availability/promotion images (fallback when no uploads)
- Used in: `src/core/pexels.js` → `fetchPexelsBackground(context)`
- Context-aware search terms, picks randomly from 15 results
- Env var: `PEXELS_API_KEY`

## Google Places API
- Address autocomplete on signup form
- Client-side JS API, auto-fills `address`, `city`, `state`, `zip` fields
- Degrades to plain text if key unset
- Env var: `GOOGLE_PLACES_API_KEY`

## Zenoti (Salon Software)
- Booking system integration for availability posts
- Client: `src/core/zenoti.js` — `getWorkingHours`, `getAppointments`, `getServiceCatalog`, `getCenters`, `getEmployees`
- Sync logic: `src/core/zenotiSync.js` — 30-min in-memory pool, `syncAvailabilityPool()`
- Availability calc: `src/core/zenotiAvailability.js`
- Auth: `Authorization: apikey {key}` + `application_id: {appId}` headers
- Storage: `salon_integrations` table (api_key encrypted via `src/core/encrypt.js`)
- UI: `src/routes/integrations.js`

## Google Fonts
- Loaded via CDN in SVG `@font-face` for celebration images
- Fonts: Great Vibes, Montserrat, Pacifico, Lato
- Loader: `src/core/fontLoader.js` — in-memory cache, null fallback on error

## Puppeteer / Chrome
- Headless browser for SVG→PNG rendering of availability/promotion/celebration images
- Singleton: `src/core/puppeteerRenderer.js` — `launchPromise` mutex prevents concurrent launches
- Flags: `--single-process --no-zygote` (Render Starter 512MB RAM constraint)
- Installed via `postinstall` script: `npx puppeteer browsers install chrome`

## UTM / Tracking
- Short URL system: `/t/:token` — 302 redirect, logs first click
- Bio link: `/t/:slug/book` — permanent, logs every click
- Token creation: `src/core/trackingUrl.js` → `buildTrackingToken()`, `buildShortUrl()`, `buildBioUrl()`
- UTM params: `src/core/utm.js` → `appendUtm()`, `slugify()`
- Storage: `utm_clicks` table
- Route: `src/routes/tracking.js` (mounted before auth middleware)

## Socket.IO
- Real-time updates (scheduler status, live notifications)
- Integrated with Express server via `socket.io` `^4.8.1`

## Internal Admin Tool
- URL: `/internal/vendors?secret=<INTERNAL_SECRET>`
- Requires `INTERNAL_SECRET` env var + `INTERNAL_PIN` session two-factor
- Not linked from any UI — URL-only access
- Route: `src/routes/vendorAdmin.js`
