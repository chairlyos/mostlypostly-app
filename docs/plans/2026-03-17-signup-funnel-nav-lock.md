# Signup Funnel Nav Lock Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Hide sidebar nav links during billing and onboarding so new users follow a linear setup funnel, and redirect site CTA buttons to scroll to pricing rather than jumping straight to signup.

**Architecture:** Add a `navLocked` boolean to `pageShell.js` that replaces all nav links with a lock placeholder when true. Pass `navLocked: true` from the billing route when `?new=1` is present. Onboarding pages already have their own minimal shell with no nav — no change needed there. On the marketing site, change hero CTA + Sign Up buttons to `#pricing` so plan selection happens before account creation.

**Tech Stack:** Node.js/Express, server-rendered HTML via `pageShell.js`, vanilla JS in `mostlypostly-site/index.html`

---

### Task 1: Add `navLocked` option to pageShell.js

**Files:**
- Modify: `src/ui/pageShell.js:5-12` (function signature)
- Modify: `src/ui/pageShell.js:132-166` (sidebar nav block)
- Modify: `src/ui/pageShell.js:183-205` (mobile nav block)

**Context:**
`pageShell.js` exports a default function that accepts an options object and returns a full HTML page string. The sidebar is a fixed `<aside>` with a logo, location initials chip, and a `<nav>` of icon buttons. The mobile overlay has a `<nav>` with full-width text links. Both need to be suppressed when `navLocked: true`.

**Step 1: Add `navLocked` to the destructured params**

Find this line in `src/ui/pageShell.js`:
```js
export default function pageShell({
  title = "MostlyPostly",
  body  = "",
  current = "",
  salon_id = "",
  manager_phone = "",
  manager_id = "",
}) {
```

Replace with:
```js
export default function pageShell({
  title = "MostlyPostly",
  body  = "",
  current = "",
  salon_id = "",
  manager_phone = "",
  manager_id = "",
  navLocked = false,
}) {
```

**Step 2: Replace the location initials chip and nav block in the desktop sidebar**

Find this block (starts around line 132):
```js
    <!-- Active location indicator -->
    ${locationInitials ? `
    <div class="group relative w-full flex justify-center pt-3 pb-1">
```

The entire block from `<!-- Active location indicator -->` through the closing `</aside>` tag includes:
1. Location initials chip
2. `<nav>` with all nav items
3. Profile + Logout at bottom

Replace the location initials chip and primary nav with a conditional. The structure should be:

```js
    <!-- Active location indicator -->
    ${!navLocked && locationInitials ? `
    <div class="group relative w-full flex justify-center pt-3 pb-1">
      <a href="/manager/locations"
         class="flex h-7 w-7 items-center justify-center rounded-lg bg-mpAccentLight text-mpAccent text-xs font-bold leading-none">
        ${locationInitials}
      </a>
      <div class="pointer-events-none absolute left-[calc(100%-4px)] top-1/2 -translate-y-1/2 z-50
                  whitespace-nowrap rounded-lg bg-mpCharcoal px-2.5 py-1.5 text-xs font-semibold text-white
                  opacity-0 group-hover:opacity-100 transition-opacity shadow-lg ml-3">
        ${activeSalonName}
        <div class="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-mpCharcoal"></div>
      </div>
    </div>` : ""}

    <!-- Primary nav -->
    ${navLocked ? `
    <div class="flex flex-1 flex-col items-center justify-center py-6 px-2">
      <svg class="w-5 h-5 text-mpBorder mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      <p class="text-[10px] text-center text-mpBorder leading-tight">Complete<br/>setup first</p>
    </div>` : `
    <nav class="flex flex-1 flex-col items-center py-3 gap-0.5">
      ${navItem("/manager",            ICONS.home,      "Dashboard",    "manager")}
      ${navItem("/manager/queue",      ICONS.queue,     "Post Queue",   "queue")}
      ${navItem("/analytics",          ICONS.chart,     "Analytics",    "analytics")}
      ${!isCoordinator ? navItem("/manager/stylists",   ICONS.team,      "Team",         "team") : ""}
      ${navItem("/manager/performance", ICONS.trophy,   "Performance",  "performance")}
      ${!isCoordinator ? navItem("/manager/scheduler",  ICONS.clock,     "Scheduler",    "scheduler") : ""}
      ${!isCoordinator ? navItem("/dashboard",          ICONS.database,  "Database",     "database") : ""}
      ${!isCoordinator ? navItem("/manager/vendors",       ICONS.tag,          "Vendors",       "vendors") : ""}
      ${(!isCoordinator && isPro) ? navItem("/manager/integrations", ICONS.integration,  "Integrations",  "integrations") : ""}
      ${!isCoordinator ? navItem("/manager/locations",    ICONS.building,     "Locations",     "locations") : ""}
      ${isOwner ? navItem("/manager/billing", ICONS.card, "Billing", "billing") : ""}
      ${!isCoordinator ? navItem("/manager/admin",        ICONS.cog,          "Admin",         "admin") : ""}
    </nav>`}
```

**Step 3: Replace the mobile nav links with a locked state**

Find the mobile overlay nav section (starts around line 188):
```js
    <nav class="flex-1 px-5 py-4 space-y-0.5 overflow-y-auto">
      ${mobileNavLink("/manager",            "Dashboard",  "manager")}
