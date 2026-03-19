# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Large monolithic router files:**
- Issue: `src/core/messageRouter.js` (52KB), `src/core/postTemplates.js` (35KB), `src/core/storage.js` (15KB), `src/core/salonLookup.js` (16KB) contain multiple concerns and are difficult to navigate
- Files: `src/core/messageRouter.js`, `src/core/postTemplates.js`, `src/core/storage.js`, `src/core/salonLookup.js`, `src/core/zenoti.js` (14KB)
- Impact: Code changes introduce cascading effects; testing is harder; onboarding new developers requires reading long files with mixed concerns
- Fix approach: Modularize by concern: `messageRouter.js` should delegate to handler modules (post classification, caption approval, availability detection); `postTemplates.js` should be split into per-template files; `salonLookup.js` should separate lookup from consent/storage operations

**Incomplete TODO/FIXME markers:**
- Issue: Two known stubs exist with no implementation timeline
- Files: `src/core/integrationHandlers.js` lines 6 and 11
  - `// TODO: handle appointment.booked, appointment.cancelled, etc.` — Zenoti webhook events not wired
  - `// TODO: handle vagaro webhook events` — Vagaro events not implemented
- Impact: Zenoti integration accepts webhooks but does nothing with them; Vagaro integration is scaffolding only
- Fix approach: Implement event handlers for `appointment.booked`, `appointment.cancelled` to update salon availability in real-time. For Vagaro: decide if this is MVP or future. Document decision in FEATURES.md.

**Password reset link delivery in console:**
- Issue: `src/routes/managerAuth.js` line 1039 logs reset links to console instead of sending via SMS or email
- Files: `src/routes/managerAuth.js` line 1039-1041
- Impact: In production, managers cannot recover forgotten passwords (flow breaks). Password reset exists but is unreachable.
- Fix approach: Wire the existing `sendViaTwilio()` helper to deliver reset link via SMS to manager's phone, or use email (Resend is already integrated). Add test on staging to verify SMS delivery.

**API fetch calls without timeout:**
- Issue: `src/core/zenoti.js` line 40 uses `fetch(url, { headers })` with no timeout parameter
- Files: `src/core/zenoti.js` lines 38-46, `src/openai.js` line 155 (OpenAI), OpenAI and Pexels calls throughout
- Impact: External API hangs block the entire request handler indefinitely. If Zenoti or OpenAI is slow, stylists' and managers' requests timeout at 60s. No graceful degradation.
- Fix approach: Add `AbortController` with 20s timeout for Zenoti, 15s for OpenAI, 10s for Pexels. Wrap in try/catch. Log timeouts separately from 5xx errors.

**Database synchronous operations under high load:**
- Issue: `better-sqlite3` is synchronous; all DB operations block the event loop. High concurrency can starve other requests.
- Files: Throughout app; `db.js` uses single SQLite instance with 10s timeout
- Impact: During peak posting hours (e.g., many posts scheduled at once, multiple managers interacting), database locks could cause cascade failures or request timeouts
- Fix approach: Add connection pooling or migration to async DB (though sqlite is not async-friendly). For now: profile under load on staging, set explicit query timeouts, add DB query logging to detect hotspots. Monitor WAL file growth; consider periodic checkpoints.

**Incomplete test coverage:**
- Issue: Only 4 test files exist for a 40+ route, 50+ core module codebase
- Files: `tests/` directory contains only: `composeFinalCaption.test.js`, `igCollaborator.test.js`, `rcs.test.js`, `vendorHashtags.test.js`
- Impact: Critical paths untested: scheduler, payment flow, manager auth, IDOR checks, caption generation edge cases. Regressions can slip to production.
- Fix approach: Add test suite for: authentication (login, MFA, password reset), scheduler (posting, retries, rate limiting), manager IDOR checks, payment flow, zenoti integration, OpenAI fallback. Target 70% coverage on critical paths.

---

## Known Bugs

**Scheduler recovery after restart:**
- Symptoms: If the app restarts while a post is in flight (being published), the post status becomes ambiguous. May publish twice or not at all.
- Files: `src/scheduler.js` lines 533-569 (failure handling), database transaction pattern
- Trigger: Stop the server mid-publish, restart, run scheduler again
- Workaround: Dashboard shows failed posts for manual retry. Implement idempotency check: before publishing, query FB/IG for recent posts by salon within ±5 min window to detect duplicates.
- Fix approach: Add idempotency key to publish calls. Store request ID in posts table before publishing. Check if post already exists on platform before updating status.

