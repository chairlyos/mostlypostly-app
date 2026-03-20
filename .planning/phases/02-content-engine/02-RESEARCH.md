# Phase 2: Content Engine - Research

**Researched:** 2026-03-19
**Domain:** Scheduler enhancement, content recycler, SQLite query patterns, Express route patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cadence Enforcement**
- `pickNextPost()` applies to the whole queue — all approved posts, recycled and new alike
- If the ideal content type isn't in queue, fall back to the next available type — never stall publishing just because a specific type is missing
- If the queue is completely empty, hold — do not recycle until trigger conditions are met (queue depth < 3 AND 48hr since last publish)

**Recycle Trigger and Dashboard Notice**
- Auto-recycle fires when: queue depth drops below 3 posts AND no publish in the last 48 hours
- Dashboard notice: subtle inline info banner at the top of the manager dashboard — "X posts were auto-recycled this week" with a link to Database view. Non-blocking and dismissible.
- Undo = delete the recycled copy. The original published post is untouched. Manager can trigger undo from the dashboard notice link or from Database view.

**Caption Refresh on Recycle (Plan-Gated)**
- Starter plan: recycled posts always reuse the original caption verbatim — no AI refresh
- Growth/Pro plans: per-salon "refresh caption on recycle" toggle available in Admin settings, off by default
- Caption refresh toggle only renders in Admin UI for Growth/Pro salons
- When refresh is on: refreshed recycled post follows the existing `auto_publish` salon setting — no new approval concept

**Manual Recycle and Block Flag (Database View)**
- Both actions live inline on each published post row in Database view — a Recycle button and a Block toggle/icon
- Manual recycle follows the same approval flow as auto-recycle — same clone-and-enqueue path
- Block flag sets `block_from_recycle = 1` on the post

### Claude's Discretion
- Exact SQL query for recycle candidate ranking (reach DESC from post_insights, excluding 45-day recycle cooldown)
- SMS notification copy for manager when auto-recycle fires
- Block flag visual treatment (toggle vs icon vs checkbox)
- Migration numbering (next in sequence after 047)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RECYC-01 | Auto-trigger recycling when queue depth < threshold AND last publish > 48 hours ago | `runSchedulerOnce()` integration point confirmed; queue depth query pattern identified |
| RECYC-02 | Select candidates from posts published in past 90 days, ranked by reach DESC | `post_insights` table has `reach` column; JOIN pattern documented |
| RECYC-03 | Exclude posts recycled in last 45 days and `block_from_recycle` posts | New column `block_from_recycle` on `posts` table; `recycled_at` tracking via `recycled_from_id` FK |
| RECYC-04 | Enforce post_type distribution — do not recycle same type twice in a row | Last-published type lookup query documented |
| RECYC-05 | Optionally refresh caption via GPT-4o rewrite at recycle time (per-salon toggle) | OpenAI import pattern from `openai.js` confirmed; plan gate via `PLAN_LIMITS` |
| RECYC-06 | Recycled posts cloned as new rows with `recycled_from_id` FK, enqueued via `enqueuePost()` | `enqueuePost()` signature confirmed; INSERT pattern documented |
| RECYC-07 | Manager receives SMS notification when auto-recycle fires | `sendViaTwilio()` pattern confirmed from twilio.js |
| RECYC-08 | Manager can toggle auto-recycle on/off per salon in Admin settings | `auto_publish` / `require_manager_approval` toggle pattern confirmed in admin.js |
| RECYC-09 | Manager can flag individual published posts as "block from recycling" in Database view | Row-level action pattern confirmed in dashboard.js |
| RECYC-10 | Manager can manually trigger recycle on any published post via Recycle button | Same row-level action pattern; same clone-and-enqueue path |
| RECYC-11 | Dashboard shows notice when posts were auto-recycled this week with link to view/undo | `failedBanner` pattern from manager.js — inline banner at top of dashboard |
| SCHED-01 | `pickNextPost()` selects from pending queue by content-type weight based on last 7 published posts | Last-7 lookup query and weighted selection logic documented |
| SCHED-02 | Scheduler enforces 50–60% standard portfolio posts across 7-day rolling window | Rolling window query using `published_at` and `post_type` COUNT |
| SCHED-03 | Scheduler enforces 15–20% before/after posts, preferred Tue–Thu | Luxon weekday detection already exists in scheduler; pattern documented |
| SCHED-04 | Scheduler caps promotions at max 2–3/week and never back-to-back | Week count + last-published-type queries documented |
| SCHED-05 | Scheduler slots availability posts to mid-week only (Tue–Thu) | Existing `withinScheduleWindow()` / `nextScheduledWindow()` pattern reused |
| SCHED-06 | Reels count as bonus and do not displace core cadence | post_type="reel" excluded from distribution count queries |
</phase_requirements>

