// src/core/buildAvailabilityImage.js
// Parses availability text via GPT, picks a background photo,
// overlays appointment slots with sharp, returns a public URL.

import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve("public/uploads");
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Embed Open Sans ExtraBold (800) as base64 so librsvg/sharp can use it on any server
const FONT_PATH = path.resolve(__dirname, "../../node_modules/@fontsource/open-sans/files/open-sans-latin-800-normal.woff2");
const FONT_B64 = fs.existsSync(FONT_PATH)
  ? fs.readFileSync(FONT_PATH).toString("base64")
  : null;
const FONT_FACE = FONT_B64
  ? `@font-face { font-family: 'Open Sans'; font-weight: 800; src: url('data:font/woff2;base64,${FONT_B64}') format('woff2'); }`
  : "";

// Instagram Story: 9:16
const W = 1080;
const H = 1920;

// ─────────────────────────────────────────────────────────
// Parse availability slots from free-form text via GPT
// ─────────────────────────────────────────────────────────
export async function parseAvailabilitySlots(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [text]; // fallback: treat whole text as one slot

  const systemPrompt = `You extract appointment availability from a stylist's message.
Return ONLY a JSON array of concise slot strings. Each string should be max 35 chars.
Format each slot as: "Day: Time for Service" (e.g. "Friday: 2pm for Color Service")
If no service is mentioned, use: "Day: Time" (e.g. "Friday: 2pm")
If a time range is given, use: "Friday: 2pm–4pm for Color"
Use the actual day name (Monday, Tuesday, etc.) not a date number.
Examples: ["Friday: 2pm for Color Service", "Saturday: 10am–12pm", "Monday: 3pm for Highlights"]
If no clear times exist, return the message split into short meaningful lines.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 6);
  } catch (err) {
    console.warn("[Availability] Slot parse failed:", err.message);
  }

  // Fallback: split on commas or newlines
  return text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
}

// ─────────────────────────────────────────────────────────
// Pick background: stylist photo → salon stock → DALL-E
// ─────────────────────────────────────────────────────────
async function pickBackground(stylistId, salonId) {
  // 1. Personal photo — check both stylists and managers tables
  if (stylistId) {
    const stylistRow = db.prepare(`SELECT photo_url FROM stylists WHERE id = ?`).get(stylistId);
    if (stylistRow?.photo_url) {
      console.log("[Availability] Using stylist personal photo");
      return stylistRow.photo_url;
    }

    const managerRow = db.prepare(`SELECT photo_url FROM managers WHERE id = ?`).get(stylistId);
    if (managerRow?.photo_url) {
      console.log("[Availability] Using manager personal photo");
      return managerRow.photo_url;
    }

    // 2. Stylist-linked stock photo
    const stockStyled = db.prepare(
      `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id = ? LIMIT 1`
    ).get(salonId, stylistId);
    if (stockStyled?.url) {
      console.log("[Availability] Using stylist stock photo");
      return stockStyled.url;
    }
  }

  // 3. Salon-wide stock photo
  const stockSalon = db.prepare(
    `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id IS NULL ORDER BY created_at DESC LIMIT 1`
  ).get(salonId);
  if (stockSalon?.url) {
    console.log("[Availability] Using salon-wide stock photo");
    return stockSalon.url;
  }

  // 4. DALL-E generated background
  console.log("[Availability] No stock photo found — generating DALL-E background");
  return await generateDalleBackground();
}

async function generateDalleBackground() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "Vibrant editorial hair salon portrait, bold jewel-tone colors, electric teal and magenta accents, artistic fashion photography, dramatic studio lighting, colorful blurred bokeh, magazine cover aesthetic, ultra high-end glamour, vertical 9:16 portrait",
        n: 1,
        size: "1024x1792",
      }),
    });
    const data = await resp.json();
    const url = data?.data?.[0]?.url;
    if (url) {
      console.log("[Availability] DALL-E background generated");
      return url;
    }
  } catch (err) {
    console.warn("[Availability] DALL-E generation failed:", err.message);
  }
  return null;
}

async function fetchBuffer(url) {
  const isTwilio = /^https:\/\/api\.twilio\.com/i.test(url);
  const headers = isTwilio
    ? {
        Authorization: "Basic " + Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64"),
      }
    : {};
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────────────────
// Build the availability story image
// ─────────────────────────────────────────────────────────
function buildOverlaySvg({ slots, stylistName, salonName, bookingCta, instagramHandle }) {
  const slotLineHeight = 90;
  const slotsStartY = 980;

  const font = `'Open Sans', Arial, Helvetica, sans-serif`;

  // Studio 500 brand palette
  const NAVY    = "#03263B";
  const TEAL    = "#64B8B1";
  const CORAL   = "#FF6663";
  const L_BLUE  = "#BDDAE6";

  // Slot rows — teal pill background, white text
  const slotRows = slots.map((slot, i) => `
    <g>
      <rect x="60" y="${slotsStartY + i * slotLineHeight}" width="${W - 120}" height="72"
        rx="14" fill="${TEAL}" fill-opacity="0.30" />
      <line x1="60" y1="${slotsStartY + i * slotLineHeight}" x2="60" y2="${slotsStartY + i * slotLineHeight + 72}"
        stroke="${TEAL}" stroke-width="6" stroke-linecap="round"/>
      <text x="${W / 2}" y="${slotsStartY + i * slotLineHeight + 49}"
        font-family="${font}" font-size="38" font-weight="800"
        fill="white" text-anchor="middle">${escSvg(slot)}</text>
    </g>
  `).join("");

  return Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>${FONT_FACE}</style>
        <!-- Navy-heavy gradient so photo shows through in the middle -->
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${NAVY}" stop-opacity="0.88" />
          <stop offset="35%"  stop-color="${NAVY}" stop-opacity="0.30" />
          <stop offset="65%"  stop-color="${NAVY}" stop-opacity="0.30" />
          <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.92" />
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#grad)" />

      <!-- Salon name — light blue -->
      <text x="${W / 2}" y="560"
        font-family="${font}" font-size="48" font-weight="800"
        fill="${L_BLUE}" text-anchor="middle" letter-spacing="6">
        ${escSvg(salonName.toUpperCase())}
      </text>

      <!-- "NOW BOOKING" — white with teal underline bar -->
      <text x="${W / 2}" y="690"
        font-family="${font}" font-size="100" font-weight="800"
        fill="white" text-anchor="middle" letter-spacing="2">
        NOW BOOKING
      </text>
      <rect x="200" y="706" width="${W - 400}" height="6" rx="3" fill="${TEAL}" />

      <!-- Availability slots -->
      ${slotRows}

      <!-- Stylist name — white -->
      <text x="${W / 2}" y="${H - 215}"
        font-family="${font}" font-size="46" font-weight="800"
        fill="white" text-anchor="middle">
        ${escSvg(stylistName)}
      </text>

      ${instagramHandle ? `
      <!-- Instagram handle — teal pill -->
      <rect x="${W / 2 - 180}" y="${H - 196}" width="360" height="52" rx="26"
        fill="${TEAL}" fill-opacity="0.30" />
      <text x="${W / 2}" y="${H - 159}"
        font-family="${font}" font-size="30" font-weight="800"
        fill="${L_BLUE}" text-anchor="middle">
        @${escSvg(instagramHandle.replace(/^@/, ""))}
      </text>` : ""}

      <!-- Booking CTA — coral pill -->
      <rect x="100" y="${H - 120}" width="${W - 200}" height="80" rx="40"
        fill="${CORAL}" />
      <text x="${W / 2}" y="${H - 68}"
        font-family="${font}" font-size="34" font-weight="800"
        fill="white" text-anchor="middle">
        ${escSvg(bookingCta || "Book via link in bio.")}
      </text>
    </svg>
  `);
}

