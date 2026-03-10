// src/routes/integrations.js
// Zenoti (and future Vagaro) webhook receiver + Admin integrations UI

import express from "express";
import crypto from "crypto";
import db from "../../db.js";
import pageShell from "../ui/pageShell.js";
import { handleZenotiEvent, handleVagaroEvent } from "../core/integrationHandlers.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// Auth guard (same pattern used across all manager routes)
// ─────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.manager || !req.manager.manager_phone) {
    return res.redirect("/manager/login");
  }
  next();
}

// ─────────────────────────────────────────────────────────────────
// GET /manager/integrations — admin UI card
// ─────────────────────────────────────────────────────────────────
router.get("/", requireAuth, (req, res) => {
  const salon_id = req.manager?.salon_id;
  const manager_phone = req.manager?.manager_phone;

  const salon = db.prepare(`SELECT * FROM salons WHERE slug = ?`).get(salon_id);
  if (!salon) return res.redirect("/manager/login");

  // Load existing integration rows
  const integrations = db
    .prepare(`SELECT * FROM salon_integrations WHERE salon_id = ?`)
    .all(salon_id);

  const byPlatform = {};
  for (const row of integrations) byPlatform[row.platform] = row;

  const zenoti = byPlatform["zenoti"] || null;
  const vagaro = byPlatform["vagaro"] || null;

  // Webhook URL that Zenoti should POST to
  const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "";
  const zenotiWebhookUrl = `${BASE_URL}/integrations/webhook/zenoti/${salon_id}`;

  const body = `
    <section class="mb-6">
      <h1 class="text-2xl font-bold mb-1">Integrations</h1>
      <p class="text-sm text-mpMuted">Connect your salon booking software to unlock automatic content nudges, richer AI captions, and utilization-aware posting.</p>
    </section>

    <!-- ZENOTI -->
    <section class="mb-6">
      <div class="rounded-2xl border border-mpBorder bg-white px-5 py-5">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-sm font-semibold text-mpCharcoal">Zenoti</h2>
              ${zenoti
                ? `<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">● Connected</span>`
                : `<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-mpMuted">Not connected</span>`}
            </div>
            <p class="text-xs text-mpMuted">Enterprise salon & spa booking platform. When an appointment completes, MostlyPostly automatically texts your stylist to snap a photo.</p>
          </div>
        </div>

        ${zenoti ? `
        <!-- Connected state -->
        <div class="mb-4 rounded-xl bg-mpBg border border-mpBorder p-3 text-xs space-y-1.5">
          <div class="flex justify-between">
            <span class="text-mpMuted">Center ID</span>
            <span class="font-mono text-mpCharcoal">${zenoti.center_id || "—"}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-mpMuted">API Key</span>
            <span class="font-mono text-mpCharcoal">${zenoti.api_key ? "••••••••" + zenoti.api_key.slice(-4) : "—"}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-mpMuted">Nudges enabled</span>
            <span class="text-mpCharcoal font-semibold">${zenoti.sync_enabled ? "Yes" : "No"}</span>
          </div>
          ${zenoti.last_event_at ? `
          <div class="flex justify-between">
            <span class="text-mpMuted">Last event</span>
            <span class="text-mpCharcoal">${zenoti.last_event_at}</span>
          </div>` : ""}
        </div>

        <!-- Webhook URL -->
        <div class="mb-4">
          <p class="text-xs text-mpMuted mb-1 font-medium">Webhook URL (paste into Zenoti → Settings → Webhooks)</p>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-[11px] font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-mpCharcoal overflow-x-auto">${zenotiWebhookUrl}</code>
            <button onclick="navigator.clipboard.writeText('${zenotiWebhookUrl}').then(()=>this.textContent='Copied!')"
              class="text-xs px-3 py-2 rounded-lg border border-mpBorder bg-white hover:bg-mpBg text-mpCharcoal whitespace-nowrap">Copy</button>
          </div>
          <p class="text-[11px] text-mpMuted mt-1">Subscribe to: <strong>appointment.completed</strong> (and optionally employee.created)</p>
        </div>

        <!-- Stylist ID Mapping -->
        <div class="mb-4">
          <p class="text-xs font-semibold text-mpCharcoal mb-2">Stylist → Zenoti Employee ID Mapping</p>
          <p class="text-xs text-mpMuted mb-2">Enter each stylist's Zenoti employee ID so MostlyPostly can match webhook events to the right stylist.</p>
          ${(() => {
            const stylists = db.prepare(
              `SELECT id, name, integration_employee_id FROM stylists WHERE salon_id = ? ORDER BY name ASC`
            ).all(salon_id);
            if (!stylists.length) return `<p class="text-xs text-mpMuted italic">No stylists added yet. <a href="/manager/stylists" class="underline text-mpAccent">Add stylists →</a></p>`;
            return `<form method="POST" action="/manager/integrations/zenoti/map-employees" class="space-y-2">
              ${stylists.map(s => `
                <div class="flex items-center gap-3">
                  <span class="text-xs text-mpCharcoal w-36 font-medium truncate">${s.name}</span>
                  <input type="hidden" name="stylist_id[]" value="${s.id}" />
                  <input type="text" name="employee_id[]"
                    value="${s.integration_employee_id || ""}"
                    placeholder="Zenoti employee UUID"
                    class="flex-1 text-xs font-mono rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-mpCharcoal placeholder:text-gray-400 focus:outline-none focus:border-mpAccent" />
                </div>`).join("")}
              <button type="submit" class="mt-2 rounded-full bg-mpCharcoal px-4 py-2 text-xs font-semibold text-white hover:bg-mpCharcoalDark transition-colors">Save Mappings</button>
            </form>`;
          })()}
        </div>

        <!-- Disconnect -->
        <form method="POST" action="/manager/integrations/zenoti/disconnect" onsubmit="return confirm('Disconnect Zenoti integration?')">
          <button class="text-xs text-red-400 hover:text-red-600 underline">Disconnect Zenoti</button>
        </form>
        ` : `
        <!-- Connect form -->
        <form method="POST" action="/manager/integrations/zenoti/connect" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-mpCharcoal mb-1">Zenoti API Key</label>
            <input type="text" name="api_key" placeholder="Paste your Zenoti API key" required
              class="w-full text-sm rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-mpCharcoal placeholder:text-gray-400 focus:outline-none focus:border-mpAccent" />
            <p class="text-[11px] text-mpMuted mt-1">Found in Zenoti → Admin → API Keys → Generate Key</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-mpCharcoal mb-1">Center ID</label>
            <input type="text" name="center_id" placeholder="Your Zenoti center ID (UUID)"
              class="w-full text-sm rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-mpCharcoal placeholder:text-gray-400 focus:outline-none focus:border-mpAccent" />
            <p class="text-[11px] text-mpMuted mt-1">Found in Zenoti → Settings → Organization → Centers</p>
          </div>
          <button type="submit"
            class="rounded-full bg-mpCharcoal px-5 py-2 text-xs font-semibold text-white hover:bg-mpCharcoalDark transition-colors">
            Connect Zenoti
          </button>
        </form>
        `}
      </div>
    </section>

    <!-- VAGARO — Coming Soon -->
    <section class="mb-6">
      <div class="rounded-2xl border border-mpBorder bg-white px-5 py-5 opacity-75">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-sm font-semibold text-mpCharcoal">Vagaro</h2>
              <span class="inline-flex items-center rounded-full bg-mpAccentLight px-2 py-0.5 text-[11px] font-semibold text-mpAccent">Coming Soon</span>
            </div>
            <p class="text-xs text-mpMuted">Independent salon booking platform. Appointment-completed nudges, stylist sync, and utilization data — same workflow as Zenoti.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Boulevard & Mindbody — Coming Soon -->
    <section class="mb-6 grid gap-4 md:grid-cols-2">
      ${["Boulevard", "Mindbody"].map(name => `
      <div class="rounded-2xl border border-mpBorder bg-white px-4 py-4 opacity-60">
        <div class="flex items-center gap-2 mb-1">
          <h2 class="text-sm font-semibold text-mpCharcoal">${name}</h2>
          <span class="inline-flex items-center rounded-full bg-mpAccentLight px-2 py-0.5 text-[11px] font-semibold text-mpAccent">Coming Soon</span>
        </div>
        <p class="text-xs text-mpMuted">Booking system integration — photo nudges and utilization awareness on the roadmap.</p>
      </div>`).join("")}
    </section>
  `;

  res.send(
    pageShell({
      title: "Integrations",
      body,
      salon_id,
      manager_phone,
      current: "integrations",
    })
  );
});

// ─────────────────────────────────────────────────────────────────
// POST /manager/integrations/zenoti/connect
// ─────────────────────────────────────────────────────────────────
router.post("/zenoti/connect", requireAuth, (req, res) => {
  const salon_id = req.manager?.salon_id;
  const { api_key, center_id } = req.body;

  if (!api_key) return res.redirect("/manager/integrations?error=missing_key");

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO salon_integrations (id, salon_id, platform, api_key, center_id, sync_enabled, connected_at)
     VALUES (?, ?, 'zenoti', ?, ?, 1, datetime('now'))
     ON CONFLICT(salon_id, platform) DO UPDATE SET
       api_key = excluded.api_key,
       center_id = excluded.center_id,
       sync_enabled = 1,
       connected_at = excluded.connected_at`
  ).run(id, salon_id, api_key.trim(), (center_id || "").trim());

  console.log(`[Integrations] Zenoti connected for salon=${salon_id}`);
  res.redirect("/manager/integrations?connected=zenoti");
});

