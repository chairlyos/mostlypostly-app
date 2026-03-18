// src/publishers/googleBusiness.js
import { refreshGmbToken } from "../core/googleTokenRefresh.js";

const GMB_API_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * Truncate caption to 1500 chars, appending "..." if cut.
 */
function truncateCaption(caption) {
  const text = (caption || "").toString();
  if (text.length <= 1500) return text;
  return text.slice(0, 1497) + "...";
}

/**
 * Parse an ISO date string (YYYY-MM-DD) into { year, month, day } integers.
 */
function parseIsoDate(isoString) {
  const [year, month, day] = isoString.split("-").map(Number);
  return { year, month, day };
}

/**
 * Publish a "What's New" (STANDARD) post to Google Business Profile.
 *
 * @param {object} salon       - Salon row from DB (must have google_location_id, google_refresh_token, etc.)
 * @param {string} caption     - Post text (truncated to 1500 chars)
 * @param {string} imageUrl    - Publicly accessible image URL
 * @returns {{ id: string }}   - { id: localPost.name }
 */
export async function publishWhatsNewToGmb(salon, caption, imageUrl) {
  try {
    const accessToken = await refreshGmbToken(salon);

    const locationName = salon.google_location_id;
    if (!locationName) {
      throw new Error(`[GMB] No google_location_id for salon ${salon.slug}`);
    }

    const body = {
      topicType: "STANDARD",
      summary: truncateCaption(caption),
      media: [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }],
    };

    console.log(`[GMB] Publishing STANDARD post for salon ${salon.slug} to ${locationName}`);

    const resp = await fetch(`${GMB_API_BASE}/${locationName}/localPosts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(`[GMB] STANDARD post failed: ${JSON.stringify(data)}`);
    }

    console.log(`[GMB] STANDARD post published: ${data.name}`);
    return { id: data.name };
  } catch (err) {
    console.error(`[GMB] publishWhatsNewToGmb error for salon ${salon.slug}:`, err.message);
    throw err;
  }
}

/**
 * Publish an OFFER post to Google Business Profile.
 *
 * @param {object} salon                        - Salon row from DB
 * @param {string} caption                      - Post text (truncated to 1500 chars)
 * @param {string} imageUrl                     - Publicly accessible image URL
 * @param {{ title: string, startDate: string, endDate: string }} offerDetails
 *   startDate and endDate are ISO date strings (YYYY-MM-DD)
 * @returns {{ id: string }}                    - { id: localPost.name }
 */
export async function publishOfferToGmb(salon, caption, imageUrl, offerDetails) {
  try {
    const accessToken = await refreshGmbToken(salon);

    const locationName = salon.google_location_id;
    if (!locationName) {
      throw new Error(`[GMB] No google_location_id for salon ${salon.slug}`);
    }

    const { title, startDate, endDate } = offerDetails;

    const body = {
      topicType: "OFFER",
      summary: truncateCaption(caption),
      media: [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }],
      offer: {
        couponCode: "",
        redeemOnlineUrl: "",
        termsConditions: "",
        title,
        startDate: parseIsoDate(startDate),
        endDate: parseIsoDate(endDate),
      },
    };

    console.log(`[GMB] Publishing OFFER post for salon ${salon.slug} to ${locationName}`);

    const resp = await fetch(`${GMB_API_BASE}/${locationName}/localPosts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(`[GMB] OFFER post failed: ${JSON.stringify(data)}`);
    }

    console.log(`[GMB] OFFER post published: ${data.name}`);
    return { id: data.name };
  } catch (err) {
    console.error(`[GMB] publishOfferToGmb error for salon ${salon.slug}:`, err.message);
    throw err;
  }
}
