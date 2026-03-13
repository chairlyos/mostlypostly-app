// src/core/buildAvailabilityImage.js
// Parses availability text via GPT, picks a background photo,
// overlays appointment slots with sharp, returns a public URL.

import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../../db.js";
import { UPLOADS_DIR, toUploadUrl } from "./uploadPath.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
// Pick background: stylist photo → stylist stock → salon stock → Pexels
// ─────────────────────────────────────────────────────────
import { fetchPexelsBackground } from "./pexels.js";

function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function pickBackground(stylistId, salonId) {
  // 1. Personal profile photo from stylists table
  if (stylistId) {
    const stylistRow = db.prepare(`SELECT photo_url FROM stylists WHERE id = ?`).get(stylistId);
    if (stylistRow?.photo_url) {
      console.log("[Availability] Using stylist personal photo");
      return stylistRow.photo_url;
    }

    // 2. Stylist-linked stock photos — pick randomly for variety
    const stylistPhotos = db.prepare(
      `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id = ? ORDER BY RANDOM() LIMIT 5`
    ).all(salonId, stylistId);
    const pick = pickRandom(stylistPhotos);
    if (pick?.url) {
      console.log("[Availability] Using stylist stock photo");
      return pick.url;
    }
  }

  // 3. Salon-wide stock photos — pick randomly
  const salonPhotos = db.prepare(
    `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id IS NULL ORDER BY RANDOM() LIMIT 10`
  ).all(salonId);
  const salonPick = pickRandom(salonPhotos);
  if (salonPick?.url) {
    console.log("[Availability] Using salon-wide stock photo");
    return salonPick.url;
  }

  // 4. Pexels real photo fallback
  console.log("[Availability] No stock photo found — fetching Pexels background");
  return await fetchPexelsBackground("availability");
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
// Parse a hex color to {r,g,b}
// ─────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = (hex || "#2B2D35").replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

// ─────────────────────────────────────────────────────────
// Extract day abbreviation from "Friday: 2pm for Color" → { day: "FRI", rest: "2pm for Color" }
// ─────────────────────────────────────────────────────────
function parseDayFromSlot(slot) {
  const match = slot.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\s:,]*/i);
  if (match) {
    const day = match[1].slice(0, 3).toUpperCase();
    const rest = slot.slice(match[0].length).trim().replace(/^[:\-]\s*/, "");
    return { day, rest };
  }
  return { day: null, rest: slot };
}