**Session bleedthrough between manager accounts:**
- Symptoms: Rare; occurs after password reset or account switching. Session data from one manager briefly visible to another.
- Files: `src/routes/managerAuth.js` (session regeneration on login), `server.js` (session middleware)
- Trigger: Reset password, immediately log in as different manager
- Workaround: Log out and log back in; issue resolves
- Fix approach: Ensure session.regenerate() is called before setting new manager_id. Currently done (line 607 in managerAuth.js), but verify it's not skipped on any login path.

**Google Business Profile token expiry edge case:**
- Symptoms: GMB publish fails with "Invalid token" even though refresh was attempted. Post lands in failed status.
- Files: `src/core/googleTokenRefresh.js`, `src/scheduler.js` lines 498-530 (GMB publish section)
- Trigger: Token expires mid-request, refresh is called but returns error (e.g., user revoked access)
- Workaround: Reconnect Google account via Integrations page
- Fix approach: Add explicit check before GMB publish: if refresh fails, update `gmb_enabled=0` and SMS manager to reconnect instead of leaving post in failed state.

**Media proxy URL encoding edge case:**
- Symptoms: Twilio MMS URLs with special characters (e.g., `&`) may be double-encoded when passed through `/api/media-proxy?url=...`
- Files: `src/routes/manager.js` line 31, `src/routes/analytics.js` line 56, `src/routes/postQueue.js` line 21, `server.js` line 298-301
- Trigger: Send MMS with URL-unsafe filename; view in dashboard
- Workaround: URLs typically work despite double-encoding (Twilio is lenient)
- Fix approach: Verify proxy endpoint tests with URLs containing special chars. Use `URL` API to normalize.

**Availability post timezone edge case:**
- Symptoms: Availability posts scheduled outside salon's posted window are silently rescheduled, but stylist is not notified of the new time.
- Files: `src/scheduler.js` lines 93-115 (nextScheduledWindow), `src/core/zenotiSync.js` (availability post generation)
- Trigger: Stylist requests availability post at 8:45pm but salon posts until 8pm only
- Workaround: Post appears next morning; stylist can check dashboard
- Fix approach: When availability post is rescheduled due to window, send SMS to stylist: "Your availability will post tomorrow at 9:00am" instead of silently queuing it.

---

## Security Considerations

**ENCRYPTION_KEY environment variable missing in some environments:**
- Risk: `src/core/encryption.js` requires `SALON_POS_ENCRYPTION_KEY` env var for AES-256-GCM. If unset, all encrypt/decrypt calls throw. Integration credentials are stored in plaintext fallback.
- Files: `src/core/encryption.js` line 5, `src/routes/integrations.js` (where decrypt is called)
- Current mitigation: App logs "ENCRYPTION_KEY not set" and throws on first integration save attempt. Blocks flow but doesn't leak data.
- Recommendations: (1) Add ENCRYPTION_KEY to Render env vars NOW (generate with `openssl rand -hex 32`). (2) Add startup check in `server.js` that refuses to start if ENCRYPTION_KEY is missing. (3) Document this in deployment runbook.

**Media proxy lacks MIME type validation:**
- Risk: `/api/media-proxy?url=...` endpoint accepts any Twilio URL and proxies the response. If Twilio URL serves HTML or script, it could be reflected back to browsers.
- Files: `server.js` lines 297-328
- Current mitigation: Regex check `!/^https:\/\/api\.twilio\.com/i.test(rawUrl)` ensures only Twilio URLs are proxied. Twilio itself enforces MIME types. Low risk.
- Recommendations: Add explicit MIME type whitelist: only allow `image/*`, `video/*`. Reject `text/html`, `application/json`, etc. with 400 error.

**Audit log data might contain sensitive info:**
- Risk: `src/core/auditLog.js` logs `ip_address`, `user_agent`, and `metadata` JSON to `security_events` table. Metadata may include old/new values of sensitive fields.
- Files: `src/core/auditLog.js`, `src/routes/managerAuth.js` (logging calls)
- Current mitigation: Only core auth events are logged; integration connect/disconnect are not yet logged.
- Recommendations: Never log plaintext API keys or tokens in metadata. If logging password reset, use hash for comparison only, never store plaintext. Audit the logging calls periodically.

