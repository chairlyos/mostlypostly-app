// src/core/contentRecycler.js
// Content Recycler — auto-recycle top-performing posts when the queue runs low.
//
// RECYC-01: Fires only when queue depth < 3 AND no publish in last 48 hours
// RECYC-02: Candidates from posts published in past 90 days, ranked by reach DESC
// RECYC-03: Recycled post is a new DB row with recycled_from_id FK pointing to original
// RECYC-04: Same post_type is not recycled twice in a row
// RECYC-05: before_after and availability only recycled on mid-week days (Tue-Thu)
// RECYC-06: Caption refresh only for Growth/Pro salons with toggle on
// RECYC-07: Manager receives SMS when auto-recycle fires

import crypto from "crypto";
import { DateTime } from "luxon";
import { db } from "../../db.js";
import { enqueuePost, getSalonPolicy } from "../scheduler.js";
import { sendViaTwilio } from "../routes/twilio.js";

const BASE_URL = process.env.BASE_URL || "https://app.mostlypostly.com";

// Plans eligible for AI caption refresh
const CAPTION_REFRESH_PLANS = new Set(["growth", "pro"]);

// Luxon weekdays: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=7
const MID_WEEK = new Set([2, 3, 4]); // Tue, Wed, Thu

/**
 * cloneAndEnqueue(postId, salonId)
 *
 * Shared helper used by both auto-recycle (checkAndAutoRecycle) and manual
 * recycle handlers. Clones a published post into a new row with
 * recycled_from_id pointing to the source, then enqueues it if auto_publish.
 *
 * Returns the new post id on success, or null on failure.
 */
export async function cloneAndEnqueue(postId, salonId) {
  try {
    // 1. Look up source post
    const source = db
      .prepare(`SELECT * FROM posts WHERE id = ? AND salon_id = ?`)
      .get(postId, salonId);

    if (!source) return null;

    // 2. Look up salon policy
    const salon = getSalonPolicy(salonId);
    if (!salon?.slug) return null;

    // 3. Caption refresh (Growth/Pro + toggle on)
    let finalCaption = source.final_caption;
    if (salon.caption_refresh_on_recycle && CAPTION_REFRESH_PLANS.has(salon.plan)) {
      try {
        const { generateCaption } = await import("../openai.js");
        const refreshed = await generateCaption({
          notes: `Rewrite this social media caption with fresh language, keeping the same tone and key message: ${source.final_caption}`,
          salon: { name: salon.name, tone: salon.tone },
          postType: source.post_type,
        });
        if (refreshed) finalCaption = refreshed;
      } catch (err) {
        // Fall back to original caption on any error
        console.warn(`[ContentRecycler] Caption refresh failed for ${postId}:`, err.message);
      }
    }

    // 4. New post id and salon_post_number
    const newId = crypto.randomUUID();
    const maxRow = db
      .prepare(`SELECT MAX(salon_post_number) AS n FROM posts WHERE salon_id = ?`)
      .get(salonId);
    const nextNum = (maxRow?.n ?? 0) + 1;

    // 5. Determine status
    const status = salon.auto_publish ? "manager_approved" : "manager_pending";

    // 6. Atomic insert + optional enqueue
    const newPost = {
      id: newId,
      salon_id: salonId,
      stylist_name: source.stylist_name,
      image_url: source.image_url,
      image_urls: source.image_urls,
      base_caption: source.base_caption,
      final_caption: finalCaption,
      post_type: source.post_type,
      status,
      recycled_from_id: source.id,
      salon_post_number: nextNum,
    };

    const insertAndEnqueue = db.transaction(() => {
      db.prepare(`
        INSERT INTO posts (
          id, salon_id, stylist_name, image_url, image_urls,
          base_caption, final_caption, post_type, status,
          recycled_from_id, salon_post_number,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          datetime('now'), datetime('now')
        )
      `).run(
        newPost.id, newPost.salon_id, newPost.stylist_name, newPost.image_url, newPost.image_urls,
        newPost.base_caption, newPost.final_caption, newPost.post_type, newPost.status,
        newPost.recycled_from_id, newPost.salon_post_number
      );

      if (status === "manager_approved") {
        enqueuePost(newPost);
      }
    });

    insertAndEnqueue();

    return newId;
  } catch (err) {
    console.error(`[ContentRecycler] cloneAndEnqueue failed for ${postId}:`, err.message);
    return null;
  }
}