---

## Summary

Phase 2 adds two interlocked systems inside an existing, well-structured Express/SQLite codebase. The first system — the Content Recycler — auto-clones top-performing published posts back into the queue when the queue runs low. The second — the Intelligent Scheduler — adds `pickNextPost()` logic that enforces content-type distribution across a 7-day rolling window. Both systems must operate synchronously (better-sqlite3 is synchronous throughout) and must never stall publishing.

The codebase already provides every primitive needed. `enqueuePost()` in `scheduler.js` is the single enqueue path — recycled posts call it directly. `sendViaTwilio()` in `twilio.js` is the SMS notification path. The `post_insights` table has `reach` indexed by `post_id`. Admin toggle patterns in `admin.js` and row-level action patterns in `dashboard.js` and `manager.js` are fully established and must be followed exactly.

The migration sequence is currently at 047. The next migration is 048. It adds four columns: `block_from_recycle` and `recycled_from_id` on `posts`; `auto_recycle` and `caption_refresh_on_recycle` on `salons`.

**Primary recommendation:** Implement in four waves: (1) migration + schema, (2) recycler core logic in scheduler.js, (3) Admin and Database view UI, (4) pickNextPost() cadence enforcement. Each wave is independently deployable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | already installed | Synchronous DB queries — all recycler and scheduler logic | Project-wide; never use async DB calls |
| luxon | already installed | Timezone-aware datetime math — rolling window calculation, weekday enforcement | Already used in scheduler.js for all datetime work |
| express | already installed | Route handlers for manual recycle, block flag, undo | Already used for all routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai (via `src/core/openai.js`) | already installed | GPT-4o caption refresh on recycle | Growth/Pro plans only, when `caption_refresh_on_recycle = 1` |
| crypto | Node built-in | UUID generation for recycled post clone | Already used throughout — `crypto.randomUUID()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline recycler in scheduler.js | Separate recycler.js file | CONTEXT.md is explicit: recycler check runs inside `runSchedulerOnce()`; single file avoids import complexity |
| Weighted random selection for pickNextPost | Strict priority ordering | CONTEXT.md locks: fall back to next available type, never stall — weighted-random is fine but strict fallback is required |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new files required beyond:
```
src/
├── scheduler.js          # ADD: checkAndAutoRecycle(), pickNextPost() functions here
├── routes/
│   ├── admin.js          # ADD: auto_recycle + caption_refresh_on_recycle toggles
│   └── dashboard.js      # ADD: Recycle button + Block flag on published rows
├── routes/
│   └── manager.js        # ADD: recycle-notice banner query + dismiss route
└── migrations/
    └── 048_content_recycler.js   # ADD: new migration
