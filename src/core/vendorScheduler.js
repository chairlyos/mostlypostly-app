// src/core/vendorScheduler.js
// FEAT-014 — Vendor Post Scheduling Engine
//
// Runs daily. For each Pro salon with enabled + approved vendor feeds:
//   1. Finds active, non-expired campaigns under that vendor
//   2. Pre-schedules posts across a 30-day window (vendor_scheduled status)
//   3. Divides the window into cap equal intervals; fills only empty intervals
//   4. Generates an AI caption adapted to the salon's tone
//   5. Logs to vendor_post_log for cap tracking

import crypto from "crypto";
import { DateTime } from "luxon";
import { db } from "../../db.js";
import { appendUtm, slugify } from './utm.js';
import { buildTrackingToken, buildShortUrl } from './trackingUrl.js';

// Ensure a URL stored as a relative path (/uploads/...) becomes absolute.
function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith("/")) {
    const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    return base ? `${base}${url}` : url;
  }
  return url;
}

const tag = "[VendorScheduler]";
const log = {
  info:  (...a) => console.log(tag, ...a),
  warn:  (...a) => console.warn(tag, ...a),
};

// ─── Exported helpers (testable pure functions) ──────────────────────────────

export function normalizeHashtag(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  if (!t) return "";
  const withHash = t.startsWith("#") ? t : `#${t}`;
  if (withHash.includes(" ")) return ""; // malformed — skip silently
  return withHash;
}

/**
 * Build the locked hashtag block for vendor posts.
 * Order: first 3 salon defaults + up to 2 brand hashtags + up to 1 product hashtag + #MostlyPostly
 * Deduplicates case-insensitively. Appended AFTER AI caption — never passed to AI.
 */
export function buildVendorHashtagBlock({ salonHashtags, brandHashtags, productHashtag }) {
  const BRAND_TAG = "#MostlyPostly";
  const seen = new Set();
  const out = [];

  const add = (tag) => {
    const t = normalizeHashtag(tag);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  (salonHashtags || []).slice(0, 3).forEach(add);
  (brandHashtags || []).slice(0, 2).forEach(add);
  if (productHashtag) add(productHashtag);
  add(BRAND_TAG);

  return out.join(" ");
}

// =====================================================
// OpenAI caption generation for vendor posts
// =====================================================

export async function generateVendorCaption({ campaign, salon, brandCaption }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.warn("Missing OPENAI_API_KEY — skipping vendor caption generation");
    return null;
  }

  const salonName = salon.name || "the salon";
  const tone      = salon.tone || "friendly and professional";

  const systemPrompt = `You are a social media expert writing Instagram and Facebook posts for a hair salon.
Write a single post caption that:
- Sounds like it comes from ${salonName}, a hair salon
- Matches the salon's tone: "${tone}"
- Promotes the product/service naturally without sounding like an ad
- Is 2-4 sentences max
- Does NOT mention specific prices
- Ends with a subtle CTA if CTA instructions are provided
- Does NOT include any hashtags`;

  const userPrompt = `Write a social media caption for the following vendor product/campaign:

Brand: ${campaign.vendor_name}
Campaign: ${campaign.campaign_name}
Product: ${campaign.product_name || campaign.campaign_name}
Description: ${campaign.product_description || ""}
${campaign.cta_instructions ? `CTA instructions: ${campaign.cta_instructions}` : ""}
${campaign.service_pairing_notes ? `Service pairing notes: ${campaign.service_pairing_notes}` : ""}
${brandCaption ? `\nBrand-provided caption (use as messaging reference — key product claims, language, and tone — but rewrite entirely in the salon's voice):\n${brandCaption}` : ""}

Remember: this is for ${salonName} — write in their voice (${tone}), not the brand's voice.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.75,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      log.warn(`OpenAI error for campaign ${campaign.id}: ${err}`);
      return null;
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    log.warn(`OpenAI fetch failed for campaign ${campaign.id}: ${err.message}`);
    return null;
  }
}

// =====================================================
// Core scheduler function
// =====================================================

export async function runVendorScheduler() {
  const LOOKAHEAD_DAYS = 30;
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  log.info(`Running vendor scheduler. Window: ${windowStart.toISOString().slice(0,10)} → ${windowEnd.toISOString().slice(0,10)}`);

  const proSalons = db.prepare(`
    SELECT slug, name, tone, default_hashtags, require_manager_approval,
           posting_start_time, posting_end_time, timezone
    FROM salons
    WHERE plan IN ('pro')
      AND plan_status IN ('active', 'trialing')
  `).all();

  log.info(`Found ${proSalons.length} Pro salon(s)`);

  let totalCreated = 0;
  for (const salon of proSalons) {
    try {
      totalCreated += await processSalon(salon, windowStart, windowEnd);
    } catch (err) {
      log.warn(`Error processing salon ${salon.slug}: ${err.message}`);
    }
  }

  log.info(`Vendor scheduler complete. Created ${totalCreated} post(s).`);
  return totalCreated;
}

