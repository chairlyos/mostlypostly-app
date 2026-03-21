# Phase 8: Calendar Views and Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 08-calendar-views-and-controls
**Areas discussed:** Week & Agenda view layouts, Filter bar design, New Post button behavior, Card display settings

---

## Week & Agenda View Layouts

| Option | Description | Selected |
|--------|-------------|----------|
| 7 columns, posts stacked per day | Same card style as Month, one column per day, no hourly slots | ✓ |
| Time-slot grid (like Google Calendar) | 24-hour timeline with posts positioned at their scheduled time | |
| You decide | Claude picks the best approach | |

**User's choice:** 7 columns, posts stacked per day

| Option | Description | Selected |
|--------|-------------|----------|
| Upcoming list — 30-day window | Chronological from today, grouped by date | ✓ |
| All scheduled posts, no date limit | Full queue of non-published posts | |
| Date-grouped with infinite scroll | Loads more as you scroll | |

**User's choice:** Upcoming list — 30-day window

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented button group in header | Three-button toggle right of month nav | ✓ |
| Tabs below the header | Tab row between header and grid | |

**User's choice:** Segmented button group in header

| Option | Description | Selected |
|--------|-------------|----------|
| Prev/Next adapts per view | Month=month, Week=week, Agenda=hidden | ✓ |
| Always navigate by month | All views use month-scoped navigation | |

**User's choice:** Prev/Next adapts per view

---

## Filter Bar Design

| Option | Description | Selected |
|--------|-------------|----------|
| Row of toggle chips below the header | Chips between header and grid, active = highlighted | ✓ |
| Dropdown filter panel | Single filter button opens dropdown | |

**User's choice:** Row of toggle chips below the header

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side show/hide | All posts rendered, JS hides/shows, instant, stored in localStorage | ✓ |
| Server reload with query params | Filters in URL, server re-renders, page reloads | |

**User's choice:** Client-side show/hide

| Option | Description | Selected |
|--------|-------------|----------|
| Post type + Status only | Type chips + Status chips, no platform filtering | ✓ |
| Post type + Status + Platform | Also adds FB/IG/TikTok/GMB platform chips | |

**User's choice:** Post type + Status only

---

## New Post Button Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to coordinator upload page | Goes to /manager/coordinator/upload (existing form) | ✓ |
| Open a modal/drawer inline | Drawer appears without leaving calendar | |
| Navigate to a new dedicated page | Build a new route/page for creating posts | |

**User's choice:** Navigate to coordinator upload page

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — clicking a day cell pre-fills that date | Day panel New Post link passes ?date= query param | ✓ |
| No — always open blank | Upload form always opens without a pre-filled date | |

**User's choice:** Yes — clicking a day cell pre-fills that date

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar + day panel | + New Post in header (always), + Post link in day panel (context) | ✓ |
| Header only | One button in header only | |

**User's choice:** Header bar + day panel

---

## Card Display Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Stylist name only | Only stylist name is toggleable | |
| Stylist name + platform icons | Toggle both name and icon rows | |
| Full set: stylist name, platform icons, time, caption preview | All four individually toggleable | ✓ |

**User's choice:** Full set — all four fields toggleable

| Option | Description | Selected |
|--------|-------------|----------|
| Small gear icon in header, dropdown | ⚙ button opens dropdown with toggles, closes on click-outside | ✓ |
| Inline toggle chips alongside filter bar | Card display options in the same chip row as filters | |

**User's choice:** Gear icon in header → dropdown

| Option | Description | Selected |
|--------|-------------|----------|
| All-on by default | All four fields visible by default | ✓ |
| Minimal by default | Only color bar + type label shown by default | |

**User's choice:** All-on by default

---

## Claude's Discretion

- Exact pixel layout for Week view 7-column grid
- Whether Week view cells show day-of-week header or just date number
- Exact styling of date-header rows in Agenda view
- Empty state when all posts are filtered out
- Gear dropdown positioning

## Deferred Ideas

- Platform filtering (FB/IG/TikTok/GMB chips) — too complex for this phase
- Time-slot Week view (hourly grid) — decided against in favor of stacked cards