**INTERNAL_SECRET protected but not rotated:**
- Risk: `/internal/vendors` endpoint requires `INTERNAL_SECRET` env var. If leaked, attacker can set arbitrary salon plans and delete campaigns.
- Files: `src/routes/internal.js`, `server.js` (route mounting)
- Current mitigation: Endpoint is not linked from any UI; URL-only access. `INTERNAL_PIN` is a secondary factor (session-based, not secret).
- Recommendations: Add rotation mechanism. Endpoint should log all changes to `security_events`. Consider rate-limiting even with valid secret.

**Session fixation incomplete:**
- Risk: `session.regenerate()` is called on login in some paths but not all. A compromised session token could be reused across account switches.
- Files: `src/routes/managerAuth.js` (verify all login paths call regenerate), `src/routes/manager.js` (location switch does NOT regenerate)
- Current mitigation: Session stores `manager_id`, `salon_id`, `group_id`. Switching location updates `salon_id` but doesn't regenerate.
- Recommendations: Call `session.regenerate()` on every location switch. Test by logging in, switching location, verifying new session token issued.

---

## Performance Bottlenecks

**Celebration scheduler daily scan not indexed:**
- Problem: `src/core/celebrationScheduler.js` does daily full table scan on `stylists` table for birthday/anniversary matches. If thousands of stylists exist, this is O(n).
- Files: `src/core/celebrationScheduler.js` (birthday/anniversary queries)
- Cause: SQLite queries on `birthday_mmdd` and `strftime('%m-%d', hire_date)` lack indexes
- Improvement path: Add partial indexes: `CREATE INDEX idx_birthday_mmdd ON stylists(birthday_mmdd)` and `CREATE INDEX idx_hire_date_mmdd ON stylists(hire_date)` (computed via triggers or generated columns)

**Analytics sync pulls all insights in one pass:**
- Problem: `src/core/fetchInsights.js` calls Facebook Graph API for every post published to a salon in one request (no batching). Large salons with 500+ posts sync slowly.
- Files: `src/core/fetchInsights.js` lines ~80-120
- Cause: No pagination or batching; synchronous queries block request handler
- Improvement path: Implement offset-based pagination (100 posts per request). Cache results. Run sync in background scheduler instead of request handler (already done, but could optimize further).

**Puppeteer single-process rendering serializes image generation:**
- Problem: `src/core/puppeteerRenderer.js` uses `--single-process` flag for Render Starter (512MB RAM). Concurrent image renders (availability + celebration + promotion) queue sequentially.
- Files: `src/core/puppeteerRenderer.js` lines 48 (single-process flag)
- Cause: Memory constrained; can't spawn multiple Chrome processes
- Improvement path: Monitor Render memory usage. If available, remove `--single-process`. Consider caching rendered HTML to SVG for reusable components.

**Post queue drag-drop reorder does full re-sort on every drag:**
- Problem: `/manager/queue/reorder` POST endpoint re-sorts and re-assigns all time slots for every dropped item. Large queues (100+ posts) perform 100+ DB updates.
- Files: `src/routes/postQueue.js` (reorder handler)
- Cause: No delta-only update; entire queue re-indexed
- Improvement path: Only update the two adjacent time slots (before and after the moved post). Use a transaction to ensure atomicity.

---

## Fragile Areas

**Message router attachment/retry logic:**
- Files: `src/core/messageRouter.js` lines 300-450 (photo handling), `src/core/storage.js` (draft storage)
- Why fragile: Complex branching for draft vs pending vs published states. Multiple in-memory caches (drafts Map, joinSessions). Stylist edits (REDO, EDIT) restart logic mid-flow. Race condition if stylist submits APPROVE while AI is still generating.
- Safe modification: (1) Add comprehensive logging at every state transition. (2) Test all branches: new photo, redo, edit, approve, cancel with stylist fixtures. (3) Verify draft is deleted after publish or explicit cancel.
- Test coverage: Missing tests for: REDO loop, EDIT mid-generation, concurrent APPROVE, timeout during generation

**Scheduler retry logic with multiple publishers:**
- Files: `src/scheduler.js` lines 412-569 (publish and catch/retry)
- Why fragile: FB publish success doesn't guarantee IG success. If FB succeeds but IG fails, post is marked published even though IG is missing. Retry on failure resets status to `manager_approved` but may reattempt FB (re-publish).
- Safe modification: (1) Publish FB and IG independently with separate error handling. (2) Track which platforms succeeded in post `success_platforms` field. (3) On retry, only attempt failed platforms.
- Test coverage: Missing tests for: FB success + IG failure, both fail, GMB fails independently, retry correctness

