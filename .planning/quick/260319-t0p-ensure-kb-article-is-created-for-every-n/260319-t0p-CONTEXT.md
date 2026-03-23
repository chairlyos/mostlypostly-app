# Quick Task 260319-t0p: KB Article Workflow - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Establish a repeatable process ensuring every user-facing feature phase produces a KB article published to mostlypostly-site/kb/. Deliverables: HTML template, workflow enforcement mechanism, and a demo article for an existing completed feature.

</domain>

<decisions>
## Implementation Decisions

### Where in the Workflow
- KB article creation is a **mandatory final step** for every user-facing phase
- Backend-only phases (nightly crons, DB migrations, sync pipelines with no manager UI) are exempt
- Enforcement mechanism: add KB article task to the project's "Definition of Done" in CLAUDE.md and create a reusable KB article template

### Article Audience & Format
- Primary audience: **salon managers (non-technical)** — user guide style, no code or infrastructure details
- Standard 4-section structure every article must follow:
  1. **Overview** — what the feature does and why it exists
  2. **How it works** — brief plain-English explanation of the mechanism
  3. **Step-by-step** — walkthrough of how to use it
  4. **FAQ** — common questions and gotchas
- Tone: friendly, non-technical, action-oriented (same voice as the rest of mostlypostly.com)

### Where Articles Live
- **mostlypostly-site/kb/** as new HTML files — follows existing /kb.html hub + /kb/*.html sub-page pattern
- Articles are **publicly visible for now** — subscriber gate is a future phase
- HTML structure must be forward-compatible with adding auth/subscriber checks later (no assumptions that make gating impossible)

### Claude's Discretion
- Exact HTML structure (follow existing kb sub-page pattern from mostlypostly-site/kb/)
- Naming convention for KB files (kebab-case feature slug)
- Which completed feature to use for the demo article (pick the most manager-visible recent feature)

</decisions>

<specifics>
## Specific Ideas

- The subscriber gate is a future phase — build the structure so it can be added without rewriting articles
- Demo article should be for a feature managers already see in the dashboard (not the PDF scraping pipeline)

</specifics>

<canonical_refs>
## Canonical References

- `mostlypostly-site/kb.html` — existing KB hub page; new articles must be linked from here
- `mostlypostly-site/kb/` — existing KB sub-pages; new HTML files must follow this exact structure and palette
- `/Users/troyhardister/chairlyos/mostlypostly/CLAUDE.md` §Definition of Done — this is where KB article enforcement gets added

</canonical_refs>