// ─────────────────────────────────────────────────────────────────
// POST /manager/integrations/zenoti/disconnect
// ─────────────────────────────────────────────────────────────────
router.post("/zenoti/disconnect", requireAuth, (req, res) => {
  const salon_id = req.manager?.salon_id;
  db.prepare(`DELETE FROM salon_integrations WHERE salon_id = ? AND platform = 'zenoti'`).run(salon_id);
  console.log(`[Integrations] Zenoti disconnected for salon=${salon_id}`);
  res.redirect("/manager/integrations");
});

// ─────────────────────────────────────────────────────────────────
// POST /manager/integrations/zenoti/map-employees
// Saves Zenoti employee UUIDs onto each stylist row
// ─────────────────────────────────────────────────────────────────
router.post("/zenoti/map-employees", requireAuth, (req, res) => {
  const salon_id = req.manager?.salon_id;
  const stylistIds = [].concat(req.body["stylist_id[]"] || []);
  const employeeIds = [].concat(req.body["employee_id[]"] || []);

  const stmt = db.prepare(
    `UPDATE stylists SET integration_employee_id = ? WHERE id = ? AND salon_id = ?`
  );
  const update = db.transaction(() => {
    for (let i = 0; i < stylistIds.length; i++) {
      stmt.run((employeeIds[i] || "").trim() || null, stylistIds[i], salon_id);
    }
  });
  update();

  res.redirect("/manager/integrations?saved=mappings");
});

