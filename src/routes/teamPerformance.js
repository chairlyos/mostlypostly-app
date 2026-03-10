// src/routes/teamPerformance.js
// FEAT-015 — Team Performance & Gamification
// Manager-facing leaderboard, period reporting, double-points activation, TV URL.

import express from "express";
import { db } from "../../db.js";
import pageShell from "../ui/pageShell.js";
import {
  getLeaderboard,
  getSettings,
  getOrCreateSettings,
  activateBonus,
  deactivateBonus,
  isBonusActive,
  getBonusMultiplier,
  isShortage,
  getOrCreateLeaderboardToken,
  regenerateLeaderboardToken,
  DEFAULT_POINTS,
} from "../core/gamification.js";

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.manager?.manager_phone && !req.manager?.id) {
    return res.redirect("/manager/login");
  }
  next();
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PERIOD_LABELS = {
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
  all: "All Time",
};

const POST_TYPE_LABELS = {
  standard_post:     "Standard Post",
  before_after:      "Before & After",
  availability:      "Availability",
  promotions:        "Promotion",
  celebration:       "Celebration",
  product_education: "Product Education",
  vendor_promotion:  "Vendor Post",
};

// ─── GET /manager/performance ─────────────────────────────────────────────────
router.get("/", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const period   = ["week","month","quarter","year","all"].includes(req.query.period)
    ? req.query.period : "month";

  const salon = db.prepare(
    `SELECT name, logo_url, plan, plan_status FROM salons WHERE slug = ?`
  ).get(salon_id);

  getOrCreateSettings(salon_id);
  const settings   = getSettings(salon_id);
  const leaderboard = getLeaderboard(salon_id, period);
  const shortageInfo = isShortage(salon_id);
  const bonusActive  = isBonusActive(salon_id);
  const multiplier   = getBonusMultiplier(salon_id);
  const tvToken      = getOrCreateLeaderboardToken(salon_id);

  const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "";
  const tvUrl = `${BASE_URL}/leaderboard/${tvToken}`;

  // ── Period tabs ──────────────────────────────────────────────────────────
  const periodTabs = Object.entries(PERIOD_LABELS).map(([key, label]) => {
    const active = key === period;
    return `<a href="?period=${key}"
      class="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors
             ${active ? "bg-mpCharcoal text-white" : "bg-white border border-mpBorder text-mpMuted hover:border-mpAccent hover:text-mpCharcoal"}">
      ${label}
    </a>`;
  }).join("");

  // ── Shortage alert ────────────────────────────────────────────────────────
  const shortageAlert = shortageInfo.shortage ? `
    <div class="mb-6 flex items-start gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
      <span class="text-2xl flex-shrink-0">⚠️</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-yellow-800">Post queue is running low</p>
        <p class="text-xs text-yellow-700 mt-0.5">
          Only <strong>${shortageInfo.queued}</strong> post${shortageInfo.queued === 1 ? "" : "s"} scheduled
          for the next 7 days (target: ${shortageInfo.threshold}+).
          Consider enabling Double Points to motivate your team to submit more content.
        </p>
      </div>
      ${!bonusActive ? `
      <form method="POST" action="/manager/performance/bonus/activate" class="flex-shrink-0">
        <button class="rounded-full bg-yellow-600 px-4 py-2 text-xs font-bold text-white hover:bg-yellow-700 transition-colors">
          Activate Double Points
        </button>
      </form>` : ""}
    </div>` : "";

  // ── Bonus active banner ───────────────────────────────────────────────────
  const bonusUntil = settings?.bonus_active_until
    ? new Date(settings.bonus_active_until).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  const bonusBanner = bonusActive ? `
    <div class="mb-6 flex items-center gap-4 rounded-2xl border border-mpAccent/30 bg-mpAccentLight px-5 py-4">
      <span class="text-2xl">🎯</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-mpCharcoal">Double Points active — ${multiplier}× this period!</p>
        <p class="text-xs text-mpMuted mt-0.5">Active until ${bonusUntil}. Stylists earn ${multiplier}× points on every published post.</p>
      </div>
      <form method="POST" action="/manager/performance/bonus/deactivate" class="flex-shrink-0">
        <button class="rounded-full border border-mpBorder bg-white px-4 py-2 text-xs font-semibold text-mpMuted hover:text-mpCharcoal transition-colors">
          End Bonus
        </button>
      </form>
    </div>` : "";

  // ── Leaderboard table ────────────────────────────────────────────────────
  const medals = ["🥇","🥈","🥉"];

  const leaderboardRows = leaderboard.length ? leaderboard.map(s => {
    const medal = s.rank <= 3 ? `<span class="text-lg mr-1">${medals[s.rank - 1]}</span>` : `<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mpBg border border-mpBorder text-xs font-bold text-mpMuted">${s.rank}</span>`;
    const typeBreakdown = Object.entries(s.by_type)
      .map(([t, c]) => `${POST_TYPE_LABELS[t] || t}: ${c}`)
      .join(" · ") || "—";
    return `
      <tr class="border-b border-mpBorder hover:bg-mpBg transition-colors">
        <td class="py-3 px-4 flex items-center gap-2">${medal}</td>
        <td class="py-3 px-4 font-semibold text-mpCharcoal text-sm">${esc(s.stylist_name)}</td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center gap-1 rounded-full bg-mpAccentLight px-3 py-1 text-sm font-bold text-mpAccent">${s.points} pts</span>
        </td>
        <td class="py-3 px-4 text-center text-sm text-mpMuted">${s.post_count}</td>
        <td class="py-3 px-4 text-center text-sm text-mpMuted">${s.streak > 0 ? `🔥 ${s.streak}wk` : "—"}</td>
        <td class="py-3 px-4 text-xs text-mpMuted hidden lg:table-cell">${typeBreakdown}</td>
      </tr>`;
  }).join("") : `
    <tr>
      <td colspan="6" class="py-10 text-center text-sm text-mpMuted">
        No published posts for this period yet.
      </td>
    </tr>`;

  // ── Point values card ────────────────────────────────────────────────────
  const ptRows = Object.entries(DEFAULT_POINTS).map(([key, def]) => {
    const dbKey = `pts_${key}`;
    const current = settings?.[dbKey] ?? def;
    return `
      <div class="flex items-center justify-between py-2 border-b border-mpBorder last:border-0">
        <span class="text-sm text-mpCharcoal">${POST_TYPE_LABELS[key] || key}</span>
        <div class="flex items-center gap-2">
          <input type="number" name="${dbKey}" value="${current}" min="0" max="999"
            class="w-16 rounded-lg border border-mpBorder px-2 py-1 text-sm text-center text-mpCharcoal focus:border-mpAccent focus:outline-none" />
          <span class="text-xs text-mpMuted">pts</span>
        </div>
      </div>`;
  }).join("");

  const body = `
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold text-mpCharcoal">Team Performance</h1>
        <p class="mt-1 text-sm text-mpMuted">Leaderboard, posting activity, and team incentives.</p>
      </div>
      <div class="flex gap-2">
        <a href="/leaderboard/${tvToken}" target="_blank"
          class="rounded-full border border-mpBorder bg-white px-4 py-2.5 text-sm font-semibold text-mpCharcoal hover:border-mpAccent transition-colors">
          📺 TV Display →
        </a>
        ${!bonusActive ? `
        <form method="POST" action="/manager/performance/bonus/activate">
          <button class="rounded-full bg-mpCharcoal px-5 py-2.5 text-sm font-semibold text-white hover:bg-mpCharcoalDark transition-colors">
            🎯 Activate Double Points
          </button>
        </form>` : ""}
      </div>
    </div>

    ${shortageAlert}
    ${bonusBanner}

    <!-- Period filter -->
    <div class="mb-5 flex flex-wrap gap-2">${periodTabs}</div>

    <!-- Leaderboard -->
    <div class="rounded-2xl border border-mpBorder bg-white overflow-hidden mb-8">
      <div class="px-5 py-4 border-b border-mpBorder flex items-center justify-between">
        <h2 class="text-base font-bold text-mpCharcoal">Leaderboard — ${PERIOD_LABELS[period]}</h2>
        ${bonusActive ? `<span class="rounded-full bg-mpAccentLight px-3 py-1 text-xs font-bold text-mpAccent">🎯 ${multiplier}× Bonus Active</span>` : ""}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-mpBg">
            <tr class="text-xs font-semibold text-mpMuted uppercase tracking-wide border-b border-mpBorder">
              <th class="py-2 px-4">Rank</th>
              <th class="py-2 px-4">Stylist</th>
              <th class="py-2 px-4 text-center">Points</th>
              <th class="py-2 px-4 text-center">Posts</th>
              <th class="py-2 px-4 text-center">Streak</th>
              <th class="py-2 px-4 hidden lg:table-cell">Breakdown</th>
            </tr>
          </thead>
          <tbody>${leaderboardRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Settings + TV URL -->
    <div class="grid gap-6 lg:grid-cols-2">

      <!-- Point values -->
      <div class="rounded-2xl border border-mpBorder bg-white p-5">
        <h2 class="text-base font-bold text-mpCharcoal mb-1">Point Values</h2>
        <p class="text-xs text-mpMuted mb-4">Customize how many points each post type earns. Changes apply to future calculations for the current period.</p>
        <form method="POST" action="/manager/performance/settings">
          ${ptRows}
          <div class="mt-4 flex items-center gap-3">
            <div class="flex-1">
              <label class="text-xs font-semibold text-mpMuted">Low-queue alert threshold</label>
              <p class="text-xs text-mpMuted">Show shortage warning when fewer than this many posts are queued for the next 7 days.</p>
            </div>
            <input type="number" name="shortage_threshold"
              value="${settings?.shortage_threshold ?? 5}" min="1" max="99"
              class="w-16 rounded-lg border border-mpBorder px-2 py-1 text-sm text-center text-mpCharcoal focus:border-mpAccent focus:outline-none" />
          </div>
          <button type="submit"
            class="mt-4 w-full rounded-full bg-mpCharcoal py-2.5 text-sm font-semibold text-white hover:bg-mpCharcoalDark transition-colors">
            Save Settings
          </button>
        </form>
      </div>

      <!-- TV Display + Double Points settings -->
      <div class="space-y-5">

        <!-- TV URL card -->
        <div class="rounded-2xl border border-mpBorder bg-white p-5">
          <h2 class="text-base font-bold text-mpCharcoal mb-1">📺 Breakroom TV Display</h2>
          <p class="text-xs text-mpMuted mb-3">Share this URL with your TV or tablet — it auto-refreshes every 60 seconds. No login required.</p>
          <div class="flex items-center gap-2 rounded-xl bg-mpBg border border-mpBorder px-3 py-2 mb-3">
            <code class="flex-1 text-xs text-mpCharcoal break-all">${esc(tvUrl)}</code>
            <button onclick="navigator.clipboard.writeText('${esc(tvUrl)}').then(()=>this.textContent='Copied!').catch(()=>{})"
              class="shrink-0 rounded-lg border border-mpBorder bg-white px-3 py-1 text-xs font-semibold hover:border-mpAccent transition-colors">
              Copy
            </button>
          </div>
          <form method="POST" action="/manager/performance/regenerate-token"
            onsubmit="return confirm('This will break the current TV URL. Continue?')">
            <button class="text-xs text-mpMuted hover:text-red-500 underline transition-colors">
              Regenerate URL (breaks current link)
            </button>
          </form>
        </div>

        <!-- Double Points settings -->
        <div class="rounded-2xl border border-mpBorder bg-white p-5">
          <h2 class="text-base font-bold text-mpCharcoal mb-1">🎯 Double Points</h2>
          <p class="text-xs text-mpMuted mb-4">
            Activate a bonus multiplier to motivate your team during a slow week. Posts published while active earn ${multiplier > 1 ? multiplier : 2}× points.
            A banner appears on the TV leaderboard and stylist portal.
          </p>
          <form method="POST" action="/manager/performance/bonus/activate" class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs font-semibold text-mpMuted w-32">Multiplier</label>
              <select name="multiplier" class="flex-1 rounded-lg border border-mpBorder px-3 py-1.5 text-sm text-mpCharcoal focus:border-mpAccent focus:outline-none">
                <option value="2" ${!settings || settings.bonus_multiplier <= 2 ? "selected" : ""}>2× (Double Points)</option>
                <option value="3" ${settings?.bonus_multiplier === 3 ? "selected" : ""}>3× (Triple Points)</option>
              </select>
            </div>
            <div class="flex items-center gap-3">
              <label class="text-xs font-semibold text-mpMuted w-32">Duration</label>
              <select name="hours" class="flex-1 rounded-lg border border-mpBorder px-3 py-1.5 text-sm text-mpCharcoal focus:border-mpAccent focus:outline-none">
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72" selected>72 hours (3 days)</option>
                <option value="168">1 week</option>
              </select>
            </div>
            <button type="submit"
              class="w-full rounded-full ${bonusActive ? "bg-mpMuted" : "bg-mpAccent"} py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity">
              ${bonusActive ? "Update Bonus" : "Activate Bonus"}
            </button>
          </form>
          ${bonusActive ? `
          <form method="POST" action="/manager/performance/bonus/deactivate" class="mt-2">
            <button class="w-full rounded-full border border-mpBorder py-2 text-xs font-semibold text-mpMuted hover:text-red-500 hover:border-red-200 transition-colors">
              End Bonus Now
            </button>
          </form>` : ""}
        </div>

      </div>
    </div>
  `;

  res.send(pageShell({
    title: "Team Performance",
    body,
    current: "performance",
    salon_id,
    manager_phone: req.manager.manager_phone,
  }));
});

