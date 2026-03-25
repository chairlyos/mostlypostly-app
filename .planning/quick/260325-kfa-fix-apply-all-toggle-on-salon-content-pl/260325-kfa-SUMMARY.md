---
phase: quick-260325-kfa
plan: 01
subsystem: integrations-ui
tags: [quick-fix, content-routing, apply-all, integrations-page]
tech-stack:
  added: []
  patterns: [event-delegation, form-submit-cascade-guard]
key-files:
  modified:
    - src/routes/integrations.js
decisions:
  - Apply All row uses a separate tbody above the per-type tbody so it renders visually distinct without extra wrapper divs
  - __applyAllActive flag guards individual checkbox onchange to prevent N form submissions during cascade
metrics:
  duration: 5m
  completed: 2026-03-25
---

# Quick Task 260325-kfa: Fix Apply All Toggle on Salon Content Placement

**One-liner:** Added Apply All toggle row to salon Content Routing card with event delegation cascade + single-submit guard, matching Platform Console styling.

## What Was Done

Three targeted changes to `src/routes/integrations.js`:

1. **col-{platform} class on toggleCell checkboxes** — each individual routing checkbox now gets `col-facebook`, `col-instagram`, `col-gmb`, or `col-tiktok` class. The Apply All handler uses `querySelectorAll('input.col-' + plat)` to target the right column.

2. **Apply All row** — inserted as its own `<tbody>` above the per-type row `<tbody>`. Styled with `bg-mpAccentLight` background and `text-mpAccent uppercase` label, matching the Platform Console design. The row renders one toggle per platform, pre-checked if all platform values in `routing` are enabled.

3. **Event delegation + submit guard** — a `document.addEventListener('change', ...)` handler detects `data-apply-all` inputs, sets `window.__applyAllActive = true`, cascades `checked` state to all `col-{plat}` checkboxes, then submits the routing form once. Individual checkbox `onchange` was updated from `this.form.submit()` to `if(!window.__applyAllActive)this.form.submit()` to prevent N form POSTs during the cascade.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 9023998 | fix(quick-260325-kfa): add Apply All toggles to salon Content Routing card |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/routes/integrations.js` exists and module loads cleanly (`node -e "import('./src/routes/integrations.js')"` → OK)
- Commit 9023998 exists in git log
- `grep "data-apply-all"` → 3 matches (Apply All row + JS handler)
- `grep 'col-\${platform}'` → 1 match (toggleCell class)
- `grep "__applyAllActive"` → 3 matches (guard flag set/clear + onchange condition)
