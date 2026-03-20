# Phase 5: Guest Care and Support Staff - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A "Coordinator" role (receptionist / front-desk / guest care) can submit posts on behalf of stylists via both SMS and the portal. The system extracts the stylist name from the coordinator's message text, sends a portal link to confirm the attribution, and attributes the post to the named stylist. Coordinators get their own leaderboard tab on the Performance page, earn 50% of base post points for each post they submit, and receive a tailored welcome SMS when added.

The `coordinator` role already exists in the `managers` table with a restricted portal nav. This phase adds: SMS posting capability, stylist-attribution flow, leaderboard scoring, flood protection, and a welcome SMS.

</domain>

<decisions>
## Implementation Decisions

### How Coordinators Submit Posts
- **Both SMS and portal** — coordinator can text photos from their phone OR upload via the portal
- **SMS flow (name present)**: Coordinator texts a photo with caption mentioning a stylist name (e.g. "Taylor did this balayage on a new client") → GPT extracts the stylist name → system fuzzy-matches against salon's stylists → coordinator receives a portal link to confirm the match → post enters the standard approval queue under the matched stylist's name
- **SMS flow (no name found)**: Single SMS reply: "Who is this for?" — coordinator replies with the stylist name, then the flow continues as above. One SMS only — not a back-and-forth.
- **Portal upload**: Coordinator can also upload a photo directly in the portal with a stylist dropdown to select attribution up front
- **Minimize SMS round-trips**: The name-in-text approach is the primary path; the "Who is this for?" fallback fires only when no stylist name can be extracted

### Stylist Attribution in Portal
- **Portal approval card**: Stylist dropdown at the TOP of the card (before the caption), pre-filled with the GPT-extracted match
- Coordinator confirms or changes the attributed stylist before the post is submitted
- **Manager approval view**: Small badge on post cards: "Submitted by [Coordinator Name] on behalf of [Stylist]" — visible in both the approval queue and the Database view
- Manager can still change the attributed stylist from the manager approval view

### Data Model
- New column on `posts` table: `submitted_by` (FK → managers.id) — set when a coordinator submits via SMS or portal; NULL for stylist-submitted posts
- `stylist_name` on the post remains the attributed stylist (the one featured) — no change to how the existing leaderboard query works
- Coordinator's phone number stored in `managers.phone` — used for Twilio routing; phone is REQUIRED when creating a coordinator

### Points Scoring — 50/50 Split
- **Stylist leaderboard (existing)**: Unchanged — points computed from `posts.stylist_name` as today; coordinator-submitted posts still appear under the stylist's name for full credit
- **Coordinator leaderboard (new)**: Coordinators earn 50% of the base post point value for every post they submit (`submitted_by = coordinator.id`). Computed in a new `getCoordinatorLeaderboard()` function in `gamification.js`
- Example: standard_post = 10 pts; stylist gets 10 pts in stylist leaderboard, coordinator gets 5 pts in coordinator leaderboard

