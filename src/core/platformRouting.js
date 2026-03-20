// src/core/platformRouting.js
// Per-salon platform content routing helper.
//
// Provides:
//   DEFAULT_ROUTING       — all post types × all platforms enabled (source of truth)
//   mergeRoutingDefaults  — merge salon's partial overrides with defaults
//   isEnabledFor          — single query point used by scheduler

// All content types that can be routed (matches scheduler.js DEFAULT_PRIORITY)
const POST_TYPES = [
  "availability",
  "before_after",
  "celebration",
  "celebration_story",
  "standard_post",
  "reel",
  "promotions",
  "product_education",
];

// All publish targets
const PLATFORMS = ["facebook", "instagram", "gmb", "tiktok"];

/**
 * Default routing: every post_type publishes to every platform.
 * Salons override individual cells by storing a partial JSON object in
 * salons.platform_routing.
 */
export const DEFAULT_ROUTING = Object.fromEntries(
  POST_TYPES.map(pt => [
    pt,
    Object.fromEntries(PLATFORMS.map(p => [p, true]))
  ])
);

/**
 * Merge a salon's stored platform_routing JSON with the defaults.
 * - If salonRouting is null/undefined, returns DEFAULT_ROUTING.
 * - If salonRouting has partial overrides, merges per post_type.
 * - Unknown post_types in salonRouting are ignored.
 * @param {string|null} salonRoutingJson — raw JSON from salons.platform_routing
 * @returns {Object} merged routing map
 */
export function mergeRoutingDefaults(salonRoutingJson) {
  if (!salonRoutingJson) return DEFAULT_ROUTING;

  let override;
  try {
    override = JSON.parse(salonRoutingJson);
  } catch {
    return DEFAULT_ROUTING;
  }

  if (typeof override !== 'object' || Array.isArray(override)) return DEFAULT_ROUTING;

  const merged = {};
  for (const pt of POST_TYPES) {
    merged[pt] = { ...DEFAULT_ROUTING[pt] };
    if (override[pt] && typeof override[pt] === 'object') {
      for (const plat of PLATFORMS) {
        if (typeof override[pt][plat] === 'boolean') {
          merged[pt][plat] = override[pt][plat];
        }
      }
    }
  }
  return merged;
}

/**
 * Check if a given post_type should publish to a given platform for this salon.
 * Called by scheduler.js before each publish call.
 *
 * @param {Object} salon — salon row from getSalonPolicy() (must include platform_routing)
 * @param {string} postType — e.g. "standard_post", "reel", "availability"
 * @param {string} platform — "facebook" | "instagram" | "gmb" | "tiktok"
 * @returns {boolean} true if enabled (defaults to true for unknown types or missing config)
 */
export function isEnabledFor(salon, postType, platform) {
  const routing = mergeRoutingDefaults(salon?.platform_routing ?? null);
  const ptConfig = routing[postType];
  if (!ptConfig) return true; // unknown post type — allow by default
  const val = ptConfig[platform];
  return val !== false; // treat undefined as true
}
