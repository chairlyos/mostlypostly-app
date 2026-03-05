// src/routes/stylistPortal.js — Stylist caption editing portal
import express from "express";
import crypto from "crypto";
import { db } from "../../db.js";
import { generateCaption } from "../openai.js";
import { getSalonPolicy } from "../scheduler.js";
import { composeFinalCaption } from "../core/composeFinalCaption.js";
import moderateAIOutput from "../utils/moderation.js";

const router = express.Router();

// -------------------------------------------------------
// Token validation middleware
// -------------------------------------------------------
function validateToken(req, res, next) {
  const token = req.query.token;
  const postId = req.params.id;
  if (!token) return res.status(401).send(errorPage("Missing link token."));

  const row = db.prepare(`
    SELECT * FROM stylist_portal_tokens
    WHERE post_id = ? AND token = ? AND expires_at > datetime('now')
  `).get(postId, token);

  if (!row) return res.status(401).send(errorPage("This link has expired or is invalid. Please send a new photo to get a fresh link."));

  req.portalToken = row;
  next();
}

// -------------------------------------------------------
// HTML helpers
// -------------------------------------------------------
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function shell(title, body) {
  return `<!DOCTYPE html>
<html lang="en" class="bg-slate-950 text-slate-50">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} – MostlyPostly</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="max-w-xl mx-auto p-5 pb-16">
  <div class="flex items-center gap-2 mb-6">
    <span class="text-mpPrimary font-bold text-lg">MostlyPostly</span>
  </div>
  ${body}
</body>
</html>`;
}

function errorPage(msg) {
  return shell("Error", `<div class="bg-red-900/30 border border-red-700 rounded-xl p-6 text-red-300">${esc(msg)}</div>`);
}

function imageStrip(post) {
  let urls = [];
  try { urls = JSON.parse(post.image_urls || "[]"); } catch { }
  if (!urls.length && post.image_url) urls = [post.image_url];
  if (!urls.length) return "";

  if (urls.length === 1) {
    return `<img src="${esc(urls[0])}" class="rounded-xl w-full mb-5 max-h-72 object-cover" />`;
  }
  return `
    <div class="flex gap-2 mb-2 overflow-x-auto pb-1">
      ${urls.map(u => `<img src="${esc(u)}" class="w-36 h-36 rounded-xl object-cover border border-slate-700 flex-shrink-0" />`).join("")}
    </div>
    <p class="text-xs text-slate-400 mb-5">${urls.length} photos · caption applies to all</p>
  `;
}

// -------------------------------------------------------
// GET /:id  — show edit form
// -------------------------------------------------------
router.get("/:id", validateToken, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).send(errorPage("Post not found."));

  if (post.status === "manager_pending" || post.status === "manager_approved" || post.status === "published") {
    return res.send(shell("Already Submitted", `
      <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 text-center">
        <p class="text-green-400 font-semibold text-lg mb-2">Already submitted!</p>
        <p class="text-slate-400 text-sm">Your post is ${esc(post.status.replace("_", " "))}. No further action needed.</p>
      </div>
    `));
  }

  const token = req.query.token;

  // Parse hashtags for locked preview
  let hashtags = [];
  try { hashtags = JSON.parse(post.hashtags || "[]"); } catch { }
  const hashtagLine = hashtags.length ? "\n\n" + hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ") : "";
  const lockedPreview = `${post.base_caption || ""}${hashtagLine}\n\n${post.cta || "Book via link in bio."}`;

  res.send(shell("Review Your Caption", `
    <h1 class="text-xl font-bold mb-1">Your Post Preview</h1>
    <p class="text-sm text-slate-400 mb-5">Edit your caption below. Hashtags and booking details are managed by your salon.</p>

    ${imageStrip(post)}

    <form method="POST" action="/stylist/${esc(post.id)}/submit?token=${esc(token)}">

      <label class="block text-sm font-medium text-slate-300 mb-1">Your Caption</label>
      <textarea
        name="notes"
        rows="6"
        placeholder="Describe the service, style, or any personal touch you'd like..."
        class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >${esc(post.base_caption || "")}</textarea>
      <p class="text-xs text-slate-500 mb-5">AI will refine your text using your salon's tone and brand voice.</p>

      <div class="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Full Post Preview (locked)</p>
        <p class="text-sm text-slate-300 whitespace-pre-line leading-relaxed">${esc(lockedPreview)}</p>
        <p class="text-xs text-slate-500 mt-2">By ${esc(post.stylist_name || "")}</p>
      </div>

      <button type="submit"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
        Submit for Review
      </button>
    </form>
  `));
});