### Flood Protection
- **Visual warning only** — no hard block
- When a coordinator selects a stylist in the portal approval flow (or the "Who is this for?" SMS response triggers the portal link), if more than 3 coordinator-submitted posts for that stylist exist in the last 7 days, show an inline warning: "You've posted a lot for [Stylist] recently — consider spreading it around"
- Threshold: 3 posts per stylist per 7-day rolling window (Claude's discretion to adjust if needed)

### Leaderboard UI
- **Tab toggle on the existing Performance page** (`/manager/performance`) — "Stylists" tab (existing) and "Coordinators" tab (new)
- Coordinator leaderboard shows: rank, name, posts submitted, points earned
- Coordinators see this page (it's visible in their nav since it's not restricted by `isCoordinator` gate today — verify)

### Welcome SMS for Coordinators
- **Phone number is required** when adding a coordinator (validation in the add form)
- Welcome SMS text: "You've been added as a coordinator at [Salon]. To post for a stylist, text a photo and include their name (e.g. 'Taylor did this color'). Reply HELP for guidance."
- New exported function `sendCoordinatorWelcomeSms(coordinator, salonName)` in `src/core/stylistWelcome.js`
- Called after coordinator row is inserted in `stylistManager.js`

### Claude's Discretion
- GPT model for stylist name extraction (GPT-4o-mini is sufficient — same pattern as Reputation Manager review name extraction)
- Fuzzy matching threshold for stylist name → exact implementation
- Flood protection threshold (default: 3 posts per 7 days)
- Whether to create a new migration or add `submitted_by` to the existing posts migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing coordinator role infrastructure
- `src/routes/stylistManager.js` — Coordinator creation (POST /add), portal seat limits, `buildTeamMemberForm()` — add phone requirement + welcome SMS call here
- `src/ui/pageShell.js` — `isCoordinator` flag and restricted nav — verify which pages coordinators can see; Performance page must be visible to coordinators
- `src/routes/billing.js` — `PLAN_LIMITS` — coordinator + manager share the same `managers` seat limit

### Gamification & leaderboard
- `src/core/gamification.js` — `getLeaderboard()`, `getPointValue()`, `DEFAULT_POINTS` — new `getCoordinatorLeaderboard()` goes here; points use 50% of `getPointValue()` result
- `src/routes/teamPerformance.js` — Performance page with leaderboard table — add Stylists/Coordinators tab toggle here

### Message routing (SMS flow)
- `src/routes/twilio.js` — `sendViaTwilio()`, MMS handling — coordinator phone detection added here (check `managers` table for phone match before `stylists` table)
- `src/core/messageRouter.js` — `handleIncomingMessage()` — coordinator branch: detect coordinator sender, extract stylist name via GPT, send portal confirm link
- `src/core/salonLookup.js` — Stylist/salon phone lookup — coordinator lookup needs to also check `managers` table when phone not found in `stylists`

### Welcome SMS
- `src/core/stylistWelcome.js` — `sendWelcomeSms()` — add `sendCoordinatorWelcomeSms()` here following the same pattern

### Portal approval UI
- `src/routes/manager.js` — Manager approval view where post cards are rendered — add "submitted by" badge for coordinator-submitted posts
- `src/routes/stylistPortal.js` — Coordinator portal approval URL — add stylist dropdown at top of approval card

### DB schema
- `migrations/` — next migration number (check current highest); add `submitted_by TEXT REFERENCES managers(id)` to `posts` table
- `src/core/storage.js` — `savePost()` — pass `submitted_by` through when a coordinator creates a post

### No external specs — requirements for this phase are fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendViaTwilio()` in `twilio.js` — coordinator's "Who is this for?" single-SMS fallback uses this
- `getLeaderboard()` in `gamification.js` — coordinator leaderboard is a parallel function; existing function unchanged
- `getPointValue()` in `gamification.js` — coordinator leaderboard uses `getPointValue() * 0.5` for point calculation
- `sendWelcomeSms()` in `stylistWelcome.js` — coordinator welcome SMS follows the same structure; add as a new export
- `buildTeamMemberForm()` in `stylistManager.js` — add phone as required field and coordinator-specific instructions

### Established Patterns
- DB is synchronous (`better-sqlite3`) — no `await` on DB calls
- `salon_id` scoped to `req.session.salon_id` on all queries
- `managers` table already has `phone` column — coordinator phone stored there
- Coordinator role already in DB: `role = 'coordinator'` in `managers` table
- `getLeaderboard()` groups by `stylist_name` in posts — coordinator leaderboard groups by `submitted_by` → managers.name
- Post attribution in captions: `posts.stylist_name` is what downstream caption logic and leaderboard use; this stays unchanged

### Integration Points
- `src/routes/twilio.js` — add coordinator phone lookup before falling through to stylist lookup
- `src/core/messageRouter.js` — add coordinator branch (similar structure to video branch in Phase 3)
- `src/core/salonLookup.js` — extend phone lookup to check `managers` table for coordinator role
- `src/routes/stylistPortal.js` — coordinator portal approval needs stylist dropdown + flood warning
- `src/routes/teamPerformance.js` — add Stylists/Coordinators tab toggle with `?view=coordinators` param
- `src/core/gamification.js` — new `getCoordinatorLeaderboard(salonId, period)` function
- `src/routes/stylistManager.js` — POST /add coordinator path: enforce phone required, call `sendCoordinatorWelcomeSms`
- Next migration — `submitted_by TEXT` column on `posts`

</code_context>

<specifics>
## Specific Ideas

- **SMS instruction pattern**: "Taylor did this beautiful balayage on a new client" → extract "Taylor" → fuzzy match against salon's stylists → portal confirmation link. Same GPT name-extraction pattern already built for Reputation Manager (Phase 4) — reuse or model after that approach.
- **Portal flood warning**: Inline amber/yellow info box at the top of the coordinator's stylist dropdown: "You've posted X times for [Stylist] in the last 7 days — consider capturing content for other team members too." Only shows when threshold exceeded.
- **50/50 split**: The stylist leaderboard is unchanged (full credit by stylist_name as today). The coordinator leaderboard is an additional view, calculated separately — no modification to the existing leaderboard query.
- **"Submitted by" badge**: Subtle — a small gray/muted line below the post thumbnail in approval view: "📸 via [Coordinator Name]". Doesn't change approval flow.

</specifics>

<deferred>
## Deferred Ideas

- **Coordinator "who to photograph next" recommendations** — Coordinator sees a suggestion in their portal: "Mia hasn't had a post this week — consider capturing her work." New capability, worth building in a follow-up phase or quick task.

</deferred>

---

*Phase: 05-guest-care-and-support-staff*
*Context gathered: 2026-03-20*
