# Phase 8: Calendar Views and Controls - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Week view, Agenda view, a view-switching toggle, a filter bar (post type + status), a New Post button, and a card display settings gear to the existing `/manager/calendar` route. All view preferences (active view, active filters, card field visibility) are persisted in `localStorage`. Drag-to-reschedule from Phase 7 is not changed.

</domain>

<decisions>
## Implementation Decisions

### Week View
- **D-01:** 7-column layout (one column per weekday), posts stacked vertically per day — no hourly time slots.
- **D-02:** Same mini-card style as Month view (color bar, type label, stylist name, platform icons). Card display settings apply here too.
- **D-03:** Navigation arrows in Week view move by 1 week (Prev = previous 7 days, Next = next 7 days).

### Agenda View
- **D-04:** Chronological list of upcoming posts, 30-day rolling window from today (no past posts).
- **D-05:** Posts grouped by date with a date-header row (e.g., "Thursday, March 26"). Same card style as the day panel (larger cards with thumbnail, caption preview, actions).
- **D-06:** No Prev/Next navigation arrows in Agenda view — it's a flat list from today forward. Navigation arrows hidden when Agenda is active.

### View Toggle
- **D-07:** Segmented button group (3-button: Month | Week | Agenda) lives in the calendar header, to the right of the month label / nav arrows.
- **D-08:** Active view persisted in `localStorage` key `calendar_view`. On page load, restore from `localStorage` (default: Month).
- **D-09:** Switching views re-renders the calendar body without a full page reload — the server endpoints for Week and Agenda return HTML fragments fetched via `fetch()`, same pattern as the day panel fragment.

### Filter Bar
- **D-10:** Row of toggle chips between the header and the calendar grid.
- **D-11:** Two chip groups: **Post Type** (Post, B/A, Promo, Avail, Celeb, Reel, Vendor) and **Status** (Pending, Scheduled, Published, Failed).
- **D-12:** All chips active by default (no filtering). Clicking a chip deactivates it (greys out) — posts of that type/status are hidden client-side.
- **D-13:** Filtering is client-side show/hide: all posts rendered in DOM, JS adds/removes `hidden` class based on active filters. No network call on filter change.
- **D-14:** Active filter state persisted in `localStorage` key `calendar_filters`. Restored on page load.
- **D-15:** Filters persist across view switches (Month → Week → Agenda all use the same active filter state).
- **D-16:** Platform filtering deferred — not in this phase.

### New Post Button
- **D-17:** A `+ New Post` button in the top-right of the calendar header (always visible).
- **D-18:** Clicking the header button navigates to `/manager/coordinator/upload` with no date pre-filled.
- **D-19:** The day panel also gets a small `+ Post for this day` link at the bottom of the panel. Clicking it navigates to `/manager/coordinator/upload?date=YYYY-MM-DD` with the panel's date pre-filled as the scheduled date.
- **D-20:** `/manager/coordinator/upload` must accept a `?date=YYYY-MM-DD` query param and pre-fill the `scheduled_for` date input when present.

### Card Display Settings
- **D-21:** Four fields are individually toggleable on grid mini-cards: **Stylist name**, **Platform icons**, **Time**, **Caption preview**.
- **D-22:** All four fields shown by default (all-on). Settings only hide fields; they never add fields that don't already exist.
- **D-23:** Settings control: a gear icon button (⚙) in the calendar header. Clicking opens a small dropdown panel with 4 labeled toggles (checkboxes or toggle switches). Panel closes on click-outside.
- **D-24:** Field visibility preferences persisted in `localStorage` key `calendar_card_settings` as a JSON object `{ showStylist: true, showPlatforms: true, showTime: true, showCaption: true }`.
- **D-25:** Caption preview on mini-cards is truncated to ~60 chars (mini-cards are compact). This is different from the full caption preview in the day panel.

### Claude's Discretion
- Exact pixel layout for the Week view 7-column grid (adapt from Month view cell sizing)
- Whether Week view cells show a day-of-week header (e.g., "Mon 3/24") or just the date number
- Exact styling of the date-header rows in Agenda view
- Empty state when all posts are filtered out (brief "No posts match filters" message)
- How the gear dropdown is positioned (below the button, right-aligned)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Calendar Implementation
- `src/routes/calendar.js` — Full Phase 7 implementation: month grid, day panel fragment, drag-reschedule, `calendarPillClass`, `calendarPillLabel`, `platformIcons`, `calendarCardBarClass`, `statusBadge` helpers. All Phase 8 views extend this file.

### Coordinator Upload Form (New Post target)
- `src/routes/manager.js` — Contains `GET /manager/coordinator/upload` and `POST /manager/coordinator/upload`. Must accept `?date=YYYY-MM-DD` query param for D-19/D-20.

### Shell and Nav
- `src/ui/pageShell.js` — Page shell wrapper. Calendar page uses `current: "calendar"` for active nav highlight.

### Project Conventions
- `CLAUDE.md` — ESM only, no `require()`. DB is synchronous (better-sqlite3). Tailwind via CDN (no build step). pageShell.js for all pages. CSP: SortableJS CDN (cdn.jsdelivr.net) already whitelisted from Phase 7.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calendarPillClass(post)` — color class per post type; reuse in Week and Agenda views
- `calendarPillLabel(post)` — short label per post type; reuse everywhere
- `calendarCardBarClass(post)` — left-color-bar class for mini-cards; reuse in Week view
- `platformIcons(salon, size)` — inline SVG platform icon cluster; reuse in all views
- `statusBadge(status)` — colored status pill; reuse in Agenda view cards
- `safe(s)` — HTML escape utility; use everywhere user content is rendered
- `toProxyUrl(url)` — Twilio MMS proxy; use for thumbnails in Agenda view

### Established Patterns
- Fragment loading via `fetch()` + `innerHTML` — used by day panel, apply to Week/Agenda view bodies
- SortableJS for drag (already whitelisted in CSP); only needed in Month and Week views
- `req.query.month` for navigation — extend to `req.query.week` and a view param
- All DB queries filter by `salon_id = req.session.salon_id` (IDOR safety)
- `DateTime.fromSQL(..., { zone: 'utc' }).setZone(tz)` — UTC→local pattern, used throughout

### Integration Points
- `GET /manager/calendar` — main route; needs `?view=month|week|agenda` query param support
- `GET /manager/calendar/day/:date` — existing day panel fragment; no changes needed
- `POST /manager/calendar/reschedule` — existing; no changes needed
- `GET /manager/coordinator/upload` — needs `?date=YYYY-MM-DD` support added
- `pageShell.js` — no changes needed; calendar already has its own nav slot

</code_context>

<specifics>
## Specific Ideas

- The view toggle segmented button should visually match the existing button styles in the app (border + rounded, active state uses mpAccent fill or strong border)
- Filter chips when inactive should grey out but remain visible (not disappear) so managers know what filters exist
- The gear dropdown for card settings should feel like a lightweight settings panel, not a full modal

</specifics>

<deferred>
## Deferred Ideas

- Platform filtering (FB/IG/TikTok/GMB chips) — deferred from filter bar; adds complexity requiring platform_routing data per post
- Time-slot Week view (like Google Calendar with hourly grid) — deferred; decided against in favor of stacked cards

</deferred>

---

*Phase: 08-calendar-views-and-controls*
*Context gathered: 2026-03-21*