// ─── POST /manager/performance/settings ──────────────────────────────────────
router.post("/settings", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  getOrCreateSettings(salon_id);

  const fields = Object.keys(DEFAULT_POINTS).map(k => `pts_${k}`);
  const values = {};
  for (const f of fields) {
    const v = parseInt(req.body[f], 10);
    values[f] = isNaN(v) ? null : Math.max(0, Math.min(999, v));
  }
  const shortage = parseInt(req.body.shortage_threshold, 10);
  values.shortage_threshold = isNaN(shortage) ? 5 : Math.max(1, Math.min(99, shortage));

  const setClauses = [...fields.map(f => `${f} = @${f}`), "shortage_threshold = @shortage_threshold", "updated_at = datetime('now')"].join(", ");
  db.prepare(`UPDATE gamification_settings SET ${setClauses} WHERE salon_id = @salon_id`)
    .run({ ...values, salon_id });

  res.redirect("/manager/performance?saved=1");
});

// ─── POST /manager/performance/bonus/activate ─────────────────────────────────
router.post("/bonus/activate", requireAuth, (req, res) => {
  const salon_id = req.manager.salon_id;
  const multiplier = parseFloat(req.body.multiplier) || 2;
  const hours = parseInt(req.body.hours, 10) || 72;
  getOrCreateSettings(salon_id);
  activateBonus(salon_id, multiplier, hours);
  res.redirect("/manager/performance");
});

// ─── POST /manager/performance/bonus/deactivate ───────────────────────────────
router.post("/bonus/deactivate", requireAuth, (req, res) => {
  deactivateBonus(req.manager.salon_id);
  res.redirect("/manager/performance");
});

// ─── POST /manager/performance/regenerate-token ───────────────────────────────
router.post("/regenerate-token", requireAuth, (req, res) => {
  regenerateLeaderboardToken(req.manager.salon_id);
  res.redirect("/manager/performance");
});

export default router;
