# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- Route handlers: camelCase (`manager.js`, `twilio.js`, `admin.js`)
- Core logic: camelCase (`messageRouter.js`, `composeFinalCaption.js`, `buildAvailabilityImage.js`)
- Utilities: camelCase (`trackingUrl.js`, `utm.js`, `fontLoader.js`)
- Publishers: directory name + subject (`facebook.js`, `instagram.js`, `googleBusiness.js`)
- Test files: match source module name with `.test.js` suffix (`composeFinalCaption.test.js`, `rcs.test.js`)

**Functions:**
- Async functions: camelCase action verbs (`sendViaTwilio`, `fetchPexelsBackground`, `publishToFacebook`)
- Helper functions: camelCase descriptive (`normalizeHashtags`, `resolveImageUrl`, `withinPostingWindow`)
- Nested/private functions: plain camelCase, can use leading underscore for "private" intent (`_mergeHashtags`, `_lookupStylist`)
- Validator functions: prefix with `is` or `has` (`isAvailabilityRequest`, `hasDateHint`, `isStoryOnly`)

**Variables:**
- Constants: UPPER_SNAKE_CASE (`FEED_TYPES`, `PLAN_LIMITS`, `POOL_TTL_MS`, `MAX_HASHTAGS`)
- Database prepared statements: camelCase suffix with `Stmt` (`insertPostStmt`, `updatePostStmt`)
- State/config maps: camelCase plural nouns (`drafts`, `availabilityPool`, `manager_tokens`)
- Timestamps/dates: suffix with `At` or `_at` (`published_at`, `created_at`, `syncedAt`)
- Schema columns: snake_case throughout (follows SQLite convention: `salon_id`, `manager_id`, `post_type`, `instagram_handle`)

**Types:**
- Enum-like sets: camelCase (`FEED_TYPES`, `LUXON_WEEKDAYS`)
- Objects representing domain models: PascalCase rarely used; instead use descriptive lowercase keys in objects

## Code Style

**Formatting:**
- No formatter (Prettier/ESLint not configured)
- Consistent indentation: 2 spaces
- Line breaks: Unix (LF)
- Max line length: no hard limit observed; lines up to 120 chars are common

**Linting:**
- No linter configured (no `.eslintrc`, no ESLint in devDeps)
- No Prettier config
- Manual consistency enforced via code review

**Semicolons:**
- Semicolons present throughout; not strictly required in ES modules but used consistently

## Import Organization

**Order:**
1. Node.js built-ins (`crypto`, `fs`, `path`)
2. Third-party packages (`express`, `luxon`, `twilio`, `openai`)
3. Database and core utilities (`db.js` from project root or via alias)
4. Domain imports (same project, organized by domain: `./core/`, `./routes/`, `./publishers/`)
5. UI/components (`../ui/pageShell.js`)
6. Utils and helpers (`../utils/moderation.js`)

**Style:**
- Always ESM syntax: `import`/`export`, never `require()`
- Explicit imports: import only what is used; no wildcard imports
- Multi-import grouping allowed when logically related:
  ```javascript
  import { publishToFacebook, publishToFacebookMulti } from "./publishers/facebook.js";
  ```
- Relative path to project root uses `../../db.js` (depth-aware)
- No import aliases or path mapping configured; explicit relative paths used throughout

## Error Handling

**Patterns:**
- All external API calls wrapped in try/catch:
  ```javascript
  try {
    const resp = await client.messages.create(opts);
    console.log(`[Twilio] Success: ${resp.sid}`);
  } catch (err) {
    console.error("⚠️ [Twilio Send Error]:", err.message);
    // Fire-and-forget: never throw, return gracefully
  }
  ```
- Silent fallbacks on error (no user-facing error thrown):
  - Twilio send: logs error, silently continues
  - OpenAI caption: returns template fallback
  - Image generation: uses solid color fallback
  - Tracking URL injection: falls back to raw URL without tracking token
- Database calls: wrapped in try/catch when selecting computed values; defaults provided on failure
- No promise rejections left unhandled: `.catch()` attached to every fire-and-forget async call
- Error messages logged with context (module name, operation, input if safe):
  ```javascript
  console.error("[Admin] Brand extraction failed:", err.message);
  ```
- User-facing errors: translated via `postErrorTranslator.js` (raw API errors → plain English)

## Logging

**Framework:** Plain `console` (no logging library)

**Patterns:**
- Prefix each log with context: `[Module]` or `[Feature]`
  - `[Twilio]`, `[Router]`, `[Admin]`, `[Scheduler]`, `[Portal]`
- Log levels via emoji or prefix:
  - ✅ success (`[Twilio] ✅ Message sent`)
  - ⚠️ warning/error (`⚠️ [Twilio Send Error]`)
  - ❌ critical failure (`[Twilio] ❌ Invalid signature`)
  - 🔍 debug/validation (`[Twilio] 🔍 Validating signature`)
  - ⏱ timing (`⏱ handleIncomingMessage: 245.32ms`)
  - 🔔 webhook receive (`🔔 [Twilio] Webhook: ...`)
- Log early/often for debugging; include request IDs or identifiers when available
- Console statements left in production code (used for observability in Render logs)
- Performance timers using `performance.now()`:
  ```javascript
  const start = performance.now();
  // ... do work ...
  const elapsed = (performance.now() - start).toFixed(2);
  console.log(`⏱ operation: ${elapsed}ms`);
  ```

## Comments

