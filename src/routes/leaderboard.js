// src/routes/leaderboard.js
// Public breakroom TV leaderboard — /leaderboard/:token
// No login required. Secured by an opaque random token.
// Auto-refreshes every 60 seconds. Designed for landscape TV display.

import express from "express";
import {
  getSalonByLeaderboardToken,
  getLeaderboard,
  isBonusActive,
  getBonusMultiplier,
} from "../core/gamification.js";

const router = express.Router();

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const medals = ["🥇", "🥈", "🥉"];

router.get("/:token", (req, res) => {
  const salon = getSalonByLeaderboardToken(req.params.token);
  if (!salon) {
    return res.status(404).send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#FDF8F6;color:#7A7C85">
        <p>Leaderboard not found. Ask your manager to share the correct link.</p>
      </body></html>
    `);
  }

  const period = "month"; // TV always shows current month
  const leaderboard = getLeaderboard(salon.slug, period);
  const bonusActive = isBonusActive(salon.slug);
  const multiplier  = getBonusMultiplier(salon.slug);

  const top3 = leaderboard.slice(0, 3);
  const rest  = leaderboard.slice(3, 10);

  // ── Top 3 podium ─────────────────────────────────────────────────────────
  // Display order: 2nd, 1st, 3rd for visual podium effect
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeights = top3[1] ? ["h-36", "h-48", "h-28"] : ["", "h-48", ""];

  const podiumCards = podiumOrder.map((s, i) => {
    const isCenter = i === 1;
    const height   = podiumHeights[i];
    const accentBg = isCenter ? "bg-mpAccent" : "bg-white/10";
    const textCol  = isCenter ? "text-white" : "text-slate-200";
    const nameSz   = isCenter ? "text-2xl" : "text-lg";
    const ptSz     = isCenter ? "text-4xl" : "text-2xl";
    const medal    = medals[s.rank - 1] || "";
    return `
      <div class="flex flex-col items-center gap-2 flex-1">
        <div class="text-4xl">${medal}</div>
        <div class="${nameSz} font-extrabold ${textCol} text-center leading-tight">${esc(s.stylist_name)}</div>
        <div class="${ptSz} font-black text-mpAccent">${s.points}<span class="text-base font-semibold text-slate-400 ml-1">pts</span></div>
        <div class="text-xs text-slate-400">${s.post_count} post${s.post_count !== 1 ? "s" : ""}${s.streak > 1 ? ` · 🔥 ${s.streak}wk` : ""}</div>
        <div class="${accentBg} w-full ${height} rounded-t-2xl"></div>
      </div>`;
  }).join("");

  // ── Rest of leaderboard ───────────────────────────────────────────────────
  const restRows = rest.map(s => `
    <div class="flex items-center gap-4 py-3 border-b border-white/10 last:border-0">
      <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-slate-300">${s.rank}</span>
      <span class="flex-1 text-lg font-semibold text-slate-200">${esc(s.stylist_name)}</span>
      <span class="text-mpAccent font-bold text-xl">${s.points} <span class="text-xs text-slate-400 font-normal">pts</span></span>
      <span class="text-slate-400 text-sm w-20 text-right">${s.post_count} posts</span>
      ${s.streak > 1 ? `<span class="text-sm text-slate-400 w-16 text-right">🔥 ${s.streak}wk</span>` : `<span class="w-16"></span>`}
    </div>`).join("");

  const emptyState = !leaderboard.length ? `
    <div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
      <p class="text-2xl font-bold">No posts yet this month</p>
      <p class="text-lg mt-2">Text a photo to get started!</p>
    </div>` : "";

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoHtml = salon.logo_url
    ? `<img src="${esc(salon.logo_url)}" alt="${esc(salon.name)}" class="h-12 w-auto object-contain" />`
    : `<span class="text-xl font-extrabold text-white">${esc(salon.name)}</span>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(salon.name)} — Leaderboard</title>
  <meta http-equiv="refresh" content="60" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: {
        fontFamily: { sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'] },
        colors: {
          mpAccent: "#D4897A",
          mpAccentLight: "#F2DDD9",
          mpCharcoal: "#2B2D35",
        }
      }}
    };
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', ui-sans-serif, sans-serif; }
    @keyframes pulse-slow { 0%,100% { opacity:1; } 50% { opacity:.6; } }
    .pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
  </style>
</head>
<body class="bg-[#1a1c22] text-white min-h-screen flex flex-col" style="font-family:'Plus Jakarta Sans',sans-serif">

  <!-- Header -->
  <header class="flex items-center justify-between px-10 py-5 border-b border-white/10">
    <div class="flex items-center gap-4">
      ${logoHtml}
      <div class="w-px h-8 bg-white/20"></div>
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-widest font-semibold">Team Leaderboard</p>
        <p class="text-sm font-bold text-slate-200">This Month</p>
      </div>
    </div>
    <div class="flex items-center gap-6">
      ${bonusActive ? `
      <div class="flex items-center gap-2 rounded-full bg-mpAccent/20 border border-mpAccent/40 px-5 py-2.5 pulse-slow">
        <span class="text-xl">🎯</span>
        <span class="text-sm font-bold text-mpAccent">${multiplier}× DOUBLE POINTS ACTIVE</span>
      </div>` : ""}
      <div class="text-right">
        <p class="text-xs text-slate-500 uppercase tracking-widest">Powered by</p>
        <p class="text-sm font-bold text-slate-300">MostlyPostly</p>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="flex-1 flex gap-8 px-10 py-8 overflow-hidden">

    <!-- Left: podium + rest -->
    <div class="flex-1 flex flex-col gap-8">

      ${emptyState}

      ${top3.length ? `
      <!-- Podium -->
      <div class="flex items-end justify-center gap-6 pb-4">
        ${podiumCards}
      </div>` : ""}

      ${rest.length ? `
      <!-- 4th–10th -->
      <div class="rounded-2xl bg-white/5 border border-white/10 px-6 py-2">
        ${restRows}
      </div>` : ""}

    </div>

  </main>

  <!-- Footer -->
  <footer class="px-10 py-4 border-t border-white/10 flex items-center justify-between">
    <p class="text-xs text-slate-600">Auto-refreshes every 60 seconds</p>
    <p class="text-xs text-slate-600">Points based on published posts · Streaks = consecutive weeks with a post</p>
  </footer>

</body>
</html>`);
});

export default router;
