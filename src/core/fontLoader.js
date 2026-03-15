// src/core/fontLoader.js
// Fetches Google Font TTF files and returns base64 data URIs for SVG @font-face embedding.
// Cached in memory after first fetch. Falls back to null on error (SVG uses system font).

import fetch from "node-fetch";

const FONTS = {
  "Great Vibes": "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.ttf",
  "Montserrat":  "https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw0aXp-p7K4KLjztg.ttf",
  "Pacifico":    "https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf",
  "Lato":        "https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXg.ttf",
};

const cache = new Map();

export async function getFontBase64(fontName) {
  if (cache.has(fontName)) return cache.get(fontName);
  try {
    const url = FONTS[fontName];
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const b64 = `data:font/truetype;base64,${buf.toString("base64")}`;
    cache.set(fontName, b64);
    return b64;
  } catch (err) {
    console.warn(`[fontLoader] Failed to load ${fontName}:`, err.message);
    cache.set(fontName, null);
    return null;
  }
}
