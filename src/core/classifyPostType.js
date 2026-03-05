// src/core/classifyPostType.js
// Keyword-based post type classifier.
// Returns one of: standard_post | before_after | products | promotions | availability

const RULES = [
  {
    type: "before_after",
    keywords: [
      "before", "after", "before and after", "before & after", "b&a", "b/a",
      "transformation", "transform", "makeover", "glow up",
    ],
  },
  {
    type: "availability",
    keywords: [
      "available", "availability", "opening", "openings", "open slot", "open slots",
      "appointment", "appointments", "book me", "book now", "slots", "schedule",
      "i have time", "i have openings", "taking clients", "accepting clients",
      "walk in", "walk-in", "walk ins",
    ],
  },
  {
    type: "promotions",
    keywords: [
      "promo", "promotion", "sale", "discount", "% off", "percent off",
      "limited time", "limited supply", "deal", "offer", "special offer",
      "buy one", "bogo", "flash sale", "today only", "this week only",
      "expires", "expiring",
    ],
  },
  {
    type: "products",
    keywords: [
      "product", "retail", "shampoo", "conditioner", "treatment", "serum",
      "oil", "mask", "styling", "hairspray", "mousse", "gel", "cream",
      "gloss", "toner", "kerasilk", "olaplex", "redken", "wella", "joico",
      "pureology", "bumble", "kevin murphy", "moroccanoil", "aveda",
      "kenra", "matrix", "paul mitchell", "schwarzkopf", "loreal",
    ],
  },
];

/**
 * Classify the post type from the stylist's message text.
 * Checks each rule in priority order — first match wins.
 * Falls back to "standard_post" if nothing matches.
 *
 * @param {string} text - Raw message text from stylist
 * @returns {string} post_type
 */
export function classifyPostType(text = "") {
  const lower = text.toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      console.log(`[Classify] Detected post type: ${rule.type} (matched in: "${text.slice(0, 60)}")`);
      return rule.type;
    }
  }

  return "standard_post";
}