```

Replace the entire `<nav>...</nav>` block inside the mobile overlay with:
```js
    ${navLocked ? `
    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <svg class="w-8 h-8 text-mpBorder" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      <p class="text-sm text-mpMuted font-medium">Complete your account setup to unlock the dashboard.</p>
    </div>` : `
    <nav class="flex-1 px-5 py-4 space-y-0.5 overflow-y-auto">
      ${mobileNavLink("/manager",            "Dashboard",  "manager")}
      ${mobileNavLink("/manager/queue",      "Post Queue", "queue")}
      ${mobileNavLink("/analytics",          "Analytics",  "analytics")}
      ${!isCoordinator ? mobileNavLink("/manager/stylists",   "Team",        "team") : ""}
      ${mobileNavLink("/manager/performance", "Performance", "performance")}
      ${!isCoordinator ? mobileNavLink("/manager/scheduler",  "Scheduler",   "scheduler") : ""}
      ${!isCoordinator ? mobileNavLink("/dashboard",          "Database",   "database") : ""}
      ${!isCoordinator ? mobileNavLink("/manager/vendors",       "Vendors",       "vendors") : ""}
      ${(!isCoordinator && isPro) ? mobileNavLink("/manager/integrations", "Integrations",  "integrations") : ""}
      ${!isCoordinator ? mobileNavLink("/manager/locations",    "Locations",     "locations") : ""}
      ${isOwner ? mobileNavLink("/manager/billing", "Billing", "billing") : ""}
      ${!isCoordinator ? mobileNavLink("/manager/admin",        "Admin",         "admin") : ""}
      ${mobileNavLink("/manager/logout",     "Logout",     "logout")}
    </nav>`}
```

**Step 4: Verify the full pageShell.js renders correctly — manual check**

Open a browser to `/manager/billing?new=1` after step 2 is done. Confirm sidebar shows the lock icon and "Complete setup first" instead of nav links.

**Step 5: Commit**

```bash
git add src/ui/pageShell.js
git commit -m "feat: add navLocked option to pageShell — hides nav during onboarding funnel"
```

---

### Task 2: Pass `navLocked` from billing route for new accounts

**Files:**
- Modify: `src/routes/billing.js:351-356` (main billing GET pageShell call)

**Context:**
`billing.js` already has `isNewAccount = req.query.new === "1"` (line 154). The main billing page `pageShell` call is at line 351. There is also a second `pageShell` call at line 123 for the `/billing/success` route — that one doesn't need locking (success page is transitional and redirects to onboarding immediately for new accounts).

**Step 1: Add `navLocked` to the billing pageShell call**

Find (around line 351):
```js
  res.send(pageShell({
    title: "Billing",
    current: "billing",
    salon_id,
    manager_id: req.session.manager_id,
    body: `
```

Replace with:
```js
  res.send(pageShell({
    title: "Billing",
    current: "billing",
    salon_id,
    manager_id: req.session.manager_id,
    navLocked: isNewAccount,
    body: `
```

**Step 2: Smoke test billing page for new vs existing accounts**

- New account path: visit `/manager/billing?new=1` — confirm nav is locked (lock icon, no links)
- Existing account path: visit `/manager/billing` (without `?new=1`) — confirm full nav still shows
- Logout link should be visible in both states

**Step 3: Commit**

```bash
git add src/routes/billing.js
git commit -m "feat: lock nav on billing page for new account setup flow"
```

---

### Task 3: Website CTA buttons scroll to pricing section

**Files:**
- Modify: `mostlypostly-site/index.html:1431-1450` (JS block that sets button hrefs)

**Context:**
A `<script>` block near the bottom of `index.html` fetches a config JSON and then sets `href` values on several button elements via JS. The relevant IDs:
- `mp-signup` — nav "Sign Up" button (desktop)
- `mp-signup-mobile` — nav "Sign Up" button (mobile drawer)
- `mp-hero-cta` — hero section "Start Free Trial" button
- `mp-signup-starter`, `mp-signup-growth`, `mp-signup-pro` — pricing plan buttons (keep pointing to `/manager/signup?plan=X`)

The pricing section anchor already exists: `<section id="pricing" ...>` at line ~1170.

**Step 1: Change mp-signup, mp-signup-mobile, and mp-hero-cta to scroll to #pricing**

Find this JS block:
```js
      ["mp-signup","mp-signup-mobile"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.href = `${base}/manager/signup`;
      });
```

Replace with:
```js
      ["mp-signup","mp-signup-mobile"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.href = `#pricing`;
      });
```

Find:
```js
      // Hero CTA
      const heroCta = document.getElementById('mp-hero-cta');
      if (heroCta) heroCta.href = `${base}/manager/signup`;
```

Replace with:
```js
      // Hero CTA — scroll to pricing so user picks a plan before signing up
      const heroCta = document.getElementById('mp-hero-cta');
      if (heroCta) heroCta.href = `#pricing`;
```

**Step 2: Verify plan card buttons are unchanged**

Confirm the `planMap` block below is still:
```js
      const planMap = { "mp-signup-starter": "starter", "mp-signup-growth": "growth", "mp-signup-pro": "pro" };
      Object.entries(planMap).forEach(([id, plan]) => {
        const el = document.getElementById(id);
        if (el) el.href = `${base}/manager/signup?plan=${plan}`;
      });
```
Do NOT change this — plan buttons correctly go to signup with the plan hint.

**Step 3: Test locally**

Open `mostlypostly-site/index.html` in a browser:
- Click "Sign Up" in the nav → page scrolls to pricing section ✓
- Click "Start Free Trial" in the hero → page scrolls to pricing section ✓
- Click "Start Free Trial →" on Starter plan card → goes to `/manager/signup?plan=starter` ✓
- Click "Get Started →" on Growth plan card → goes to `/manager/signup?plan=growth` ✓

**Step 4: Commit**

```bash
git add mostlypostly-site/index.html
git commit -m "feat: CTA and Sign Up buttons scroll to pricing instead of jumping to signup"
```