async function processSalon(salon, windowStart, windowEnd) {
  const salonId = salon.slug;
  let created = 0;

  // 2. Get enabled vendor feeds for this salon (Pro plan is the gate)
  //    JOIN vendor_brands to get platform-level frequency controls.
  const enabledVendors = db.prepare(`
    SELECT f.vendor_name, f.affiliate_url, f.category_filters,
           f.frequency_cap AS salon_cap,
           COALESCE(b.min_gap_days, 3) AS min_gap_days,
           COALESCE(b.platform_max_cap, 6) AS platform_max_cap
    FROM salon_vendor_feeds f
    LEFT JOIN vendor_brands b ON b.vendor_name = f.vendor_name
    WHERE f.salon_id = ?
      AND f.enabled = 1
  `).all(salonId);

  if (enabledVendors.length === 0) return 0;

  // 3. For each enabled vendor, get active non-expired campaigns (with optional category filter)
  for (const vendor of enabledVendors) {
    const vendorName      = vendor.vendor_name;
    const affiliateUrl    = vendor.affiliate_url || null;
    const categoryFilters = (() => {
      try { return JSON.parse(vendor.category_filters || "[]"); } catch { return []; }
    })();

    let campaignSql = `
      SELECT * FROM vendor_campaigns
      WHERE vendor_name = ?
        AND active = 1
        AND (expires_at IS NULL OR expires_at >= date('now'))
    `;
    const queryParams = [vendorName];
    if (categoryFilters.length > 0) {
      campaignSql += ` AND category IN (${categoryFilters.map(() => "?").join(",")})`;
      queryParams.push(...categoryFilters);
    }
    campaignSql += " ORDER BY created_at ASC";

    const campaigns = db.prepare(campaignSql).all(...queryParams);

    for (const campaign of campaigns) {
      try {
        const count = await processCampaign(campaign, salon, windowStart, windowEnd, affiliateUrl, vendorName, vendor.min_gap_days);
        created += count;
      } catch (err) {
        log.warn(`Error processing campaign ${campaign.id} for salon ${salonId}: ${err.message}`);
      }
    }
  }

  return created;
}