function escSvg(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the availability story image.
 *
 * @param {object} opts
 * @param {string}   opts.text        - Raw availability message from stylist
 * @param {string}   opts.stylistName
 * @param {string}   opts.salonName
 * @param {string}   opts.salonId
 * @param {string}   opts.stylistId
 * @param {string}   opts.bookingCta
 * @returns {Promise<string>}  Public URL of the saved story image
 */
export async function buildAvailabilityImage({ text, stylistName, salonName, salonId, stylistId, instagramHandle, bookingCta, submittedImageUrl }) {
  console.log("[Availability] Building story image…");

  // 1. Parse slots
  const slots = await parseAvailabilitySlots(text);
  console.log("[Availability] Slots parsed:", slots);

  // 2. Pick background — submitted photo wins, then stock/DALL-E
  const bgUrl = submittedImageUrl || await pickBackground(stylistId, salonId);

  // 3. Fetch and resize background to story dimensions
  let bgLayer;
  if (bgUrl) {
    try {
      const bgBuf = await fetchBuffer(bgUrl);
      bgLayer = await sharp(bgBuf)
        .resize(W, H, { fit: "cover", position: "center" })
        .toBuffer();
    } catch (err) {
      console.warn("[Availability] Background fetch failed, trying DALL-E:", err.message);
      // Photo URL unreachable (e.g. ephemeral file gone after deploy) — fall through to DALL-E
      const dalleUrl = await generateDalleBackground();
      if (dalleUrl) {
        try {
          const buf = await fetchBuffer(dalleUrl);
          bgLayer = await sharp(buf)
            .resize(W, H, { fit: "cover", position: "center" })
            .toBuffer();
        } catch { bgLayer = null; }
      }
    }
  }

  // Fallback: dark gradient solid background
  if (!bgLayer) {
    bgLayer = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 20, g: 20, b: 35 } },
    }).jpeg().toBuffer();
  }

  // 4. Build SVG overlay
  const overlay = buildOverlaySvg({ slots, stylistName, salonName, bookingCta, instagramHandle });

  // 5. Composite
  const finalBuf = await sharp(bgLayer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  // 6. Save and return public URL
  const fileName  = `availability-${Date.now()}.jpg`;
  const filePath  = path.join(PUBLIC_DIR, fileName);
  fs.writeFileSync(filePath, finalBuf);

  const base = (process.env.PUBLIC_BASE_URL || "https://localhost:3000").replace(/\/$/, "");
  const publicUrl = `${base}/uploads/${fileName}`;
  console.log("[Availability] Story image saved:", publicUrl);
  return publicUrl;
}
