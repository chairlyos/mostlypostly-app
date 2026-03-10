// src/core/pexels.js
// Fetch a real photo from Pexels API as fallback background.
// Requires PEXELS_API_KEY env var. Returns a direct image URL or null.

import fetch from "node-fetch";

const PEXELS_BASE = "https://api.pexels.com/v1/search";

// Per-context search terms — portrait orientation preferred
const SEARCH_QUERIES = {
  availability: ["hair salon interior", "hairstylist salon", "beauty salon", "salon chair"],
  promotion:    ["hair color salon", "luxury hair salon", "hair styling", "beauty salon bokeh"],
  default:      ["hair salon", "beauty salon", "hairstylist"],
};

/**
 * Fetch a random real photo from Pexels for the given context.
 * @param {"availability"|"promotion"|"default"} context
 * @returns {Promise<string|null>} Direct image URL (portrait, large) or null
 */
export async function fetchPexelsBackground(context = "default") {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[Pexels] No PEXELS_API_KEY set — skipping");
    return null;
  }

  const queries = SEARCH_QUERIES[context] || SEARCH_QUERIES.default;
  // Pick a random search term so we get variety
  const query = queries[Math.floor(Math.random() * queries.length)];

  try {
    const params = new URLSearchParams({
      query,
      orientation: "portrait",
      size: "large",
      per_page: "15",
    });

    const resp = await fetch(`${PEXELS_BASE}?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!resp.ok) {
      console.warn(`[Pexels] API error ${resp.status} for query "${query}"`);
      return null;
    }

    const data = await resp.json();
    const photos = data?.photos || [];
    if (!photos.length) return null;

    // Pick a random result from the page for variety
    const photo = photos[Math.floor(Math.random() * photos.length)];
    const url = photo?.src?.large2x || photo?.src?.large || photo?.src?.original;
    if (url) {
      console.log(`[Pexels] Using photo id=${photo.id} for "${query}"`);
      return url;
    }
  } catch (err) {
    console.warn("[Pexels] Fetch failed:", err.message);
  }

  return null;
}