// ─────────────────────────────────────────────────────────────────
// POST /integrations/webhook/zenoti/:salon_id
// Public webhook endpoint — Zenoti calls this when events fire.
// No session auth — uses webhook secret for verification.
// ─────────────────────────────────────────────────────────────────
router.post("/webhook/zenoti/:salon_id", express.json(), async (req, res) => {
  const { salon_id } = req.params;

  // Look up the integration row to get webhook_secret (optional)
  const integration = db
    .prepare(`SELECT * FROM salon_integrations WHERE salon_id = ? AND platform = 'zenoti'`)
    .get(salon_id);

  if (!integration) {
    console.warn(`[Zenoti Webhook] No integration found for salon=${salon_id}`);
    return res.status(404).json({ error: "Integration not configured" });
  }

  if (!integration.sync_enabled) {
    return res.status(200).json({ ok: true, skipped: "sync disabled" });
  }

  // Optional HMAC verification using stored webhook_secret
  if (integration.webhook_secret) {
    const signature = req.headers["x-zenoti-signature"] || req.headers["x-hub-signature-256"] || "";
    const rawBody = JSON.stringify(req.body);
    const expected = "sha256=" + crypto
      .createHmac("sha256", integration.webhook_secret)
      .update(rawBody)
      .digest("hex");
    if (signature !== expected) {
      console.warn(`[Zenoti Webhook] Signature mismatch for salon=${salon_id}`);
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  // Determine event type from payload or header
  const eventType =
    req.headers["x-zenoti-event"] ||
    req.body?.event_type ||
    req.body?.event ||
    req.body?.type ||
    "unknown";

  // Respond immediately — process async
  res.status(200).json({ received: true });

  try {
    await handleZenotiEvent(salon_id, eventType, req.body);
  } catch (err) {
    console.error(`[Zenoti Webhook] Handler error salon=${salon_id}:`, err.message);
  }
});

export default router;
