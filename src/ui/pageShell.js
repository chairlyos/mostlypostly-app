// src/ui/pageShell.js — Top bar + grouped sidebar navigation

import { db } from "../../db.js";

export default function pageShell({
  title = "MostlyPostly",
  body  = "",
  current = "",
  salon_id = "",
  manager_phone = "",
  manager_id = "",
  navLocked = false,
  bodyBg = "bg-mpBg",
}) {
  const qs = salon_id ? `?salon=${encodeURIComponent(salon_id)}` : "";

  // Active location name + plan for sidebar
  let activeSalonName = "";
  let salonPlan = "";
  if (salon_id) {
    try {
      const row = db.prepare("SELECT name, plan FROM salons WHERE slug = ?").get(salon_id);
      if (row) { activeSalonName = row.name; salonPlan = row.plan || ""; }
    } catch (_) {}
  }
  const isPro = salonPlan === "pro";

  // Role-based nav visibility
  let isOwner = true;
  let isCoordinator = false;
  if (manager_id) {
    try {
      const mgr = db.prepare("SELECT role FROM managers WHERE id = ?").get(manager_id);
      if (mgr) {
        isOwner = mgr.role === "owner";
        isCoordinator = mgr.role === "coordinator";
      }
    } catch (_) {}
  }

  function isActive(key) { return current === key; }

  // Sidebar nav item: icon + text
  function navItem(href, icon, label, key) {
    const active = isActive(key);
    const cls = active
      ? "bg-white/15 text-white"
      : "text-white/60 hover:bg-white/10 hover:text-white";
    return `
      <a href="${href}${qs}"
         class="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${cls}">
        <span class="flex-shrink-0 w-5">${icon}</span>
        <span class="text-sm font-medium leading-none">${label}</span>
      </a>`;
  }

  // Section header label
  function navSection(label) {
    return `<p class="px-4 pt-5 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35 select-none">${label}</p>`;
  }

  // Mobile nav link
  function mobileNavLink(href, label, key) {
    const active = isActive(key);
    return `<a href="${href}${qs}"
      class="block py-2.5 border-b border-mpBorder text-sm font-medium transition-colors
             ${active ? "text-mpAccent font-semibold" : "text-mpMuted hover:text-mpCharcoal"}">
      ${label}
    </a>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title ? title + " • MostlyPostly" : "MostlyPostly"}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
          colors: {
            mpCharcoal:     "#2B2D35",
            mpCharcoalDark: "#1a1c22",
            mpAccent:       "#3B72B9",
            mpAccentLight:  "#EBF3FF",
            mpBg:           "#F8FAFC",
            mpCard:         "#FFFFFF",
            mpBorder:       "#E2E8F0",
            mpMuted:        "#6B7280",
          }
        }
      }
    };
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>

<body class="${bodyBg} text-mpCharcoal antialiased">

  <!-- ══════════════════════════════════════════════════
       TOP BAR (blue, full width, fixed)
  ══════════════════════════════════════════════════ -->
  <header class="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-[#3B72B9] border-b border-[#2E5E9E]">
    <!-- Logo -->
    ${navLocked
      ? `<img src="/public/logo/logo-trimmed.png" alt="MostlyPostly" class="h-7 w-auto" style="filter:brightness(0) invert(1);" />`
      : `<a href="/manager${qs}"><img src="/public/logo/logo-trimmed.png" alt="MostlyPostly" class="h-7 w-auto" style="filter:brightness(0) invert(1);" /></a>`}

    <!-- Active location chip (top bar) -->
    ${(!navLocked && activeSalonName) ? `
    <div class="hidden md:flex items-center gap-2 text-white/80 text-sm">
      <span class="text-white/50">|</span>
      <span class="font-medium">${activeSalonName}</span>
      ${salonPlan ? `<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white uppercase tracking-wide">${salonPlan}</span>` : ""}
    </div>` : ""}

    <!-- Mobile hamburger -->
    ${navLocked ? "" : `<button id="mobileNavBtn" class="md:hidden text-white text-2xl leading-none" aria-label="Open menu">&#9776;</button>`}
    <div class="hidden md:block w-6"></div><!-- spacer to balance logo -->
  </header>

  <!-- ══════════════════════════════════════════════════
       LEFT SIDEBAR (desktop, charcoal, grouped)
  ══════════════════════════════════════════════════ -->
  <aside id="app-sidebar"
    class="fixed top-14 left-0 bottom-0 z-30 hidden md:flex w-56 flex-col bg-[#2B2D35] border-r border-white/10 overflow-y-auto">

    <!-- Salon switcher -->
    ${(!navLocked && activeSalonName) ? `
    <a href="/manager/locations${qs}"
       class="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors">
      <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#3B72B9] text-white text-xs font-bold leading-none">
        ${activeSalonName.split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()}
      </span>
      <div class="min-w-0">
        <p class="text-xs font-semibold text-white truncate">${activeSalonName}</p>
        <p class="text-[10px] text-white/40 capitalize">${salonPlan || "trial"}</p>
      </div>
    </a>` : ""}

    <!-- Nav groups -->
    <nav class="flex-1 px-2 py-2">

      ${!navLocked ? navSection("Overview") : ""}
      ${!navLocked ? navItem("/manager",     ICONS.home,  "Dashboard",   "manager") : ""}
      ${!navLocked ? navItem("/analytics",   ICONS.chart, "Analytics",   "analytics") : ""}

      ${!navLocked ? navSection("Content") : ""}
      ${!navLocked ? navItem("/manager/queue",    ICONS.queue,    "Post Queue", "queue") : ""}
      ${!navLocked ? navItem("/manager/calendar", ICONS.calendar, "Calendar",   "calendar") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/manager/scheduler", ICONS.clock, "Scheduler", "scheduler") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/dashboard", ICONS.database, "Database", "database") : ""}

      ${(!navLocked && !isCoordinator) ? navSection("Team") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/manager/stylists",    ICONS.team,   "Team",        "team") : ""}
      ${!navLocked ? navItem("/manager/performance", ICONS.trophy, "Performance", "performance") : ""}

      ${(!navLocked && !isCoordinator) ? navSection("Brand") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/manager/vendors",      ICONS.tag,         "Vendors",      "vendors") : ""}
      ${(!navLocked && !isCoordinator && isPro) ? navItem("/manager/integrations", ICONS.integration, "Integrations", "integrations") : ""}

      ${(!navLocked && !isCoordinator) ? navSection("Settings") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/manager/locations", ICONS.building, "Locations", "locations") : ""}
      ${(!navLocked && !isCoordinator) ? navItem("/manager/admin",     ICONS.cog,      "Admin",     "admin") : ""}
      ${isOwner ? navItem("/manager/billing", ICONS.card, "Billing", "billing") : ""}

    </nav>

    <!-- Profile + Logout at bottom -->
    <div class="border-t border-white/10 px-2 py-2">
      ${!navLocked ? navItem("/manager/profile", ICONS.profile, "My Profile", "profile") : ""}
      ${navItem("/manager/logout", ICONS.logout, "Logout", "logout")}
    </div>
  </aside>

  <!-- ══════════════════════════════════════════════════
       MOBILE OVERLAY NAV
  ══════════════════════════════════════════════════ -->
  <div id="mobileNav" class="hidden fixed inset-0 z-50 flex-col bg-[#2B2D35] md:hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#3B72B9]">
      <img src="/public/logo/logo-trimmed.png" alt="MostlyPostly" class="h-7 w-auto" style="filter:brightness(0) invert(1);" />
      <button id="mobileNavClose" class="text-white text-3xl leading-none">&times;</button>
    </div>
    <nav class="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto text-white">
      ${!navLocked ? `<p class="pt-2 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Overview</p>` : ""}
      ${!navLocked ? mobileNavLink("/manager",   "Dashboard",  "manager") : ""}
      ${!navLocked ? mobileNavLink("/analytics", "Analytics",  "analytics") : ""}
      ${!navLocked ? `<p class="pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Content</p>` : ""}
      ${!navLocked ? mobileNavLink("/manager/queue",    "Post Queue", "queue") : ""}
      ${!navLocked ? mobileNavLink("/manager/calendar", "Calendar",   "calendar") : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/manager/scheduler", "Scheduler", "scheduler") : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/dashboard",         "Database",  "database") : ""}
      ${(!navLocked && !isCoordinator) ? `<p class="pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Team</p>` : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/manager/stylists",    "Team",        "team") : ""}
      ${!navLocked ? mobileNavLink("/manager/performance", "Performance", "performance") : ""}
      ${(!navLocked && !isCoordinator) ? `<p class="pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Brand</p>` : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/manager/vendors",      "Vendors",      "vendors") : ""}
      ${(!navLocked && !isCoordinator && isPro) ? mobileNavLink("/manager/integrations", "Integrations", "integrations") : ""}
      ${(!navLocked && !isCoordinator) ? `<p class="pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Settings</p>` : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/manager/locations", "Locations", "locations") : ""}
      ${(!navLocked && !isCoordinator) ? mobileNavLink("/manager/admin",     "Admin",     "admin") : ""}
      ${isOwner ? mobileNavLink("/manager/billing", "Billing", "billing") : ""}
      <p class="pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/35">Account</p>
      ${!navLocked ? mobileNavLink("/manager/profile", "My Profile", "profile") : ""}
      <a href="/manager/logout"
         class="block py-2.5 border-b border-white/10 text-sm font-medium text-white/60 hover:text-white transition-colors">
        Logout
      </a>
    </nav>
  </div>

  <!-- ══════════════════════════════════════════════════
       MAIN CONTENT
  ══════════════════════════════════════════════════ -->
  <div class="md:ml-56 pt-14 min-h-screen">
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      ${body}
    </main>
  </div>

  <script src="/public/admin.js"></script>
  <script>
    const mobileNavBtn   = document.getElementById("mobileNavBtn");
    const mobileNavClose = document.getElementById("mobileNavClose");
    const mobileNav      = document.getElementById("mobileNav");
    if (mobileNavBtn)   mobileNavBtn.onclick   = () => { mobileNav.classList.remove("hidden"); mobileNav.classList.add("flex"); };
    if (mobileNavClose) mobileNavClose.onclick = () => { mobileNav.classList.add("hidden"); mobileNav.classList.remove("flex"); };
  </script>

</body>
</html>
`;
}

// ══════════════════════════════════════════════════
// SVG Icons (Heroicons outline, 20px)
// ══════════════════════════════════════════════════
const ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>`,

  database: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m0 4.5c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>`,

  chart: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>`,

  clock: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>`,

  card: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21Z" />
  </svg>`,

  cog: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>`,

  logout: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
  </svg>`,

  profile: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>`,

  team: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>`,

  tag: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
  </svg>`,

  building: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
  </svg>`,

  queue: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
  </svg>`,

  calendar: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H18v-.008Zm0 2.25h.008v.008H18V15Z" />
  </svg>`,

  integration: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
  </svg>`,

  trophy: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </svg>`,
};