**When to Comment:**
- Complex algorithms or business logic (e.g., `withinScheduleWindow` scheduling logic)
- Non-obvious parsing/validation (e.g., hashtag normalization edge cases)
- Workarounds or legacy compatibility notes (e.g., "fallback to plain-text fallback")
- Section headers for readability (e.g., `// --- 1️⃣ Caption body ---`)
- Platform-specific quirks (e.g., "Facebook Graph API v22.0 requires long-lived user token")
- Never comment obvious code (e.g., `const name = row.name; // get the name`)

**JSDoc/TSDoc:**
- Used sparingly; present in a few core utilities
- Pattern: block comment at function definition with param and return type info:
  ```javascript
  /**
   * Internal: fetch all open blocks for one stylist and return raw block objects.
   * Used by both the pool sync and the direct per-stylist fetch.
   *
   * @returns {Promise<{ label: string, dateStr: string, blockStart: Date }[]>}
   */
  async function fetchRawBlocks({ client, centerId, stylist, salon, dateRange }) { }
  ```
- No requirement for 100% JSDoc coverage

**Comment Emoji:**
- ✅ confirmation/success
- ⚠️ warning
- ❌ error/critical
- 🔍 debug/inspect
- ⏱ performance/timing
- 🔔 webhook/event
- 📦 export/public API
- 🧱 internal/helper
- 💾 database
- 🌐 external API
- Used in file headers: `// ✅ Unified caption builder ...`

## Function Design

**Size:**
- Small, focused functions: 20–60 lines is typical
- Helpers extracted from large functions (e.g., `prettifyBody` in `messageRouter.js`)
- Router handlers can exceed 100 lines when they compose multiple operations (e.g., admin.js post handlers)

**Parameters:**
- Named parameters via object destructuring for 3+ args:
  ```javascript
  export function composeFinalCaption({
    caption,
    hashtags = [],
    platform = "generic",
    salonId = null,
    // ... more params
  }) { }
  ```
- Defaults provided inline via destructuring
- Array/object parameters always destructured; no mutation expected

**Return Values:**
- Explicit return statements; no implicit undefined
- Functions return either data (for queries) or void (for side effects)
- Error conditions: silently return null/empty/fallback value; never throw to caller unless critical
- Async functions always return Promise (explicit `async` keyword)

## Module Design

**Exports:**
- Export named functions: `export function getName() { }`
- Export constants: `export const PLAN_LIMITS = { ... }`
- Rarely default-export; only used for route factory functions:
  ```javascript
  export default function twilioRoute(drafts, lookupStylist, generateCaption) { }
  ```
- All core domain exports are named exports

**Barrel Files:**
- Not used; each module imports directly from source file
- No `index.js` re-export pattern

**File Responsibilities:**
- One domain per file (e.g., `composeFinalCaption.js` handles caption composition only)
- Route files handle HTTP concerns; import domain logic from `src/core/`
- Publishers (`src/publishers/`) handle only API calls to external platforms
- Core logic (`src/core/`) never imports route handlers (one-way dependency)

**Globals:**
- Database connection (`db`) imported from `db.js` — single instance used throughout
- Environment variables (`process.env`) read directly; no centralized config object
- No global state except stateless constants and prepared statements

## Database Patterns

**Queries:**
- Always use parameterized statements (`db.prepare()` with `?` placeholders or named `@param`):
  ```javascript
  const row = db.prepare(`SELECT * FROM salons WHERE slug = ?`).get(salonId);
  const result = db.prepare(`INSERT INTO posts (...) VALUES (@id, @salon_id, ...)`).run(params);
  ```
- No string interpolation for SQL (prevents injection)
- Synchronous calls only: `better-sqlite3` is synchronous; no `await` on DB calls
- Prepared statements cached: `db.prepare()` is called once, then `.get()` / `.run()` / `.all()` used multiple times
- Transactions for multi-step operations:
  ```javascript
  const tx = db.transaction((data) => {
    db.prepare(`UPDATE posts SET status = ? WHERE id = ?`).run('published', id);
    db.prepare(`INSERT INTO post_insights (...) VALUES (...)`).run(insights);
  });
  tx(dataPayload);
  ```

**Multi-Tenancy:**
- Every query that touches salon data includes `WHERE salon_id = ?` filter tied to `req.session.salon_id`
- Never trust user-supplied `salon_id` from request body; always use session value
- IDOR prevention: test every new route by changing an ID parameter to verify access denial

**Row Naming:**
- Database columns use snake_case (`salon_id`, `created_at`, `manager_id`)
- JavaScript variables use camelCase when destructured: `const { salon_id: salonId } = row;` (optional)
- Sometimes snake_case is kept inline for SQL legibility: `row.salon_id` is common

## HTML Rendering

**Server-Side Rendering:**
- All pages rendered via `pageShell.js` helper (no client framework)
- HTML constructed as template strings with `${...}` interpolation
- Escaping: `esc()` helper used for all user-facing strings in HTML:
  ```javascript
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
  ```
- CSS: Tailwind CDN; no build step
- Inline styles rare; Tailwind classes preferred

## Testing Patterns (High-Level)

See TESTING.md for detailed test conventions.

**Quick summary:**
- Vitest framework
- Mocking: `vi.mock()` for module-level, `vi.fn()` for function stubs
- Test files co-located in `tests/` directory (not alongside source)
- Unit tests focus on pure functions and clear contracts
- No integration tests for external APIs (mocked)

---

*Convention analysis: 2026-03-19*