```

### Pattern 1: Recycler Core — checkAndAutoRecycle(salonId)

**What:** Checks trigger conditions, selects top candidate, clones post, calls enqueuePost()
**When to use:** Called inside `runSchedulerOnce()`, after `expireStalePosts()`, before the publish loop

```javascript
// Source: scheduler.js patterns (getSalonPolicy, enqueuePost, db.prepare)
function checkAndAutoRecycle(salonId) {
  const salon = getSalonPolicy(salonId);
  if (!salon?.auto_recycle) return;  // salon-level opt-out

  // 1. Queue depth check
  const queueDepth = db.prepare(
    `SELECT COUNT(*) AS n FROM posts
     WHERE salon_id = ? AND status = 'manager_approved' AND scheduled_for IS NOT NULL`
  ).get(salonId)?.n || 0;

  if (queueDepth >= 3) return;  // queue not low enough

  // 2. Last publish check (48hr gate)
  const lastPublish = db.prepare(
    `SELECT published_at FROM posts
     WHERE salon_id = ? AND status = 'published'
     ORDER BY published_at DESC LIMIT 1`
  ).get(salonId);

  if (lastPublish?.published_at) {
    const hoursSince = DateTime.utc()
      .diff(DateTime.fromSQL(lastPublish.published_at, { zone: 'utc' }), 'hours')
      .hours;
    if (hoursSince < 48) return;  // too recent
  }

  // 3. Find top candidate (reach DESC, past 90 days, 45-day recycle cooldown)
  const candidate = db.prepare(`
    SELECT p.id, p.post_type, p.final_caption, p.base_caption, p.image_url, p.image_urls,
           p.stylist_name, MAX(pi.reach) AS best_reach
    FROM posts p
    LEFT JOIN post_insights pi ON pi.post_id = p.id
    WHERE p.salon_id = ?
      AND p.status = 'published'
      AND p.block_from_recycle = 0
      AND datetime(p.published_at) >= datetime('now', '-90 days')
      AND (
        p.recycled_from_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM posts r
          WHERE r.recycled_from_id = p.id
            AND r.salon_id = p.salon_id
            AND datetime(r.created_at) >= datetime('now', '-45 days')
        )
      )
    GROUP BY p.id
    ORDER BY best_reach DESC NULLS LAST
    LIMIT 1
  `).get(salonId);

  if (!candidate) return;  // nothing to recycle

  // 4. Clone and enqueue
  const newId = crypto.randomUUID();
  const salonPostNumber = (db.prepare(
    `SELECT MAX(salon_post_number) AS n FROM posts WHERE salon_id = ?`
  ).get(salonId)?.n || 0) + 1;

  db.prepare(`
    INSERT INTO posts (id, salon_id, stylist_name, image_url, image_urls,
      base_caption, final_caption, post_type, status,
      recycled_from_id, salon_post_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manager_pending', ?, ?, datetime('now'), datetime('now'))
  `).run(newId, salonId, candidate.stylist_name, candidate.image_url,
         candidate.image_urls, candidate.base_caption, candidate.final_caption,
         candidate.post_type, candidate.id, salonPostNumber);

  // 5. If auto_publish: enqueue directly; else leave as manager_pending
  if (salon.auto_publish) {
    enqueuePost({ ...candidate, id: newId, salon_id: salonId, status: 'manager_pending' });
  }

  // 6. SMS notification
  // (sendViaTwilio via async import — wrap in try/catch, fire-and-forget)
}
```

### Pattern 2: pickNextPost(salonId, pendingPosts)

**What:** Given pending approved posts, selects the best one to publish next based on 7-day rolling type distribution
**When to use:** Called inside `runSchedulerOnce()` to sort/select from the `due` array before publishing

```javascript
// Source: scheduler.js — getSalonPolicy, DEFAULT_PRIORITY patterns
function getRecentTypeDistribution(salonId) {
  // Last 7 published posts — returns { standard_post: 3, before_after: 2, promotions: 1, availability: 1 }
  const recent = db.prepare(`
    SELECT post_type, COUNT(*) AS cnt
    FROM posts
    WHERE salon_id = ? AND status = 'published'
    ORDER BY published_at DESC
    LIMIT 7
  `).all(salonId);
  return Object.fromEntries(recent.map(r => [r.post_type, r.cnt]));
}

