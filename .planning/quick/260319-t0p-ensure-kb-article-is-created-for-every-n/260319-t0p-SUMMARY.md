---
phase: quick
plan: 260319-t0p
subsystem: documentation
tags: [kb, documentation, workflow, site]
key-files:
  created:
    - /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-site/kb/_template.html
    - /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-site/kb/post-queue.html
  modified:
    - /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-site/kb.html
    - /Users/troyhardister/chairlyos/mostlypostly/CLAUDE.md
decisions:
  - "KB articles live in mostlypostly-site/kb/ as standalone HTML files — no CMS, no framework"
  - "4-section structure mandatory: Overview, How It Works, Step-by-Step, FAQ"
  - "KB article requirement added to Definition of Done with backend-only exemption"
metrics:
  duration: "4 min"
  completed: "2026-03-20"
  tasks_completed: 2
  files_changed: 4
---

# Quick Task 260319-t0p: KB Article Workflow Established

**One-liner:** Reusable 4-section KB template plus a Post Queue demo article, hub-linked and enforced via Definition of Done.

## What Was Done

### Task 1: KB template and Post Queue demo article

Created two files in `mostlypostly-site/kb/`:

- `_template.html` — Copy-paste-ready HTML template matching the exact structure of `vendors.html` (head block, white-inverted header, mobile menu, breadcrumb, footer, JS snippets). Contains all 4 mandatory article sections with `<!-- REPLACE: ... -->` placeholder comments throughout. Logo paths use `../logo/` prefix. Forward-compatible HTML with no JS state.

- `post-queue.html` — Real KB article for the Post Queue feature targeting salon managers. Covers: Overview (drag-and-drop resequencing without changing time slots), How It Works (slot-preservation mechanism with "Good to know" callout), Step-by-Step (5 numbered steps with blue circles), FAQ (3 questions). Canonical URL set. Linked to dashboard-guide, manager-approvals, and promotions as related articles.

**Commit:** `986419d` — feat(quick-260319-t0p): add KB template and Post Queue article

### Task 2: Hub link and Definition of Done update

- `kb.html` — Added new card in Category 3 (For Owners & Managers), placed after the Dashboard & Menus card. Title: "Reordering Your Post Queue". Icon: ↕️. Links to `/kb/post-queue.html`. Follows exact card HTML pattern from existing entries.

- `CLAUDE.md` — Added to Definition of Done checklist: `KB article created in mostlypostly-site/kb/ for user-facing features (skip for backend-only phases with no manager UI)`

**Commit:** `bd21181` — feat(quick-260319-t0p): link Post Queue KB article from hub and update Definition of Done

Note: CLAUDE.md lives at `/Users/troyhardister/chairlyos/mostlypostly/CLAUDE.md` — outside both git repositories (mostlypostly-app and mostlypostly-site). The file was updated on disk. It is not tracked by either repo's git history.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `kb/_template.html` exists: FOUND
- `kb/post-queue.html` exists: FOUND
- `kb.html` contains `post-queue.html` link: FOUND
- `CLAUDE.md` contains KB article requirement: FOUND
- Commit `986419d` exists in mostlypostly-site: FOUND
- Commit `bd21181` exists in mostlypostly-site: FOUND
