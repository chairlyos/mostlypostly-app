// src/routes/demoRequest.js
// Public endpoint: POST /api/demo-request
// Receives demo request form data, sends notification email to troy@mostlypostly.com
// No auth required — called from mostlypostly-site demo page.

import express from "express";
import { sendEmail } from "../core/email.js";

const router = express.Router();

const NOTIFY_TO = "troy@mostlypostly.com";

// Rate limit: simple in-memory counter per IP (max 3 submissions per 10 min)
const submissionMap = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const window = 10 * 60 * 1000;
  const entry = submissionMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > window) { submissionMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= 3) return true;
  entry.count++;
  submissionMap.set(ip, entry);
  return false;
}

// Allow cross-origin requests from the marketing site
router.use((req, res, next) => {
  const allowed = ["https://mostlypostly.com", "https://mostlypostly-staging-site.onrender.com"];
  const origin  = req.headers.origin || "";
  if (allowed.includes(origin) || origin.includes("localhost")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// POST /api/demo-request
router.post("/", async (req, res) => {
  const ip = req.ip || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "Too many submissions. Please try again later." });
  }

  const {
    name, salonName, email, phone,
    teamSize, postingFrequency, platforms, challenge,
  } = req.body;

  if (!name || !email || !salonName) {
    return res.status(400).json({ ok: false, error: "Name, salon name, and email are required." });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Invalid email address." });
  }

  const platformList = Array.isArray(platforms) ? platforms.join(", ") : (platforms || "Not specified");

  function row(label, value) {
    if (!value) return "";
    return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#6B7280;font-weight:600;width:40%;vertical-align:top;">${label}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#1F2933;vertical-align:top;">${value}</td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Demo Request</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#3B72B9;padding:24px 32px;">
              <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">New Demo Request</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Someone wants to see MostlyPostly in action</p>
            </td></tr>
            <tr><td style="padding:24px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;">
                ${row("Name", name)}
                ${row("Salon Name", salonName)}
                ${row("Email", `<a href="mailto:${email}" style="color:#3B72B9;">${email}</a>`)}
                ${row("Phone", phone || "Not provided")}
                ${row("Team Size", teamSize || "Not specified")}
                ${row("Posts Per Week", postingFrequency || "Not specified")}
                ${row("Active Platforms", platformList)}
                ${row("Biggest Challenge", challenge ? `<em>${challenge}</em>` : null)}
              </table>
            </td></tr>
            <tr><td style="padding:20px 32px 28px;">
              <a href="mailto:${email}?subject=Let's schedule your MostlyPostly demo!" style="display:inline-block;background:#3B72B9;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px;">Reply to ${name} &rarr;</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 0 0;text-align:center;font-size:12px;color:#9CA3AF;">MostlyPostly &nbsp;·&nbsp; Carmel, Indiana</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: NOTIFY_TO,
    subject: `Demo request from ${name} — ${salonName}`,
    html,
  });

  res.json({ ok: true });
});

export default router;