function pickNextPost(posts, salonId) {
  if (!posts.length) return null;

  const dist = getRecentTypeDistribution(salonId);
  const totalRecent = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  // Target ratios
  const TARGETS = {
    standard_post:  { min: 0.50, max: 0.60 },
    before_after:   { min: 0.15, max: 0.20 },
    promotions:     { min: 0.00, max: 0.14 },  // max 2–3/week enforced separately
    availability:   { min: 0.00, max: 0.14 },  // mid-week only enforced separately
  };

  // Compute type deficits — most under-represented type wins
  const scored = posts.map(post => {
    const type = post.post_type || 'standard_post';
    if (type === 'reel') return { post, score: -1 };  // reels are bonus, lowest priority
    const target = TARGETS[type] || { min: 0, max: 0.15 };
    const current = (dist[type] || 0) / totalRecent;
    const deficit = target.min - current;  // positive = under-represented
    return { post, score: deficit };
  });

  // Sort by deficit DESC (most needed first), fall back to DEFAULT_PRIORITY index
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score;
    return getPriorityIndex(a.post.post_type, DEFAULT_PRIORITY) -
           getPriorityIndex(b.post.post_type, DEFAULT_PRIORITY);
  });

  return scored[0]?.post || posts[0];
}
```

### Pattern 3: Admin Toggle (auto_recycle, caption_refresh_on_recycle)

**What:** SELECT dropdown in the Manager Rules section of admin.js, updating `salons` table
**When to use:** Follows exact `auto_publish` / `require_manager_approval` pattern from admin.js lines 1300–1535

```javascript
// Source: admin.js — update-manager-rules POST handler pattern
// In GET /manager/admin — reads salonRow.auto_recycle, salonRow.caption_refresh_on_recycle
// In HTML — both follow the selectCls pattern:
const plan = salonRow.plan || 'trial';
const showCaptionRefresh = ['growth', 'pro'].includes(plan);

// Toggle HTML fragment (caption_refresh_on_recycle hidden for Starter/trial):
`<select name="auto_recycle" class="${selectCls}">
  <option value="0" ${sel(!salonRow.auto_recycle)}>Disabled</option>
  <option value="1" ${sel(salonRow.auto_recycle)}>Enabled</option>
</select>`

// caption_refresh_on_recycle — Growth/Pro only, wrapped in conditional:
`${showCaptionRefresh ? `
  <select name="caption_refresh_on_recycle" class="${selectCls}">
    <option value="0" ${sel(!salonRow.caption_refresh_on_recycle)}>Disabled (use original caption)</option>
    <option value="1" ${sel(salonRow.caption_refresh_on_recycle)}>Enabled (refresh via AI)</option>
  </select>
` : ''}`
```

### Pattern 4: Dashboard Row-Level Actions (Recycle + Block)

**What:** Inline buttons on each published post row in database.js, consistent with manager.js deny/retry pattern
**When to use:** Only shown when `p.status === 'published'`

```javascript
// Source: dashboard.js row generation + manager.js retry-post handler pattern
// Add two columns to table header: "Actions"
// In each row for published posts:
`<td class="px-3 py-2">
  ${p.status === 'published' ? `
    <div class="flex gap-2 items-center">
      <form method="POST" action="/dashboard/recycle-post" class="inline">
        <input type="hidden" name="post_id" value="${p.id}">
        <input type="hidden" name="salon" value="${salon_id}">
        <button type="submit"
          class="px-2 py-1 text-[10px] font-medium rounded bg-mpAccentLight text-mpAccent hover:bg-mpAccent hover:text-white border border-mpAccent">
          Recycle
        </button>
      </form>
      <form method="POST" action="/dashboard/toggle-block" class="inline">
        <input type="hidden" name="post_id" value="${p.id}">
        <input type="hidden" name="salon" value="${salon_id}">
        <button type="submit"
          class="px-2 py-1 text-[10px] font-medium rounded ${p.block_from_recycle ? 'bg-red-100 text-red-600 border border-red-300' : 'bg-mpBg text-mpMuted border border-mpBorder hover:border-red-300 hover:text-red-500'}">
          ${p.block_from_recycle ? 'Blocked' : 'Block'}
        </button>
      </form>
    </div>
  ` : '—'}
</td>`
```

### Pattern 5: Auto-Recycle Notice Banner (manager.js)

**What:** Subtle inline info banner at top of manager dashboard when posts were auto-recycled this week
**When to use:** Follows existing `failedBanner` pattern from manager.js lines 392–431

```javascript
// Source: manager.js failedBanner pattern — lines 394–431
// Query for recycled-this-week count (added to GET /manager handler):
const recycledThisWeek = db.prepare(`
  SELECT COUNT(*) AS n FROM posts
  WHERE salon_id = ?
    AND recycled_from_id IS NOT NULL
    AND datetime(created_at) >= datetime('now', '-7 days')
`).get(salon_id)?.n || 0;

