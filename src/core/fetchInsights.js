// src/core/fetchInsights.js — Fetch FB + IG post-level insights and cache in DB
import { db } from "../../db.js";
import crypto from "crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

// ─── Facebook ────────────────────────────────────────────────────────────────

async function fetchFBInsights(fbPostId, pageToken) {
  const metrics = [
    "post_impressions",
    "post_impressions_unique",
    "post_engaged_users",
    "post_clicks_by_type",
    "post_reactions_by_type_total",
  ].join(",");

  const url = `${GRAPH}/${fbPostId}/insights?metric=${metrics}&access_token=${pageToken}`;
  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(`FB insights error for ${fbPostId}: ${json?.error?.message || res.status}`);
  }

  const byName = {};
  for (const item of json.data || []) {
    byName[item.name] = item.values?.[0]?.value ?? 0;
  }

  const clicksByType = byName["post_clicks_by_type"] || {};
  const reactionsByType = byName["post_reactions_by_type_total"] || {};
  const totalReactions = typeof reactionsByType === "object"
    ? Object.values(reactionsByType).reduce((s, v) => s + (v || 0), 0)
    : (reactionsByType || 0);

  const impressions = byName["post_impressions"] || 0;
  const reach       = byName["post_impressions_unique"] || 0;
  const engaged     = byName["post_engaged_users"] || 0;
  const linkClicks  = clicksByType["link clicks"] || 0;
  const otherClicks = Object.entries(clicksByType)
    .filter(([k]) => k !== "link clicks")
    .reduce((s, [, v]) => s + (v || 0), 0);

  return {
    platform:      "facebook",
    impressions,
    reach,
    engaged_users: engaged,
    reactions:     totalReactions,
    link_clicks:   linkClicks,
    other_clicks:  otherClicks,
    engagement_rate: reach > 0 ? parseFloat(((engaged / reach) * 100).toFixed(2)) : 0,
  };
}

// ─── Instagram ───────────────────────────────────────────────────────────────

async function fetchIGInsights(igMediaId, pageToken) {
  // Insights endpoint for reach, impressions, saves
  const insightMetrics = ["impressions", "reach", "saved"].join(",");
  const insightUrl = `${GRAPH}/${igMediaId}/insights?metric=${insightMetrics}&access_token=${pageToken}`;

  // Fields endpoint for likes and comments
  const fieldsUrl = `${GRAPH}/${igMediaId}?fields=like_count,comments_count,media_type&access_token=${pageToken}`;

  const [insightRes, fieldsRes] = await Promise.all([
    fetch(insightUrl),
    fetch(fieldsUrl),
  ]);

  const insightJson = await insightRes.json();
  const fieldsJson  = await fieldsRes.json();

  // Insight fetch may fail for stories or old media — degrade gracefully
  const byName = {};
  if (insightRes.ok && !insightJson.error) {
    for (const item of insightJson.data || []) {
      byName[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
    }
  }

  const impressions = byName["impressions"] || 0;
  const reach       = byName["reach"] || 0;
  const saves       = byName["saved"] || 0;
  const likes       = fieldsJson?.like_count || 0;
  const comments    = fieldsJson?.comments_count || 0;
  const engaged     = likes + comments + saves;

  return {
    platform:      "instagram",
    impressions,
    reach,
    likes,
    comments,
    saves,
    engaged_users: engaged,
    engagement_rate: reach > 0 ? parseFloat(((engaged / reach) * 100).toFixed(2)) : 0,
  };
}

// ─── Upsert to DB ────────────────────────────────────────────────────────────

function upsertInsights(postId, salonId, metrics) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO post_insights
      (id, post_id, salon_id, platform, fetched_at,
       impressions, reach, likes, comments, shares, saves,
       reactions, engaged_users, link_clicks, other_clicks,
       video_views, engagement_rate)
    VALUES
      (@id, @post_id, @salon_id, @platform, datetime('now','utc'),
       @impressions, @reach, @likes, @comments, @shares, @saves,
       @reactions, @engaged_users, @link_clicks, @other_clicks,
       @video_views, @engagement_rate)
    ON CONFLICT(post_id, platform) DO UPDATE SET
      fetched_at      = excluded.fetched_at,
      impressions     = excluded.impressions,
      reach           = excluded.reach,
      likes           = excluded.likes,
      comments        = excluded.comments,
      shares          = excluded.shares,
      saves           = excluded.saves,
      reactions       = excluded.reactions,
      engaged_users   = excluded.engaged_users,
      link_clicks     = excluded.link_clicks,
      other_clicks    = excluded.other_clicks,
      video_views     = excluded.video_views,
      engagement_rate = excluded.engagement_rate
  `).run({
    id,
    post_id:        postId,
    salon_id:       salonId,
    platform:       metrics.platform,
    impressions:    metrics.impressions    || 0,
    reach:          metrics.reach          || 0,
    likes:          metrics.likes          || 0,
    comments:       metrics.comments       || 0,
    shares:         metrics.shares         || 0,
    saves:          metrics.saves          || 0,
    reactions:      metrics.reactions      || 0,
    engaged_users:  metrics.engaged_users  || 0,
    link_clicks:    metrics.link_clicks    || 0,
    other_clicks:   metrics.other_clicks   || 0,
    video_views:    metrics.video_views    || 0,
    engagement_rate: metrics.engagement_rate || 0,
  });
}

// ─── Main sync ───────────────────────────────────────────────────────────────

export async function syncSalonInsights(salon) {
  const pageToken = salon.facebook_page_token || process.env.FACEBOOK_PAGE_TOKEN;
  if (!pageToken) return { synced: 0, errors: ["No Facebook page token configured"] };

  const publishedPosts = db.prepare(`
    SELECT id, fb_post_id, ig_media_id, salon_id
    FROM posts
    WHERE salon_id = ? AND status = 'published'
      AND (fb_post_id IS NOT NULL OR ig_media_id IS NOT NULL)
    ORDER BY published_at DESC
    LIMIT 100
  `).all(salon.slug || salon.salon_id || salon.id);

  let synced = 0;
  const errors = [];

  for (const post of publishedPosts) {
    // Facebook
    if (post.fb_post_id) {
      try {
        const metrics = await fetchFBInsights(post.fb_post_id, pageToken);
        upsertInsights(post.id, post.salon_id, metrics);
        synced++;
      } catch (err) {
        errors.push(`FB ${post.fb_post_id}: ${err.message}`);
      }
    }

    // Instagram
    if (post.ig_media_id) {
      try {
        const metrics = await fetchIGInsights(post.ig_media_id, pageToken);
        upsertInsights(post.id, post.salon_id, metrics);
        synced++;
      } catch (err) {
        errors.push(`IG ${post.ig_media_id}: ${err.message}`);
      }
    }
  }

  return { synced, errors };
}