**Zenoti integration token management:**
- Files: `src/core/googleTokenRefresh.js`, `src/routes/integrations.js`, `src/core/zenotiSync.js`
- Why fragile: Three different integration patterns (Zenoti key, Google OAuth with refresh, Facebook token). Token refresh is ad-hoc (called before publish). If refresh fails, entire publish fails.
- Safe modification: (1) Centralize token refresh to one utility called on scheduler startup. (2) Separate "connection test" from "token valid" checks. (3) Add exponential backoff for failed refreshes.
- Test coverage: Missing tests for: token expiry mid-publish, refresh failure, connection retest

**Image background fallback chain:**
- Files: `src/core/buildAvailabilityImage.js` lines ~40-120, `src/core/buildPromotionImage.js` similar
- Why fragile: 5-level fallback chain (stylist photo → stylist stock → salon stock → Pexels → solid color). If any fetch fails, tries next. But Pexels can timeout, leaving solid fallback. Hard to debug which fallback was used in production.
- Safe modification: (1) Log which level was used in each generated image. (2) Add fallback type to posts table so can retry with different strategy. (3) Pre-fetch Pexels on background scheduler, cache results.
- Test coverage: Missing tests for: Pexels timeout, Pexels 429 rate limit, all stocks empty, image fetch 404

---

## Scaling Limits

**SQLite concurrent writes under high load:**
- Current capacity: ~10-20 concurrent managers posting, ~100 posts/day scheduler throughput
- Limit: WAL file grows unbounded; checkpoint operations lock. At 10,000 posts/month (large salon), sync overhead increases. Beyond ~50,000 posts in DB, query performance degrades (no query optimization).
- Scaling path: (1) Profile with 1M posts in staging. (2) Add indexes on frequently queried columns (`salon_id`, `published_at`, `stylist_name`). (3) Archive old posts to separate table. (4) If needed, migrate to PostgreSQL.