// Banner HTML (non-blocking, dismissible via JS):
const recycleBanner = recycledThisWeek === 0 ? '' : `
  <div id="recycle-notice"
       class="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 flex items-center justify-between gap-4">
    <p class="text-sm text-blue-700">
      ${recycledThisWeek} post${recycledThisWeek > 1 ? 's were' : ' was'} auto-recycled this week.
      <a href="/dashboard?salon=${salon_id}&status=published" class="underline font-medium">View in Database</a>
    </p>
    <button onclick="document.getElementById('recycle-notice').remove()"
            class="text-blue-400 hover:text-blue-600 text-lg leading-none shrink-0">&times;</button>
  </div>`;
```

### Anti-Patterns to Avoid

- **Async DB calls:** better-sqlite3 is synchronous — never `await` a `.prepare().get()` or `.run()` call; wrapping in async is a bug
- **Launching Puppeteer in recycler:** caption refresh calls OpenAI only — never Puppeteer
- **New enqueue path:** recycled posts call the existing `enqueuePost()` directly; no new scheduling logic
- **Trusting req.body salon_id:** always use `req.session.salon_id` / `req.manager.salon_id` — IDOR risk
- **pickNextPost() stalling:** if the ideal type isn't available, always fall back to next available — publishing must never halt

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DateTime math for 48hr/90day/45day windows | Custom timestamp comparison | Luxon `DateTime.diff()` + `.fromSQL()` already in scheduler | Already used throughout; consistent timezone handling |
| SMS to manager | Custom Twilio call | `sendViaTwilio()` from `src/routes/twilio.js` | Handles RCS/SMS fallback automatically |
| Plan tier check | Inline string comparison | `PLAN_LIMITS` from `billing.js` | Consistent with all other plan gates in the codebase |
| UUID for recycled post | Custom ID generation | `crypto.randomUUID()` | Already used throughout; no new dependency |
| Caption regeneration | Custom prompt | Import `generateCaption()` from `src/core/openai.js` | Existing function; consistent tone/prompt patterns |
| DB transaction for clone + enqueue | Manual try/catch | `db.transaction()` wrapper | better-sqlite3 has built-in transaction support — use it for clone + enqueue atomically |

**Key insight:** Every primitive is already in the codebase. This phase is pure orchestration — wiring existing pieces together under new trigger conditions.

---

## Common Pitfalls

### Pitfall 1: NULL reach values in candidate ranking
**What goes wrong:** `post_insights` rows may not exist for all published posts (insights sync can lag or fail). `ORDER BY reach DESC` will push NULL-reach posts to the bottom when using LEFT JOIN, but `MAX(pi.reach)` on a missing row returns NULL, not 0.
**Why it happens:** `post_insights` is populated by a separate sync job that can fail or lag. Not all published posts have insight data.
**How to avoid:** Use `COALESCE(MAX(pi.reach), 0)` in the candidate query. Fall back to `published_at DESC` as a secondary sort for zero-reach posts.
**Warning signs:** Recycler always picks the same post, or always picks very old posts.

### Pitfall 2: Recycling the same post repeatedly
**What goes wrong:** A post gets recycled, the recycled copy publishes, then the scheduler recycles it again.
**Why it happens:** The cooldown check looks at `recycled_from_id` — but the recycled copy itself has its own `id` and could become a candidate (it has no `recycled_from_id` of its own if it publishes).
**How to avoid:** In the candidate query, only consider posts where `p.recycled_from_id IS NULL` OR no recent recycle exists. Alternatively, add a `is_recycled_post INTEGER DEFAULT 0` column and exclude `is_recycled_post = 1` from candidates entirely. The CONTEXT.md approach (checking if any post with `recycled_from_id = p.id` exists in last 45 days) handles the original source post correctly.

### Pitfall 3: pickNextPost() not being called on all salons
**What goes wrong:** `runSchedulerOnce()` currently only loops over tenants with `status='manager_approved'` posts due right now. pickNextPost() (or auto-recycle) also needs to run for salons with posts in queue that aren't due yet, and for salons that might be empty.
**Why it happens:** The existing tenant query is scoped to `scheduled_for <= now`. Auto-recycle needs to check ALL salons with `auto_recycle = 1`, not just those with due posts.
**How to avoid:** Run `checkAndAutoRecycle()` against a separate query: `SELECT DISTINCT salon_id FROM salons WHERE auto_recycle = 1`. This runs independently of the publish loop.

### Pitfall 4: Caption refresh creating a second approval gate
**What goes wrong:** An AI-refreshed recycled post gets stuck requiring approval even when `auto_publish = 1`, or bypasses approval when `require_manager_approval = 1`.
**Why it happens:** Temptation to add special-case logic for recycled posts.
**How to avoid:** CONTEXT.md is explicit: refreshed posts follow the existing `auto_publish` salon setting. No new approval concept. The `status` field behavior is identical to any other post entering the queue.

### Pitfall 5: Dashboard row query missing new columns
**What goes wrong:** `block_from_recycle` is not in the SELECT list in dashboard.js, so the Block toggle can't render correctly.
**Why it happens:** The existing SQL in dashboard.js only selects specific columns (line 165–166).
**How to avoid:** Add `block_from_recycle, recycled_from_id` to the SELECT in dashboard.js query.

### Pitfall 6: SCHED-05 (availability mid-week only) conflicting with enqueuePost()
**What goes wrong:** `pickNextPost()` skips an availability post because it's not mid-week, causing a stall or incorrect fallback.
**Why it happens:** pickNextPost() needs to check the day of week before selecting an availability post. If it skips it, it must fall back to the next non-availability type.
**How to avoid:** Inside pickNextPost(), check `salon.timezone` + Luxon weekday for availability posts. Tue=2, Wed=3, Thu=4 in Luxon (1=Monday). If not mid-week, exclude availability from candidates entirely for that run.

---

## Code Examples

Verified patterns from existing source:

### Migration Pattern (from 047_salon_vendor_frequency_cap.js style)
```javascript
// Source: migrations/047_salon_vendor_frequency_cap.js
export function run() {
  const cols = db.prepare(`PRAGMA table_info(posts)`).all().map(c => c.name);

  if (!cols.includes('block_from_recycle')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN block_from_recycle INTEGER DEFAULT 0`).run();
    console.log('[048] Added block_from_recycle to posts');
  }
  if (!cols.includes('recycled_from_id')) {
    db.prepare(`ALTER TABLE posts ADD COLUMN recycled_from_id TEXT`).run();
    console.log('[048] Added recycled_from_id to posts');
  }

  const salonCols = db.prepare(`PRAGMA table_info(salons)`).all().map(c => c.name);
  if (!salonCols.includes('auto_recycle')) {
    db.prepare(`ALTER TABLE salons ADD COLUMN auto_recycle INTEGER DEFAULT 0`).run();
    console.log('[048] Added auto_recycle to salons');
  }
  if (!salonCols.includes('caption_refresh_on_recycle')) {
    db.prepare(`ALTER TABLE salons ADD COLUMN caption_refresh_on_recycle INTEGER DEFAULT 0`).run();
    console.log('[048] Added caption_refresh_on_recycle to salons');
  }
}
```

### enqueuePost() call signature (from scheduler.js line 607)
```javascript
// Source: src/scheduler.js
// enqueuePost() expects an object with at minimum: salon_id, post_type, id
// It reads getSalonPolicy internally — no need to pass salon config
export function enqueuePost(post) {
  // Sets status='manager_approved', scheduled_for=<computed>
  // Returns { ...post, status: "manager_approved", scheduled_for: scheduled }
}
```

### Admin select pattern (from admin.js line 1300–1315)
```javascript
// Source: src/routes/admin.js — update-manager-rules section
// The sel() helper is defined at the top of the admin route as:
const sel = (cond) => cond ? " selected" : "";
const selectCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-mpCharcoal focus:border-mpAccent focus:outline-none focus:ring-1 focus:ring-mpAccent";
```

### Weekday check using Luxon (from scheduler.js)
```javascript
// Source: src/scheduler.js — LUXON_WEEKDAYS and withinScheduleWindow
// Luxon weekday: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
const MID_WEEK = new Set([2, 3, 4]); // Tuesday, Wednesday, Thursday
const localNow = DateTime.utc().setZone(salon.timezone || "America/Indiana/Indianapolis");
const isMidWeek = MID_WEEK.has(localNow.weekday);
```

### db.transaction() for atomic clone + enqueue
```javascript
// Source: better-sqlite3 built-in — same pattern used in postQueue.js reorder
const cloneAndEnqueue = db.transaction((salonId, sourcePost, newId, salonPostNumber) => {
  db.prepare(`INSERT INTO posts (...) VALUES (...)`).run(...);
  db.prepare(`UPDATE posts SET status='manager_approved', scheduled_for=? WHERE id=?`).run(scheduled, newId);
});
cloneAndEnqueue(salonId, candidate, newId, salonPostNumber);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DEFAULT_PRIORITY static sort only | pickNextPost() with rolling-window distribution | Phase 2 | Posts now reflect content strategy, not just type priority |
| Manual recycling only | Auto-recycle on queue depth + 48hr trigger | Phase 2 | Queue never runs dry without manager intervention |
| Single approval path | Plan-gated caption refresh toggle | Phase 2 | Starter/Growth/Pro differentiation; upsell surface |

**Deprecated/outdated:**
- None — this phase adds capability, doesn't replace existing behavior. The existing `DEFAULT_PRIORITY` sort in `runSchedulerOnce()` is preserved as a fallback.

---

## Open Questions

1. **Caption refresh prompt — verbatim copy or paraphrase?**
   - What we know: CONTEXT.md says "GPT-4o rewrite at recycle time"; existing `generateCaption()` in openai.js accepts image URL + salon tone
   - What's unclear: Should the refresh prompt start from `base_caption` (original AI draft) or `final_caption` (manager-edited version)?
   - Recommendation: Use `final_caption` as the source — it's what actually performed well. Pass it to GPT-4o as "original post" context + instruction to "rewrite with fresh language, same tone and key message."

2. **Recycle notice "dismiss" — session or permanent?**
   - What we know: CONTEXT.md says "dismissible"; the simple JS implementation removes the DOM element
   - What's unclear: Should dismiss persist across page reloads (session cookie) or reset each visit?
   - Recommendation: JS DOM removal only (no persistence) — simpler, and the notice reappears on next page load which is acceptable since it links to actionable content. Revisit if managers find it noisy.

3. **pickNextPost() integration point — sort the `due` array or select from it?**
   - What we know: CONTEXT.md says "applies to the whole queue"; current code sorts `due` by `getPriorityIndex()` before looping
   - What's unclear: Should pickNextPost() replace the existing priority sort, or run after it as a further filter?
   - Recommendation: Replace the `due.sort()` call with `pickNextPost(due, salonId)` returning a single post to publish first. The scheduler loop processes one post per tick effectively (retries reschedule), so selecting the first post is the key decision.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test files, no jest/vitest/mocha config |
| Config file | None — Wave 0 must create |
| Quick run command | `node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=recycler` (once installed) |
| Full suite command | `node --experimental-vm-modules node_modules/.bin/jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECYC-01 | Trigger fires only when depth < 3 AND 48hr elapsed | unit | `jest tests/recycler.test.js -t "trigger conditions"` | Wave 0 |
| RECYC-02 | Candidate selected from past 90 days, ranked by reach | unit | `jest tests/recycler.test.js -t "candidate selection"` | Wave 0 |
| RECYC-03 | block_from_recycle and 45-day cooldown exclude candidates | unit | `jest tests/recycler.test.js -t "candidate exclusions"` | Wave 0 |
| RECYC-04 | Does not recycle same post_type twice in a row | unit | `jest tests/recycler.test.js -t "type dedup"` | Wave 0 |
| RECYC-05 | Caption refresh only fires for Growth/Pro with toggle on | unit | `jest tests/recycler.test.js -t "caption refresh gate"` | Wave 0 |
| RECYC-06 | Clone has correct recycled_from_id and is enqueued | unit | `jest tests/recycler.test.js -t "clone integrity"` | Wave 0 |
| RECYC-07 | SMS sent to manager on auto-recycle | unit (mock sendViaTwilio) | `jest tests/recycler.test.js -t "sms notification"` | Wave 0 |
| RECYC-08 | auto_recycle toggle persists in DB | smoke (manual) | Manual — Admin Settings UI | N/A |
| RECYC-09 | block_from_recycle toggle persists and excludes candidate | smoke (manual) | Manual — Database view UI | N/A |
| RECYC-10 | Manual recycle produces correct clone | smoke (manual) | Manual — Database view UI | N/A |
| RECYC-11 | Notice appears when recycled-this-week count > 0 | smoke (manual) | Manual — manager dashboard | N/A |
| SCHED-01 | pickNextPost returns most under-represented type | unit | `jest tests/scheduler.test.js -t "pickNextPost"` | Wave 0 |
| SCHED-02 | 50–60% standard respected over 7-day window | unit | `jest tests/scheduler.test.js -t "standard distribution"` | Wave 0 |
| SCHED-03 | before_after skipped on Mon/Fri/Sat/Sun | unit | `jest tests/scheduler.test.js -t "before_after weekday"` | Wave 0 |
| SCHED-04 | Promotions blocked if 2+ in last 7 days or last post was promo | unit | `jest tests/scheduler.test.js -t "promotion cap"` | Wave 0 |
| SCHED-05 | Availability skipped outside Tue–Thu | unit | `jest tests/scheduler.test.js -t "availability midweek"` | Wave 0 |
| SCHED-06 | Reel post does not affect distribution counts | unit | `jest tests/scheduler.test.js -t "reel bonus"` | Wave 0 |

### Sampling Rate
- **Per task commit:** No automated test suite yet — manual smoke test of affected route
- **Per wave merge:** Once Wave 0 creates test infra: `jest tests/recycler.test.js tests/scheduler.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/recycler.test.js` — covers RECYC-01 through RECYC-07
- [ ] `tests/scheduler.test.js` — covers SCHED-01 through SCHED-06
- [ ] `jest.config.js` — ESM config for Node.js (`"type": "module"` in package.json requires `--experimental-vm-modules`)
- [ ] `tests/helpers/db-fixture.js` — in-memory better-sqlite3 fixture for unit tests
- [ ] Framework install: `npm install --save-dev jest @jest/globals` — if not already present

*(Note: The codebase uses ESM throughout. Jest with `--experimental-vm-modules` or Vitest are both viable. Vitest has native ESM support and may be simpler. Recommend evaluating at Wave 0.)*

---

## Sources

### Primary (HIGH confidence)
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/scheduler.js` — `enqueuePost()`, `getSalonPolicy()`, `runSchedulerOnce()`, `DEFAULT_PRIORITY`, Luxon weekday patterns, DB synchronous patterns
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/routes/admin.js` — toggle select pattern, `update-manager-rules` POST handler, `PLAN_LIMITS` import
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/routes/dashboard.js` — row-level query structure, column SELECT list, HTML table row pattern
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/routes/manager.js` — `failedBanner` pattern, retry-post POST handler, dismiss pattern
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/routes/billing.js` — `PLAN_LIMITS` export, plan tier names
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/migrations/007_post_insights.js` — `post_insights` schema: `reach`, `engagement_rate`, `UNIQUE(post_id, platform)` constraint
- `/Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app/src/core/vendorScheduler.js` — cadence scheduling pattern, `enqueuePost()` call pattern
- `.planning/phases/02-content-engine/02-CONTEXT.md` — locked decisions, canonical refs, integration points

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — RECYC-01 through RECYC-11, SCHED-01 through SCHED-06 full text
- `.planning/STATE.md` — project decisions including "recycler triggers at queue depth < 3 AND 48hr since last publish"

### Tertiary (LOW confidence)
- None — all findings verified against source code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed package.json (no new packages needed)
- Architecture: HIGH — all patterns read directly from source files
- SQL queries: HIGH — schemas read directly from migrations; query logic is standard SQLite
- Pitfalls: HIGH — derived from reading actual source code behavior, not training assumptions
- Test infrastructure: MEDIUM — no tests currently exist; framework recommendation is based on ESM compatibility knowledge

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable domain — SQLite, Express, established patterns)
