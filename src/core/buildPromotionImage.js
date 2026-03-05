// src/core/buildPromotionImage.js
// Builds a 1080x1920 promotional story image using sharp.
// Background: salon stock photo → DALL-E → solid fallback

import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { db } from "../../db.js";

const PUBLIC_DIR = path.resolve("public/uploads");
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const W = 1080;
const H = 1920;

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function pickBackground(salonId) {
  const row = db.prepare(
    `SELECT url FROM stock_photos WHERE salon_id = ? AND stylist_id IS NULL ORDER BY created_at DESC LIMIT 1`
  ).get(salonId);
  if (row?.url) return row.url;

  // DALL-E fallback
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: "Luxurious modern hair salon, soft warm lighting, elegant bokeh, vertical story format, rich dark tones, professional photography",
          n: 1,
          size: "1024x1792",
        }),
      });
      const data = await resp.json();
      if (data?.data?.[0]?.url) return data.data[0].url;
    } catch (err) {
      console.warn("[Promotion] DALL-E failed:", err.message);
    }
  }
  return null;
}

function buildOverlaySvg({ salonName, product, discount, specialText, expiresLabel }) {
  // Accent color: warm gold
  const gold = "#F5C842";

  const discountBlock = discount ? `
    <rect x="190" y="620" width="${W - 380}" height="130" rx="20" fill="${gold}" />
    <text x="${W / 2}" y="700" font-family="Arial, Helvetica, sans-serif"
      font-size="72" font-weight="900" fill="#1a1a1a" text-anchor="middle">
      ${esc(discount)}
    </text>
    <text x="${W / 2}" y="738" font-family="Arial, Helvetica, sans-serif"
      font-size="26" font-weight="700" fill="#1a1a1a" text-anchor="middle" letter-spacing="3">
      OFF
    </text>
  ` : "";

  const discountOffset = discount ? 160 : 0;

  return Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(0,0,0,0.65)" />
          <stop offset="35%"  stop-color="rgba(0,0,0,0.35)" />
          <stop offset="65%"  stop-color="rgba(0,0,0,0.35)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.80)" />
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#grad)" />

      <!-- Salon name -->
      <text x="${W / 2}" y="140" font-family="Arial, Helvetica, sans-serif"
        font-size="32" font-weight="700" fill="rgba(255,255,255,0.70)"
        text-anchor="middle" letter-spacing="5">
        ${esc(salonName.toUpperCase())}
      </text>

      <!-- "EXCLUSIVE OFFER" eyebrow -->
      <text x="${W / 2}" y="220" font-family="Arial, Helvetica, sans-serif"
        font-size="26" font-weight="600" fill="${gold}"
        text-anchor="middle" letter-spacing="6">
        EXCLUSIVE OFFER
      </text>

      <!-- Gold divider -->
      <line x1="200" y1="250" x2="${W - 200}" y2="250" stroke="${gold}" stroke-width="2"/>

      <!-- Product / service -->
      <text x="${W / 2}" y="380" font-family="Arial, Helvetica, sans-serif"
        font-size="66" font-weight="900" fill="white" text-anchor="middle">
        ${esc(product)}
      </text>

      <!-- Discount badge -->
      ${discountBlock}

      <!-- Special text -->
      ${specialText ? `
        <text x="${W / 2}" y="${630 + discountOffset}" font-family="Arial, Helvetica, sans-serif"
          font-size="38" font-weight="700" fill="white" text-anchor="middle">
          ${esc(specialText)}
        </text>
      ` : ""}

      <!-- Expiration -->
      ${expiresLabel ? `
        <rect x="120" y="${H - 320}" width="${W - 240}" height="64" rx="14"
          fill="rgba(245,200,66,0.18)" />
        <text x="${W / 2}" y="${H - 279}" font-family="Arial, Helvetica, sans-serif"
          font-size="28" font-weight="600" fill="${gold}" text-anchor="middle">
          Offer expires ${esc(expiresLabel)}
        </text>
      ` : ""}

      <!-- CTA -->
      <rect x="120" y="${H - 230}" width="${W - 240}" height="80" rx="40"
        fill="${gold}" />
      <text x="${W / 2}" y="${H - 179}" font-family="Arial, Helvetica, sans-serif"
        font-size="32" font-weight="800" fill="#1a1a1a" text-anchor="middle" letter-spacing="2">
        BOOK NOW · LINK IN BIO
      </text>
    </svg>
  `);
}

/**
 * @param {object} opts
 * @param {string}  opts.salonId
 * @param {string}  opts.salonName
 * @param {string}  opts.product       - Product or service name
 * @param {string}  [opts.discount]    - e.g. "20%" or "$15"
 * @param {string}  [opts.specialText] - e.g. "Limited time only!"
 * @param {string}  [opts.expiresAt]   - ISO date string
 * @returns {Promise<string>}  Public URL of the saved promo image
 */
export async function buildPromotionImage({ salonId, salonName, product, discount, specialText, expiresAt }) {
  console.log("[Promotion] Building story image…");

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Background
  const bgUrl = await pickBackground(salonId);
  let bgLayer;
  if (bgUrl) {
    try {
      const buf = await fetchBuffer(bgUrl);
      bgLayer = await sharp(buf).resize(W, H, { fit: "cover", position: "center" }).toBuffer();
    } catch (err) {
      console.warn("[Promotion] Background fetch failed:", err.message);
    }
  }
  if (!bgLayer) {
    bgLayer = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 15, g: 10, b: 25 } },
    }).jpeg().toBuffer();
  }

  const overlay = buildOverlaySvg({ salonName, product, discount, specialText, expiresLabel });

  const finalBuf = await sharp(bgLayer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  const fileName = `promo-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(PUBLIC_DIR, fileName), finalBuf);

  const base = (process.env.PUBLIC_BASE_URL || "https://localhost:3000").replace(/\/$/, "");
  const publicUrl = `${base}/uploads/${fileName}`;
  console.log("[Promotion] Image saved:", publicUrl);
  return publicUrl;
}
