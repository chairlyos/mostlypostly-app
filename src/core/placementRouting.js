// src/core/placementRouting.js
// Configurable content_type → placement routing.
//
// Resolution order for any post:
//   1. post.placement_overridden = 1 → use stored post.placement (manager set it)
//   2. salons.placement_routing[contentType] → salon-level override
//   3. system_settings key='placement_routing' → console-level defaults
//   4. DEFAULT_PLACEMENT from contentType.js → hardcoded fallback

import { DEFAULT_PLACEMENT } from "./contentType.js";
import db from "../../db.js";

const VALID_PLACEMENTS = new Set(["reel", "story", "post"]);

/**
 * Read the system-level placement routing from system_settings.
 * Falls back to DEFAULT_PLACEMENT if the table doesn't exist or the row is missing.
 *
 * @param {import('better-sqlite3').Database} [dbOverride] — optional DB for testing
 * @returns {Object} complete content_type → placement map
 */
export function getSystemPlacementRouting(dbOverride) {
  const database = dbOverride || db;
  try {
    const row = database.prepare(
      `SELECT value FROM system_settings WHERE key = 'placement_routing'`
    ).get();
    if (!row) return { ...DEFAULT_PLACEMENT };
    const parsed = JSON.parse(row.value);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULT_PLACEMENT };
    // Merge with defaults so any missing keys are covered
    return { ...DEFAULT_PLACEMENT, ...Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => VALID_PLACEMENTS.has(v))
    )};
  } catch {
    return { ...DEFAULT_PLACEMENT };
  }
}

/**
 * Overlay a salon's partial placement_routing JSON on top of the system defaults.
 *
 * @param {Object} systemDefaults — result of getSystemPlacementRouting()
 * @param {string|null} salonJson — raw JSON from salons.placement_routing
 * @returns {Object} complete content_type → placement map
 */
export function mergePlacementRouting(systemDefaults, salonJson) {
  if (!salonJson) return systemDefaults;

  let override;
  try {
    override = JSON.parse(salonJson);
  } catch {
    return systemDefaults;
  }

  if (typeof override !== "object" || Array.isArray(override)) return systemDefaults;

  const merged = { ...systemDefaults };
  for (const [contentType, placement] of Object.entries(override)) {
    // Only override known content types with valid placement values
    if (contentType in systemDefaults && VALID_PLACEMENTS.has(placement)) {
      merged[contentType] = placement;
    }
  }
  return merged;
}

/**
 * Single call point for the scheduler and manager approval UI.
 * Returns the resolved placement for a given content type given the salon's config.
 *
 * Does NOT check post.placement_overridden — that is the caller's responsibility.
 *
 * @param {import('better-sqlite3').Database|null} dbOverride — optional DB for testing
 * @param {Object} salon — must include salon.placement_routing (from getSalonPolicy)
 * @param {string} contentType — e.g. "before_after", "standard_post"
 * @returns {"reel"|"story"|"post"}
 */
export function resolveContentPlacement(dbOverride, salon, contentType) {
  const systemDefaults = getSystemPlacementRouting(dbOverride);
  const merged = mergePlacementRouting(systemDefaults, salon?.placement_routing ?? null);
  return merged[contentType] || "post";
}
