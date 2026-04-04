// src/routes/videoUpload.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../../db.js";
import { UPLOADS_DIR } from "../core/uploadPath.js";
import { getSalonPolicy } from "../scheduler.js";
import { generateCaption } from "../openai.js";
import { composeFinalCaption } from "../core/composeFinalCaption.js";

const router = express.Router();

// Ensure videos subdirectory exists
const videoDir = path.join(UPLOADS_DIR, "videos");
fs.mkdirSync(videoDir, { recursive: true });

// multer: accept video only, max 200MB, store in UPLOADS_DIR/videos/
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: videoDir,
    filename: (_req, file, cb) => {
      cb(null, `${randomBytes(16).toString("hex")}.mp4`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are allowed"));
  },
});

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tokenRow(token) {
  return db.prepare(`
    SELECT * FROM video_upload_tokens
    WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(token);
}

function resolveStylist(stylistId) {
  let stylist = db.prepare("SELECT * FROM stylists WHERE id = ? LIMIT 1").get(stylistId);
  if (!stylist) {
    const mgr = db.prepare("SELECT * FROM managers WHERE id = ? LIMIT 1").get(stylistId);
    if (mgr) stylist = { id: mgr.id, name: mgr.name, phone: mgr.phone, city: null };
  }
  return stylist;
}

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #F8FAFC; color: #2B2D35; min-height: 100vh; }
  .wrap { max-width: 520px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.25rem; }
  p.sub { color: #7A7C85; font-size: 0.9rem; margin-bottom: 1.75rem; }
  label { display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.375rem; }
  .field { margin-bottom: 1.25rem; }
  input[type=file], textarea, input[type=text] {
    width: 100%; border: 1px solid #E2E8F0; border-radius: 0.5rem;
    padding: 0.625rem 0.75rem; font-family: inherit; font-size: 0.95rem;
    background: #fff; color: #2B2D35;
  }
  textarea { resize: vertical; }
  .btn-primary {
    width: 100%; background: #3B72B9; color: #fff; border: none;
    border-radius: 0.5rem; padding: 0.875rem; font-size: 1rem;
    font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .btn-secondary {
    width: 100%; background: #fff; color: #3B72B9; border: 1.5px solid #3B72B9;
    border-radius: 0.5rem; padding: 0.75rem; font-size: 0.95rem;
    font-weight: 600; font-family: inherit; cursor: pointer;
  }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .note { font-size: 0.8rem; color: #7A7C85; margin-top: 0.5rem; }
  .overlay { display:none; position:fixed; inset:0; background:rgba(248,250,252,0.92);
    z-index:99; flex-direction:column; align-items:center; justify-content:center; gap:1rem; }
  .overlay.active { display:flex; }
  .spinner { width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#3B72B9;
    border-radius:50%; animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .overlay p { font-weight:600; color:#3B72B9; }
  .regen-row { display:flex; gap:0.5rem; }
  .regen-row input { flex:1; }
  .regen-row button { width:auto; padding:0 1rem; white-space:nowrap; }
  .error-msg { color:#dc2626; font-size:0.85rem; margin-top:0.5rem; display:none; }
`;

const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet" />`;

// ── GET /stylist/upload-video/:token ──────────────────────────────────────────
router.get("/:token", (req, res) => {
  const row = tokenRow(req.params.token);
  if (!row) {
    return res.status(401).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
      <h2>Link expired</h2><p>This upload link has expired or already been used. Text REEL to get a new one.</p>
    </body></html>`);
  }

  const stylist = resolveStylist(row.stylist_id);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Upload Your Reel – MostlyPostly</title>
  ${FONT_LINK}
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div id="loadingOverlay" class="overlay">
    <div class="spinner"></div>
    <p>Generating your caption…</p>
  </div>
  <div class="wrap">
    <h1>Upload Your Reel</h1>
    <p class="sub">Hi ${esc(stylist?.name || "there")}! Upload your video and describe the look — we'll write your caption.</p>
    <form id="uploadForm" method="POST" enctype="multipart/form-data">
      <div class="field">
        <label for="video">Video</label>
        <input type="file" id="video" name="video" accept="video/*" required />
        <p class="note">Select from your camera roll for best quality.</p>
      </div>
      <div class="field">
        <label for="description">Describe the look (service, style, vibe)</label>
        <textarea id="description" name="description" rows="3"
          placeholder="e.g. Balayage with toner, warm honey tones, fall vibes" required></textarea>
      </div>
      <button type="submit" id="submitBtn" class="btn-primary">Generate Caption</button>
    </form>
  </div>
  <script>
    document.getElementById('uploadForm').addEventListener('submit', function() {
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('loadingOverlay').classList.add('active');
    });
  </script>
</body>
</html>`);
});

// ── POST /stylist/upload-video/regen  (AJAX — must be before /:token) ─────────
router.post("/regen", express.json(), async (req, res) => {
  const { postId, direction, originalDescription } = req.body || {};
  if (!postId) return res.status(400).json({ error: "Missing postId" });

  const post = db.prepare("SELECT * FROM posts WHERE id = ? AND status = 'draft' LIMIT 1").get(postId);
  if (!post) return res.status(404).json({ error: "Draft not found" });

  const salon  = db.prepare("SELECT * FROM salons WHERE slug = ? LIMIT 1").get(post.salon_id);
  const stylist = { name: post.stylist_name, city: null };

  try {
    const notes = [originalDescription, direction].filter(Boolean).join(". Direction: ");
    const fullSalon = getSalonPolicy(post.salon_id) || salon;
    const aiJson = await generateCaption({
      imageDataUrl: null,
      notes,
      salon: fullSalon,
      stylist,
      postType: "reel",
      city: "",
    });

    const caption = composeFinalCaption({
      caption: aiJson?.caption || "",
      hashtags: aiJson?.hashtags || [],
      stylistName: post.stylist_name || "",
      salon: fullSalon,
      platform: "instagram",
    });

    db.prepare("UPDATE posts SET base_caption = ?, final_caption = ? WHERE id = ?")
      .run(aiJson?.caption || "", caption, postId);

    res.json({ caption });
  } catch (err) {
    console.error("[VideoUpload/regen] Error:", err.message);
    res.status(500).json({ error: "Regeneration failed. Please try again." });
  }
});

// ── POST /stylist/upload-video/finalize ───────────────────────────────────────
router.post("/finalize", express.urlencoded({ extended: false }), (req, res) => {
  const { postId, finalCaption } = req.body || {};
  if (!postId || !finalCaption) {
    return res.status(400).send("Missing required fields.");
  }

  const post = db.prepare("SELECT * FROM posts WHERE id = ? AND status = 'draft' LIMIT 1").get(postId);
  if (!post) {
    return res.status(400).send("Post not found or already submitted.");
  }

  db.prepare("UPDATE posts SET final_caption = ?, status = 'manager_pending' WHERE id = ?")
    .run(finalCaption.trim(), postId);

  console.log(`[VideoUpload] Post ${postId} finalized → manager_pending`);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Submitted! – MostlyPostly</title>
  ${FONT_LINK}
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #F8FAFC; color: #2B2D35;
      min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .card { background: #fff; border-radius: 1rem; padding: 2rem; max-width: 400px;
      text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    h2 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #7A7C85; font-size: 0.95rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5rem;margin-bottom:1rem">&#x2705;</div>
    <h2>Reel submitted!</h2>
    <p>Your post has been sent to your manager for approval. It will be scheduled once approved.</p>
  </div>
</body>
</html>`);
});

// ── POST /stylist/upload-video/:token ─────────────────────────────────────────
// Uploads video, generates caption synchronously, returns caption editor page.
router.post("/:token", videoUpload.single("video"), async (req, res) => {
  const row = tokenRow(req.params.token);
  if (!row) {
    return res.status(401).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
      <h2>Link expired</h2><p>This upload link has expired or already been used. Text REEL to get a new one.</p>
    </body></html>`);
  }

  if (!req.file) {
    return res.status(400).send("No video file received.");
  }

  const description = (req.body.description || "").trim();
  if (!description) {
    return res.status(400).send("Please include a description of the look.");
  }

  // Mark token used immediately to prevent replay
  db.prepare("UPDATE video_upload_tokens SET used_at = datetime('now') WHERE token = ?")
    .run(req.params.token);

  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const videoUrl = `${base}/uploads/videos/${req.file.filename}`;

  const stylist = resolveStylist(row.stylist_id);
  const salon   = db.prepare("SELECT * FROM salons WHERE slug = ? LIMIT 1").get(row.salon_id);

  if (!stylist || !salon) {
    return res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
      <h2>Error</h2><p>Could not find your salon account. Please contact your manager.</p>
    </body></html>`);
  }

  // Generate caption synchronously — user sees loading overlay while waiting
  let caption = "";
  let postId = null;
  try {
    const fullSalon = getSalonPolicy(row.salon_id) || salon;
    const aiJson = await generateCaption({
      imageDataUrl: null,
      notes: description,
      salon: fullSalon,
      stylist,
      postType: "reel",
      city: stylist.city || "",
    });

    caption = composeFinalCaption({
      caption: aiJson?.caption || "",
      hashtags: aiJson?.hashtags || [],
      stylistName: stylist.name || "",
      salon: fullSalon,
      platform: "instagram",
    });

    postId = randomUUID();
    db.prepare(`
      INSERT INTO posts (id, salon_id, stylist_name, image_url, base_caption, final_caption, post_type, content_type, placement, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'reel', 'standard_post', 'reel', 'draft', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `).run(postId, row.salon_id, stylist.name, videoUrl, aiJson?.caption || "", caption);

    console.log(`[VideoUpload] Draft post ${postId} created for ${stylist.name}`);
  } catch (err) {
    console.error("[VideoUpload] Caption generation failed:", err.message);
    return res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
      <h2>Caption generation failed</h2><p>Something went wrong. Please go back and try again.</p>
    </body></html>`);
  }

  // Return caption editor page
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Reel Caption – MostlyPostly</title>
  ${FONT_LINK}
  <style>${SHARED_CSS}
    .section-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
    .caption-box { min-height: 180px; }
    .divider { border: none; border-top: 1px solid #E2E8F0; margin: 1.5rem 0; }
    .regen-label { font-size: 0.8rem; color: #7A7C85; margin-bottom: 0.5rem; display:block; }
  </style>
</head>
<body>
  <div id="loadingOverlay" class="overlay">
    <div class="spinner"></div>
    <p id="loadingMsg">Regenerating…</p>
  </div>
  <div class="wrap">
    <h1>Your Reel Caption</h1>
    <p class="sub">Review and edit below, then submit when ready.</p>

    <div class="field">
      <label class="section-title" for="captionBox">Caption</label>
      <textarea id="captionBox" class="caption-box" rows="8">${esc(caption)}</textarea>
    </div>

    <hr class="divider" />

    <div class="field">
      <span class="regen-label">Not quite right? Add a direction and regenerate:</span>
      <div class="regen-row">
        <input type="text" id="regenDirection" placeholder="e.g. make it more energetic" />
        <button type="button" class="btn-secondary" id="regenBtn" onclick="regenerate()">Regenerate</button>
      </div>
      <p class="error-msg" id="regenError"></p>
    </div>

    <hr class="divider" />

    <form id="finalizeForm" method="POST" action="/stylist/upload-video/finalize">
      <input type="hidden" name="postId" value="${esc(postId)}" />
      <input type="hidden" name="finalCaption" id="finalCaptionInput" value="${esc(caption)}" />
      <button type="submit" class="btn-primary" id="submitBtn">Submit Post</button>
    </form>
  </div>

  <script>
    const postId = ${JSON.stringify(postId)};
    const originalDescription = ${JSON.stringify(description)};

    // Keep hidden input in sync with textarea
    const captionBox = document.getElementById('captionBox');
    const finalInput = document.getElementById('finalCaptionInput');
    captionBox.addEventListener('input', () => { finalInput.value = captionBox.value; });

    // Show loading overlay before form submit
    document.getElementById('finalizeForm').addEventListener('submit', function() {
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('loadingMsg').textContent = 'Submitting…';
      document.getElementById('loadingOverlay').classList.add('active');
    });

    async function regenerate() {
      const direction = document.getElementById('regenDirection').value.trim();
      const errEl = document.getElementById('regenError');
      errEl.style.display = 'none';

      document.getElementById('regenBtn').disabled = true;
      document.getElementById('loadingMsg').textContent = 'Regenerating…';
      document.getElementById('loadingOverlay').classList.add('active');

      try {
        const resp = await fetch('/stylist/upload-video/regen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, direction, originalDescription }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Unknown error');
        captionBox.value = data.caption;
        finalInput.value = data.caption;
      } catch (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
      } finally {
        document.getElementById('regenBtn').disabled = false;
        document.getElementById('loadingOverlay').classList.remove('active');
      }
    }
  </script>
</body>
</html>`);
});

export default router;