// ─────────────────────────────────────────────────────────
// Build the availability story image
//
// Design inspired by real salon Instagram story examples:
// - Full photo fills entire frame (photo breathes, minimal overlay)
// - Torn-paper white header card at top contains "NOW BOOKING" + salon name
//   (torn bottom edge = artistic, custom salon feel — not corporate)
// - Individual floating pill cards per time slot (accent badge + service text)
//   inspired by the date-badge + slot-text layout from real stylist posts
// - Bottom: stylist @handle + CTA pill on subtle dark gradient
// ─────────────────────────────────────────────────────────
function buildOverlaySvg({ slots, stylistName, salonName, bookingCta, instagramHandle, palette }) {
  const font = `'Open Sans', Arial, Helvetica, sans-serif`;

  // Brand colors
  const ACCENT  = palette?.cta || palette?.accent || "#3B72B9";
  const DARK    = palette?.primary || "#1a1c22";
  const { r: dr, g: dg, b: db } = hexToRgb(DARK);

  // ── TORN HEADER CARD ──────────────────────────────────
  // White card at top of frame with a jagged/torn bottom edge.
  // The torn edge goes right-to-left so the path closes cleanly.
  const CL = 60;          // card left x
  const CR = W - 60;      // card right x (1020)
  const CT = 90;          // card top y
  const TORN_R = 16;      // corner radius

  // Torn bottom edge — interior points running right→left (excludes endpoints which are on card sides)
  // Straight L-commands between irregular Y offsets = torn paper look (not wave)
  const tornInner = [
    [950, 378], [870, 422], [790, 388],
    [710, 418], [630, 382], [550, 415], [470, 385],
    [390, 420], [310, 386], [220, 416], [140, 385],
  ];
  const tornStr = tornInner.map(([x, y]) => `L ${x},${y}`).join(" ");

  // Card path (clockwise): top-left → top-right → down right side →
  // torn bottom edge right→left → up left side → close
  const cardPath = `
    M ${CL + TORN_R},${CT}
    L ${CR - TORN_R},${CT}
    Q ${CR},${CT} ${CR},${CT + TORN_R}
    L ${CR},410
    ${tornStr}
    L ${CL},408
    L ${CL},${CT + TORN_R}
    Q ${CL},${CT} ${CL + TORN_R},${CT}
    Z
  `;

  // Drop shadow path — same shape offset 5px down/right
  const shadowInner = tornInner.map(([x, y]) => `L ${x + 5},${y + 5}`).join(" ");
  const shadowPath = `
    M ${CL + TORN_R + 5},${CT + 5}
    L ${CR - TORN_R + 5},${CT + 5}
    Q ${CR + 5},${CT + 5} ${CR + 5},${CT + TORN_R + 5}
    L ${CR + 5},415
    ${shadowInner}
    L ${CL + 5},413
    L ${CL + 5},${CT + TORN_R + 5}
    Q ${CL + 5},${CT + 5} ${CL + TORN_R + 5},${CT + 5}
    Z
  `;

  // ── SLOT PILLS ─────────────────────────────────────────
  // Individual floating pill cards for each time slot.
  // Left portion = accent-colored day badge; right = service + time text.
  // A clipPath per pill keeps the accent badge inside the rounded corners.
  const SLOT_START = 480;
  const SLOT_H     = 120;
  const SLOT_GAP   = 20;
  const slotCount  = Math.min(slots.length, 5);
  const BADGE_W    = 172; // width of accent day badge

  const slotCards = slots.slice(0, slotCount).map((slot, i) => {
    const y   = SLOT_START + i * (SLOT_H + SLOT_GAP);
    const cy  = y + SLOT_H / 2;  // vertical center
    const rx  = SLOT_H / 2;      // full pill radius
    const { day, rest } = parseDayFromSlot(slot);
    const label = day || String(i + 1);
    const text  = rest.length > 34 ? rest.slice(0, 33) + "…" : rest;

    return `
      <defs>
        <clipPath id="pill${i}">
          <rect x="${CL}" y="${y}" width="${CR - CL}" height="${SLOT_H}" rx="${rx}"/>
        </clipPath>
      </defs>
      <!-- Pill shadow -->
      <rect x="${CL + 4}" y="${y + 6}" width="${CR - CL}" height="${SLOT_H}" rx="${rx}"
        fill="black" fill-opacity="0.18"/>
      <!-- White pill -->
      <rect x="${CL}" y="${y}" width="${CR - CL}" height="${SLOT_H}" rx="${rx}"
        fill="white" fill-opacity="0.93"/>
      <!-- Accent badge (clipped to pill) -->
      <g clip-path="url(#pill${i})">
        <rect x="${CL}" y="${y}" width="${BADGE_W}" height="${SLOT_H}" fill="${ACCENT}"/>
      </g>
      <!-- Day label -->
      <text x="${CL + BADGE_W / 2}" y="${cy + 1}"
        font-family="${font}" font-size="38" font-weight="800"
        fill="white" text-anchor="middle" dominant-baseline="middle">
        ${escSvg(label)}
      </text>
      <!-- Service + time text -->
      <text x="${CL + BADGE_W + 28}" y="${cy + 1}"
        font-family="${font}" font-size="34" font-weight="700"
        fill="rgba(${dr},${dg},${db},0.92)" dominant-baseline="middle">
        ${escSvg(text)}
      </text>
    `;
  }).join("");

  // Bottom gradient starts 320px above bottom for handle/CTA legibility
  const BOT_Y = H - 340;

  return Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>${FONT_FACE}</style>
        <!-- Subtle edge vignette — photo stays vivid -->
        <radialGradient id="vign" cx="50%" cy="42%" r="68%">
          <stop offset="0%"   stop-color="black" stop-opacity="0"/>
          <stop offset="82%"  stop-color="black" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.30"/>
        </radialGradient>
        <!-- Bottom gradient for handle + CTA text readability -->
        <linearGradient id="botFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="black" stop-opacity="0"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.76"/>
        </linearGradient>
      </defs>

      <!-- Edge vignette — very light, photo breathes through -->
      <rect width="${W}" height="${H}" fill="url(#vign)"/>

      <!-- Bottom gradient for text legibility -->
      <rect x="0" y="${BOT_Y}" width="${W}" height="${H - BOT_Y}" fill="url(#botFade)"/>

      <!-- Torn header card: drop shadow -->
      <path d="${shadowPath}" fill="black" fill-opacity="0.16"/>

      <!-- Torn header card: white -->
      <path d="${cardPath}" fill="white" fill-opacity="0.95"/>

      <!-- Accent stripe at very top of card (brand pop) -->
      <rect x="${CL + TORN_R}" y="${CT}" width="${CR - CL - TORN_R * 2}" height="7"
        fill="${ACCENT}"/>

      <!-- Salon name eyebrow -->
      <text x="${W / 2}" y="${CT + 58}"
        font-family="${font}" font-size="21" font-weight="800"
        fill="${ACCENT}" text-anchor="middle" letter-spacing="6">
        ${escSvg(salonName.toUpperCase())}
      </text>

      <!-- NOW BOOKING — large punchy headline inside torn card -->
      <text x="${W / 2}" y="${CT + 170}"
        font-family="${font}" font-size="108" font-weight="800"
        fill="rgba(${dr},${dg},${db},0.95)" text-anchor="middle" letter-spacing="-3">
        NOW
      </text>
      <text x="${W / 2}" y="${CT + 288}"
        font-family="${font}" font-size="108" font-weight="800"
        fill="rgba(${dr},${dg},${db},0.95)" text-anchor="middle" letter-spacing="-3">
        BOOKING
      </text>

      <!-- Individual slot pill cards -->
      ${slotCards}

      <!-- Stylist name -->
      <text x="${W / 2}" y="${H - 178}"
        font-family="${font}" font-size="38" font-weight="700"
        fill="white" text-anchor="middle">
        ${escSvg(stylistName)}
      </text>

      ${instagramHandle ? `
      <!-- Instagram handle -->
      <text x="${W / 2}" y="${H - 124}"
        font-family="${font}" font-size="30" font-weight="600"
        fill="${ACCENT}" text-anchor="middle">
        @${escSvg(instagramHandle.replace(/^@/, ""))}
      </text>` : ""}

      <!-- CTA pill -->
      <rect x="180" y="${H - 90}" width="720" height="66" rx="33"
        fill="${ACCENT}" fill-opacity="0.95"/>
      <text x="${W / 2}" y="${H - 47}"
        font-family="${font}" font-size="28" font-weight="800"
        fill="white" text-anchor="middle">
        ${escSvg(bookingCta || "Book via link in bio")}
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
  // Slight modulate: keep saturation vivid (photo should feel present)
  // but reduce brightness a touch so the torn panel text pops
  let bgLayer;
  if (bgUrl) {
    try {
      const bgBuf = await fetchBuffer(bgUrl);
      bgLayer = await sharp(bgBuf)
        .resize(W, H, { fit: "cover", position: "center" })
        .modulate({ brightness: 0.88, saturation: 1.05 })
        .toBuffer();
    } catch (err) {
      console.warn("[Availability] Background fetch failed, trying Pexels:", err.message);
      const pexelsUrl = await fetchPexelsBackground("availability");
      if (pexelsUrl) {
        try {
          const buf = await fetchBuffer(pexelsUrl);
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

  // 4. Load brand palette from DB
  let palette = null;
  try {
    const salonRow = db.prepare("SELECT brand_palette FROM salons WHERE slug = ?").get(salonId);
    if (salonRow?.brand_palette) palette = JSON.parse(salonRow.brand_palette);
  } catch { /* use defaults */ }

  // 5. Build SVG overlay
  const overlay = buildOverlaySvg({ slots, stylistName, salonName, bookingCta, instagramHandle, palette });

  // 5. Composite
  const finalBuf = await sharp(bgLayer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  // 6. Save and return public URL
  const fileName  = `availability-${Date.now()}.jpg`;
  const filePath  = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, finalBuf);

  const publicUrl = toUploadUrl(fileName);
  console.log("[Availability] Story image saved:", publicUrl);
  return publicUrl;
}
