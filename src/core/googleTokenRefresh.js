// src/core/googleTokenRefresh.js
import db from "../../db.js";

/**
 * Returns a valid Google access token for the salon.
 * Silently refreshes using the stored refresh token if expired or within 5 min.
 * Updates salons row in place.
 */
export async function refreshGmbToken(salon) {
  const expiry = salon.google_token_expiry ? new Date(salon.google_token_expiry) : null;
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // Token is still valid — return it directly
  if (expiry && expiry > fiveMinFromNow && salon.google_access_token) {
    return salon.google_access_token;
  }

  if (!salon.google_refresh_token) {
    throw new Error(`[GMB] No refresh token for salon ${salon.slug}`);
  }

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: salon.google_refresh_token,
    grant_type:    "refresh_token",
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`[GMB] Token refresh failed: ${JSON.stringify(data)}`);
  }

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  db.prepare(`
    UPDATE salons SET google_access_token = ?, google_token_expiry = ? WHERE slug = ?
  `).run(data.access_token, newExpiry, salon.slug);

  salon.google_access_token = data.access_token;
  salon.google_token_expiry = newExpiry;

  console.log(`[GMB] Token refreshed for salon ${salon.slug}, expires ${newExpiry}`);
  return data.access_token;
}