// -------------------------------------------------------
// POST /:id/submit  — AI regenerate → moderation → manager
// -------------------------------------------------------
router.post("/:id/submit", validateToken, async (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).send(errorPage("Post not found."));

  const stylistNotes = (req.body.notes || "").trim();
  const token = req.query.token;

  // Prevent double-submit
  if (post.status !== "draft") {
    return res.send(shell("Already Submitted", `
      <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 text-center">
        <p class="text-green-400 font-semibold mb-2">Already submitted!</p>
        <p class="text-slate-400 text-sm">Your post is being reviewed.</p>
      </div>
    `));
  }

  try {
    // 1. AI regenerate using their notes + salon tone
    const fullSalon = getSalonPolicy(post.salon_id);

    const aiJson = await generateCaption({
      imageDataUrl: post.image_url,
      notes: stylistNotes,
      salon: fullSalon,
      stylist: { stylist_name: post.stylist_name, name: post.stylist_name },
      city: fullSalon?.city || "",
    });

    // 2. Moderation
    const modResult = await moderateAIOutput(
      { caption: aiJson.caption || "", hashtags: aiJson.hashtags || [] },
      stylistNotes,
      { post_id: post.id, salon_id: post.salon_id }
    );

    if (!modResult.safe) {
      return res.send(shell("Content Flagged", `
        <div class="bg-red-900/30 border border-red-700 rounded-xl p-6">
          <p class="text-red-300 font-semibold mb-2">Your caption was flagged</p>
          <p class="text-slate-400 text-sm">Please revise your content and try again.</p>
          <a href="/stylist/${esc(post.id)}?token=${esc(token)}"
            class="inline-block mt-4 text-blue-400 text-sm underline">Go back and edit</a>
        </div>
      `));
    }

    // 3. Recompose final caption
    let hashtags = [];
    try { hashtags = aiJson.hashtags || JSON.parse(post.hashtags || "[]"); } catch { }

    const finalCaption = composeFinalCaption({
      caption: aiJson.caption,
      hashtags,
      cta: aiJson.cta || post.cta || "Book via link in bio.",
      instagramHandle: null,
      stylistName: post.stylist_name || "",
      bookingUrl: fullSalon?.booking_url || fullSalon?.booking_link || "",
      salon: fullSalon,
      asHtml: false,
    });

    // 4. Save and mark pending
    db.prepare(`
      UPDATE posts
      SET base_caption  = ?,
          final_caption = ?,
          hashtags      = ?,
          status        = 'manager_pending',
          updated_at    = datetime('now')
      WHERE id = ?
    `).run(
      aiJson.caption || stylistNotes,
      finalCaption,
      JSON.stringify(hashtags),
      post.id
    );

    // 5. Mark token used
    db.prepare(`UPDATE stylist_portal_tokens SET used_at = datetime('now') WHERE post_id = ? AND token = ?`)
      .run(post.id, token);

    console.log(`✅ [Portal] Post ${post.id} submitted by ${post.stylist_name} → manager_pending`);

    return res.send(shell("Submitted!", `
      <div class="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center mt-8">
        <div class="text-4xl mb-4">✅</div>
        <p class="text-white font-bold text-lg mb-2">Caption submitted!</p>
        <p class="text-slate-400 text-sm">Your manager will review and approve it shortly. You'll be notified when it's posted.</p>
      </div>
    `));

  } catch (err) {
    console.error("❌ [Portal] Submit error:", err.message);
    return res.send(shell("Error", `
      <div class="bg-red-900/30 border border-red-700 rounded-xl p-6">
        <p class="text-red-300 font-semibold mb-2">Something went wrong</p>
        <p class="text-slate-400 text-sm mb-4">${esc(err.message)}</p>
        <a href="/stylist/${esc(post.id)}?token=${esc(req.query.token)}"
          class="inline-block text-blue-400 text-sm underline">Try again</a>
      </div>
    `));
  }
});

export default router;