/**
 * checkAndAutoRecycle(salonId)
 *
 * Main auto-recycle engine. Called from the scheduler loop for every salon
 * with auto_recycle = 1. Checks trigger conditions, selects the best
 * candidate, clones it, and notifies managers via SMS.
 *
 * Returns the new post id if recycled, or undefined if nothing was done.
 */
export async function checkAndAutoRecycle(salonId) {
  // 1. Get salon policy — bail if auto_recycle not enabled
  const salon = getSalonPolicy(salonId);
  if (!salon?.auto_recycle) return;

  // 2. RECYC-01a: Queue depth check
  const queueRow = db
    .prepare(`
      SELECT COUNT(*) AS n FROM posts
      WHERE salon_id = ?
        AND status = 'manager_approved'
        AND scheduled_for IS NOT NULL
    `)
    .get(salonId);

  if ((queueRow?.n ?? 0) >= 3) return;

  // 3. RECYC-01b: Last publish recency check (must be > 48 hours ago)
  const lastPubRow = db
    .prepare(`
      SELECT published_at FROM posts
      WHERE salon_id = ? AND status = 'published'
      ORDER BY published_at DESC
      LIMIT 1
    `)
    .get(salonId);

  if (lastPubRow?.published_at) {
    const lastPub = DateTime.fromSQL(lastPubRow.published_at, { zone: "utc" });
    const hoursSince = DateTime.utc().diff(lastPub, "hours").hours;
    if (hoursSince < 48) return;
  }

  // 4. RECYC-04: Get last published post_type to avoid recycling same type
  const lastTypeRow = db
    .prepare(`
      SELECT post_type FROM posts
      WHERE salon_id = ? AND status = 'published'
      ORDER BY published_at DESC
      LIMIT 1
    `)
    .get(salonId);
  const lastPublishedType = lastTypeRow?.post_type ?? "";

  // 5. RECYC-05: Mid-week check — exclude before_after and availability on non-mid-week days
  const localWeekday = DateTime.utc()
    .setZone(salon.timezone || "America/Indiana/Indianapolis")
    .weekday;
  const excludeTypes = MID_WEEK.has(localWeekday)
    ? []
    : ["before_after", "availability"];

  // 6. Build candidate query dynamically
  let candidateSQL = `
    SELECT p.id, p.post_type, p.final_caption, p.base_caption, p.image_url, p.image_urls,
           p.stylist_name, COALESCE(MAX(pi.reach), 0) AS best_reach
    FROM posts p
    LEFT JOIN post_insights pi ON pi.post_id = p.id
    WHERE p.salon_id = ?
      AND p.status = 'published'
      AND p.block_from_recycle = 0
      AND p.recycled_from_id IS NULL
      AND datetime(p.published_at) >= datetime('now', '-90 days')
      AND NOT EXISTS (
        SELECT 1 FROM posts r
        WHERE r.recycled_from_id = p.id
          AND r.salon_id = p.salon_id
          AND datetime(r.created_at) >= datetime('now', '-45 days')
      )
      AND p.post_type != ?
  `;

  const bindParams = [salonId, lastPublishedType];

  if (excludeTypes.length > 0) {
    const placeholders = excludeTypes.map(() => "?").join(", ");
    candidateSQL += ` AND p.post_type NOT IN (${placeholders})`;
    bindParams.push(...excludeTypes);
  }

  candidateSQL += `
    GROUP BY p.id
    ORDER BY best_reach DESC, datetime(p.published_at) DESC
    LIMIT 1
  `;

  const candidate = db.prepare(candidateSQL).get(...bindParams);
  if (!candidate) return;

  // 7. Clone and enqueue the candidate
  const newPostId = await cloneAndEnqueue(candidate.id, salonId);
  if (!newPostId) return;

  // 8. RECYC-07: SMS notification to all managers (fire-and-forget)
  try {
    const managers = db
      .prepare(`SELECT phone FROM managers WHERE salon_id = ?`)
      .all(salonId);

    const message =
      `Your post queue was running low, so we recycled a top-performing post to keep your schedule full. ` +
      `Visit ${BASE_URL}/dashboard?salon=${salonId}&status=published to review.`;

    for (const { phone } of managers) {
      sendViaTwilio(phone, message).catch((err) =>
        console.warn(`[ContentRecycler] SMS failed for ${phone}:`, err.message)
      );
    }
  } catch (err) {
    console.warn("[ContentRecycler] Manager SMS notification failed:", err.message);
  }

  return newPostId;
}
