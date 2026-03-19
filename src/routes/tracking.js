// src/routes/tracking.js
// Public redirect endpoints — no auth required
// GET /t/:slug/book  → permanent bio link (logs new click row each time)
// GET /t/:token      → one-time tracking token redirect

import crypto from 'crypto';
import express from 'express';
import { db } from '../../db.js';
import { appendUtm } from '../core/utm.js';

const router = express.Router();

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex');
}

// -------------------------------------------------------
// GET /t/:slug/book  — permanent bio link
// MUST be defined BEFORE /:token to avoid Express routing conflict
// -------------------------------------------------------
router.get('/:slug/book', (req, res) => {
  const { slug } = req.params;

  let salon;
  try {
    salon = db.prepare(`SELECT slug, booking_url FROM salons WHERE slug = ?`).get(slug);
  } catch (err) {
    console.error('[tracking] bio link DB error:', err.message);
    return res.status(500).send('Server error');
  }

  if (!salon || !salon.booking_url) {
    return res.status(404).send('Link not found');
  }

  const destination = appendUtm(salon.booking_url, {
    source: 'mostlypostly',
    medium: 'social',
    campaign: slug,
    content: 'bio_link',
  });

  // Log a new row on every click — bio link is permanent, not deduped
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO utm_clicks (id, token, salon_id, post_id, click_type, utm_content, clicked_at, ip_hash, destination, created_at)
      VALUES (@id, @token, @salon_id, NULL, 'bio', 'bio_link', @clicked_at, @ip_hash, @destination, @created_at)
    `).run({
      id: crypto.randomUUID(),
      token: crypto.randomBytes(6).toString('base64url').slice(0, 8),
      salon_id: slug,
      clicked_at: now,
      ip_hash: hashIp(req.ip),
      destination,
      created_at: now,
    });
  } catch (err) {
    // Log but don't block the redirect
    console.error('[tracking] bio link insert error:', err.message);
  }

  return res.redirect(302, destination);
});

// -------------------------------------------------------
// GET /t/:token  — one-time tracking token redirect
// -------------------------------------------------------
router.get('/:token', (req, res) => {
  const { token } = req.params;

  let row;
  try {
    row = db.prepare(`SELECT * FROM utm_clicks WHERE token = ?`).get(token);
  } catch (err) {
    console.error('[tracking] token lookup DB error:', err.message);
    return res.status(500).send('Server error');
  }

  if (!row) {
    return res.status(404).send('Link not found');
  }

  // Only record first click — don't overwrite if already clicked
  if (!row.clicked_at) {
    try {
      db.prepare(`
        UPDATE utm_clicks SET clicked_at = ?, ip_hash = ? WHERE token = ?
      `).run(new Date().toISOString(), hashIp(req.ip), token);
    } catch (err) {
      console.error('[tracking] token update error:', err.message);
    }
  }

  return res.redirect(302, row.destination);
});

export default router;