async function processCampaign(campaign, salon, windowStart, windowEnd, affiliateUrl, vendorName, minGapDays) {
  const salonId = salon.slug;
  const tz = salon.timezone || "America/Indiana/Indianapolis";
  const cap = campaign.frequency_cap ?? 3;
  const lookaheadDays = 30;

  // 4. Require a photo
  if (!campaign.photo_url) {
    log.warn(`  Skipping campaign ${campaign.id} ("${campaign.campaign_name}") — no photo_url set`);
    return false;
  }

  // 5. Count existing vendor posts from this campaign in the 30-day window
  const windowStartSql = windowStart.toISOString().replace("T", " ").slice(0, 19);
  const windowEndSql   = windowEnd.toISOString().replace("T", " ").slice(0, 19);

  const { existingCount } = db.prepare(`
    SELECT COUNT(*) AS existingCount
    FROM posts
    WHERE salon_id = ?
      AND vendor_campaign_id = ?
      AND status IN ('vendor_scheduled','manager_pending','manager_approved','published')
      AND scheduled_for BETWEEN ? AND ?
  `).get(salonId, campaign.id, windowStartSql, windowEndSql);

  if (existingCount >= cap) {
    log.info(`  Salon ${salonId} / campaign ${campaign.id}: window full (${existingCount}/${cap}) — skipping`);
    return false;
  }

  // 6. Divide 30-day window into cap equal intervals; fill ALL empty intervals this run
  const intervalMs = (lookaheadDays * 24 * 60 * 60 * 1000) / cap;
  let created = 0;

  for (let i = 0; i < cap; i++) {
    const intStart = new Date(windowStart.getTime() + i * intervalMs);
    const intEnd   = new Date(windowStart.getTime() + (i + 1) * intervalMs);
    const intStartSql = intStart.toISOString().replace("T", " ").slice(0, 19);
    const intEndSql   = intEnd.toISOString().replace("T", " ").slice(0, 19);

    const { slotTaken } = db.prepare(`
      SELECT COUNT(*) AS slotTaken
      FROM posts
      WHERE salon_id = ?
        AND vendor_campaign_id = ?
        AND status IN ('vendor_scheduled','manager_pending','manager_approved','published')
        AND scheduled_for BETWEEN ? AND ?
    `).get(salonId, campaign.id, intStartSql, intEndSql);

    if (slotTaken > 0) continue; // manager moved a post here — respect it

    // Pick a random day within this interval, at a random time within posting hours
    const intervalDays = Math.max(1, Math.floor(intervalMs / (24 * 60 * 60 * 1000)));
    const randDayOffset = Math.floor(Math.random() * intervalDays);
    const candidateDay = new Date(intStart.getTime() + randDayOffset * 24 * 60 * 60 * 1000);

    const [startH, startM] = (salon.posting_start_time || "09:00").split(":").map(Number);
    const [endH,   endM]   = (salon.posting_end_time   || "20:00").split(":").map(Number);
    const windowMinutes = Math.max(1, (endH * 60 + endM) - (startH * 60 + startM));
    const randMinutes = Math.floor(Math.random() * windowMinutes);
    const postHour   = startH + Math.floor((startM + randMinutes) / 60);
    const postMinute = (startM + randMinutes) % 60;

    const localDt = DateTime.fromObject(
      { year: candidateDay.getUTCFullYear(), month: candidateDay.getUTCMonth() + 1, day: candidateDay.getUTCDate(),
        hour: postHour, minute: postMinute, second: 0 },
      { zone: tz }
    );
    const scheduledFor = localDt.toUTC().toFormat("yyyy-LL-dd HH:mm:ss");

    // 7. Generate AI caption for this slot
    let caption;
    if (campaign.source === "pdf_sync" && campaign.caption_body) {
      log.info(`  Generating AI caption with PDF brand brief for salon ${salonId} / campaign "${campaign.campaign_name}" (interval ${i})`);
      caption = await generateVendorCaption({ campaign, salon, brandCaption: campaign.caption_body });
    } else {
      log.info(`  Generating AI caption for salon ${salonId} / campaign "${campaign.campaign_name}" (interval ${i})`);
      caption = await generateVendorCaption({ campaign, salon });
    }
    if (!caption) {
      log.warn(`  Skipping interval ${i} for campaign ${campaign.id} — no caption available`);
      continue; // skip this slot, try next interval
    }

    // 8. Build locked hashtag block
    const brandCfg = db.prepare(`SELECT brand_hashtags FROM vendor_brands WHERE vendor_name = ?`).get(campaign.vendor_name);
    const brandHashtags = (() => { try { return JSON.parse(brandCfg?.brand_hashtags || "[]"); } catch { return []; } })();
    const salonDefaultTags = (() => { try { return JSON.parse(salon.default_hashtags || "[]"); } catch { return []; } })();
    const lockedBlock = buildVendorHashtagBlock({ salonHashtags: salonDefaultTags, brandHashtags, productHashtag: campaign.product_hashtag || null });

    // 9. salon_post_number
    const { maxnum } = db.prepare(`SELECT MAX(salon_post_number) AS maxnum FROM posts WHERE salon_id = ?`).get(salonId) || {};
    const salon_post_number = (maxnum || 0) + 1;

    // 10. Build post
    const postId = crypto.randomUUID();
    const now    = new Date().toISOString();

    let trackedCaption;
    if (affiliateUrl) {
      const utmContent  = `vendor_${slugify(campaign.vendor_name)}`;
      const destination = appendUtm(affiliateUrl, { source: "mostlypostly", medium: "social", campaign: salonId, content: utmContent });
      try {
        const token    = buildTrackingToken({ salonId, postId, clickType: "vendor", vendorName: campaign.vendor_name, utmContent, destination });
        const shortUrl = buildShortUrl(token);
        trackedCaption = caption + "\n\nShop today: " + shortUrl + (lockedBlock ? "\n\n" + lockedBlock : "");
      } catch (err) {
        log.warn(`  UTM token creation failed: ${err.message}`);
        trackedCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "");
      }
    } else {
      trackedCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "");
    }

    db.prepare(`
      INSERT INTO posts (id, salon_id, stylist_name, image_url, base_caption, final_caption,
                         post_type, status, vendor_campaign_id, scheduled_for, salon_post_number, created_at, updated_at)
      VALUES (@id, @salon_id, @stylist_name, @image_url, @base_caption, @final_caption,
              @post_type, @status, @vendor_campaign_id, @scheduled_for, @salon_post_number, @created_at, @updated_at)
    `).run({
      id: postId, salon_id: salonId,
      stylist_name: `${campaign.vendor_name} (Campaign)`,
      image_url: resolveUrl(campaign.photo_url),
      base_caption: caption, final_caption: trackedCaption,
      post_type: "standard_post",
      status: "vendor_scheduled",
      vendor_campaign_id: campaign.id,
      scheduled_for: scheduledFor,
      salon_post_number,
      created_at: now, updated_at: now,
    });

    // 11. Log to vendor_post_log
    const postedMonth = scheduledFor.slice(0, 7);
    db.prepare(`
      INSERT INTO vendor_post_log (id, salon_id, campaign_id, post_id, posted_month, created_at)
      VALUES (@id, @salon_id, @campaign_id, @post_id, @posted_month, @created_at)
    `).run({ id: crypto.randomUUID(), salon_id: salonId, campaign_id: campaign.id, post_id: postId, posted_month: postedMonth, created_at: now });

    log.info(`  ✅ Created vendor_scheduled post ${postId} for salon ${salonId} → ${scheduledFor} (interval ${i})`);
    created++;
  }

  if (created === 0) {
    log.info(`  Salon ${salonId} / campaign ${campaign.id}: all ${cap} slots filled — skipping`);
  }

  return created;
}