**Twilio SMS throughput:**
- Current capacity: Twilio's sandbox account allows ~100 SMS/day. Production account allows burst up to ~1000/day.
- Limit: Each post approval SMS + failure SMS + availability SMS uses quota. Celebration scheduler sends 1 SMS per birthday. If 10 salons go live simultaneously, quota exhausted quickly.
- Scaling path: (1) Purchase dedicated phone number for each region. (2) Add SMS queuing (don't send immediately; batch by salon/stylist). (3) Monitor account usage dashboard. (4) Consider fallback to email for non-urgent comms.

**OpenAI API rate limits:**
- Current capacity: Free tier allows ~3 requests/min. Production tier (~$0.03 per post) allows ~10k/month for typical pricing tier.
- Limit: Peak posting (celebrations + vendor posts) could hit rate limits. No queueing; immediate failure → post lands in draft.
- Scaling path: (1) Add exponential backoff + retry queue. (2) Implement OpenAI batch processing API for non-urgent captions. (3) Monitor usage; set alerts at 70% quota. (4) Consider fallback to cheaper Claude model.

**Puppeteer rendering memory:**
- Current capacity: Render Starter (512MB total). Single Chrome process in memory ~100MB, per page ~10MB. Max ~5 concurrent renders before OOM.
- Limit: Celebration scheduler + availability + vendor posts all generate images simultaneously. OOM crash → posts queued but never published.
- Scaling path: (1) Upgrade to Render Standard (2GB). (2) Implement render queue with max 3 concurrent. (3) Pre-render on scheduler tick (off-request).

---

## Dependencies at Risk

**Puppeteer version mismatch with Chromium:**
- Risk: Puppeteer auto-downloads Chromium on install. Version pinning is strict. If `package-lock.json` is out of sync with actual install, rendering silently fails.
- Impact: Availability and celebration images don't generate; posts publish without images.
- Migration plan: (1) Pin Puppeteer to major version (e.g., `puppeteer@^23.0.0`). (2) Add `npm ci` in Render build script (use lock file, not package.json). (3) Test image generation on staging after every deploy.

**OpenAI Node.js SDK breaking changes:**
- Risk: OpenAI SDK is actively maintained. API surface changed in v4. Code uses direct fetch calls (safe) but future integration might break.
- Impact: Caption generation stops working if fetch payload format changes.
- Migration plan: (1) Consider using official OpenAI SDK instead of raw fetch (but adds dependency). (2) Pin to major version. (3) Test API calls monthly on staging.

**Zenoti API versioning:**
- Risk: Zenoti is SaaS-only. API version changes without notice. Response format for endpoints (employees, appointments, services) varies.
- Impact: Availability sync fails if Zenoti changes endpoint response format.
- Migration plan: (1) Add version detection in zenoti.js (check API version endpoint). (2) Implement response normalizer to handle multiple formats. (3) Monitor Zenoti status page; set alerts. (4) Communicate schema changes to customers proactively.

**better-sqlite3 Node.js version coupling:**
- Risk: better-sqlite3 is a native module. Compiled against specific Node.js version. Mismatches cause runtime crashes.
- Impact: If Render upgrades Node, app crashes on DB access.
- Migration plan: (1) Pin Node.js version in `.nvmrc` and Render `.render.yaml`. (2) Test DB access after any Node.js version change. (3) Use `npm ci` in CI/CD to lock binary versions.

---

## Missing Critical Features

**No integration event webhooks:**
- Problem: Zenoti webhook receiver exists but doesn't process events. Vagaro has no integration at all. Availability is poll-based (every stylist request), not real-time.
- Blocks: Real-time availability updates, automated posting of newly available slots
- Fix approach: Implement `handleZenotiEvent()` in `src/core/integrationHandlers.js` to process `appointment.booked`, `appointment.cancelled`, `appointment.updated` events. Queue availability post generation on events.

**No fallback SMS delivery for password reset:**
- Problem: Password reset link logged to console, not sent to manager.
- Blocks: Managers can't recover forgotten passwords in production
- Fix approach: Wire `sendViaTwilio()` to deliver reset link via SMS (already integrated for other flows).

**No background job queue for async tasks:**
- Problem: Email, SMS, image generation, API calls are synchronous within request handlers. Slow operations block manager requests.
- Blocks: Scalability beyond ~10 concurrent managers
- Fix approach: Implement job queue (Bull.js, Inngest, or cron-based) for: email delivery, SMS, image generation, analytics sync.

---

## Test Coverage Gaps

**Authentication flow not tested:**
- What's not tested: Login (email+password), MFA (TOTP + backup codes), password reset, session regeneration, CSRF protection
- Files: `src/routes/managerAuth.js` (~1000 lines, 0 tests)
- Risk: Regressions in auth break manager access entirely
- Priority: High

**Scheduler and post publishing not tested:**
- What's not tested: Enqueue post, publish to FB/IG, retry on failure, rate limiting, daily caps, stylist fairness, timezone handling
- Files: `src/scheduler.js` (~800 lines, 0 tests)
- Risk: Publishing breaks silently; posts stuck in failed state
- Priority: High

**Manager IDOR checks not tested:**
- What's not tested: Verify salon_id parameter on all POST endpoints; ensure manager from salon A can't edit salon B's posts
- Files: `src/routes/manager.js`, `src/routes/admin.js` (60+ endpoints combined, 0 IDOR-specific tests)
- Risk: Cross-salon data access vulnerability
- Priority: Critical

**Integration (Zenoti, Google, Facebook) flows not tested:**
- What's not tested: OAuth flow, token refresh, credential encryption, publish to integrated platforms
- Files: `src/routes/integrations.js`, `src/routes/googleAuth.js`, `src/core/googleTokenRefresh.js` (500+ lines, 0 tests)
- Risk: Integration connects but data sync fails; credentials may be exposed in plaintext
- Priority: High

**Vendor scheduler not tested:**
- What's not tested: Vendor post enqueueing, hashtag tiers, category filtering, affiliate URL injection, client renewal
- Files: `src/core/vendorScheduler.js` (300+ lines, 0 tests)
- Risk: Vendor posts don't queue or publish with incorrect URLs
- Priority: Medium

**Payment flow not tested:**
- What's not tested: Stripe checkout, webhook handlers, plan enforcement, seat limits, trial enforcement
- Files: `src/routes/billing.js`, `src/routes/locations.js` (600+ lines, 0 tests)
- Risk: Payment flow breaks; customers not charged or over-charged
- Priority: Critical

---

*Concerns audit: 2026-03-19*
