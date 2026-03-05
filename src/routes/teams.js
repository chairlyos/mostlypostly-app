// src/routes/teams.js
// Microsoft Teams inbound adapter that matches MostlyPostly's messageRouter contract:
// - sendMessage must have sendText(chatId, text)
// - chatId must be resolvable by lookupStylist(chatId) via DB (stylists.chat_id / managers.chat_id)

import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";

import { BotFrameworkAdapter } from "botbuilder";
import { MicrosoftAppCredentials } from "botframework-connector";

import { db } from "../../db.js";
import { handleIncomingMessage } from "../core/messageRouter.js";
import moderateAIOutput from "../utils/moderation.js";

// ---------- small helpers ----------
const clean = (v) => (v || "").toString().trim();

function getTenantId(activity) {
  return (
    activity?.channelData?.tenant?.id ||
    activity?.conversation?.tenantId ||
    null
  );
}

function getUserId(activity) {
  return activity?.from?.aadObjectId || activity?.from?.id || null;
}

function getConversationId(activity) {
  return activity?.conversation?.id || null;
}

async function ensureUploadsDir() {
  const publicDir = process.env.PUBLIC_DIR || path.join(process.cwd(), "public");
  const uploadsDir = path.join(publicDir, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

async function getBotAccessToken() {
  const appId = process.env.MICROSOFT_APP_ID;
  const appPassword = process.env.MICROSOFT_APP_PASSWORD;
  if (!appId || !appPassword) return null;

  try {
    const creds = new MicrosoftAppCredentials(appId, appPassword);
    return await creds.getToken();
  } catch (e) {
    console.warn("⚠️ Teams: failed to acquire bot token:", e.message);
    return null;
  }
}

// Download Teams attachment and rehost it publicly under /uploads so OpenAI can fetch it.
async function rehostTeamsImage(contentUrl) {
  if (!contentUrl) return null;

  const uploadsDir = await ensureUploadsDir();
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  const filePath = path.join(uploadsDir, filename);

  const token = await getBotAccessToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // try authenticated fetch first
  let resp = await fetch(contentUrl, { headers });
  if (!resp.ok && token) resp = await fetch(contentUrl);

  if (!resp.ok) {
    console.warn("⚠️ Teams: failed to download attachment:", resp.status, resp.statusText);
    return null;
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(filePath, buf);

  const baseUrl = process.env.PUBLIC_BASE_URL || "";
  const publicPath = `/uploads/${filename}`;
  return baseUrl ? `${baseUrl}${publicPath}` : publicPath;
}

// LINK flow: we store teams chat id into DB so lookupStylist(chatId) works without new tables.
function persistChatIdToPerson(found, chatId) {
  if (!found?.stylist?.id) return;

  if (found.stylist.role === "manager") {
    db.prepare(`UPDATE managers SET chat_id = ? WHERE id = ?`).run(chatId, found.stylist.id);
    return;
  }

  db.prepare(`UPDATE stylists SET chat_id = ? WHERE id = ?`).run(chatId, found.stylist.id);
}

export default function teamsRoute(drafts, lookupStylist, safeGenerateCaption) {
  const router = express.Router();

  const adapter = new BotFrameworkAdapter({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD,
  });

  const allowedTenants = (process.env.TEAMS_ALLOWED_TENANTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // IMPORTANT: wrap processActivity so errors don't crash the whole server
  router.post("/messages", async (req, res) => {
    try {
      await adapter.processActivity(req, res, async (context) => {
        const activity = context.activity;
        if (!activity) return;

        const tenantId = getTenantId(activity);
        const userId = getUserId(activity);
        const conversationId = getConversationId(activity);

        if (allowedTenants.length && tenantId && !allowedTenants.includes(tenantId)) {
          await context.sendActivity("This Teams tenant is not authorized for MostlyPostly.");
          return;
        }

        // Must be stable + match how we store into DB
        const chatId = `teams:${conversationId}`;

        // Build sendMessage object to match messageRouter expectations
        const sendMessage = async (_chatId, msg) => sendMessage.sendText(_chatId, msg);
        sendMessage.sendText = async (_chatId, msg) => {
          const text =
            typeof msg === "string"
              ? msg
              : (msg?.body || msg?.text || JSON.stringify(msg));
          await context.sendActivity(text);
        };

        // text may arrive in activity.text or action submit payload
        const submitAction = activity?.value?.action;
        const text = clean(submitAction || activity.text || activity?.value?.text);

        // image (if any)
        let imageUrl = null;
        const atts = activity.attachments || [];
        const img = atts.find((a) => (a.contentType || "").startsWith("image/"));
        if (img?.contentUrl) {
          imageUrl = await rehostTeamsImage(img.contentUrl);
        }

        // LINK flow: "LINK <phone>"
        if (/^LINK\b/i.test(text)) {
          const identifier = text.split(/\s+/).slice(1).join(" ").trim();

          if (!identifier) {
            await sendMessage.sendText(
              chatId,
              "To link your Teams account, send: `LINK +15551234567` (use the stylist or manager phone on file)."
            );
            return;
          }

          const found = lookupStylist(identifier);
          if (!found?.stylist || !found?.salon) {
            await sendMessage.sendText(
              chatId,
              "I couldn't find that person in the database. Double-check the phone number on file and try again."
            );
            return;
          }

          // store this Teams chatId onto the matching DB row so lookupStylist(chatId) works
          persistChatIdToPerson(found, chatId);

          const salonName =
            found?.salon?.salon_info?.name || found?.salon?.salon_id || "your salon";

          await sendMessage.sendText(
            chatId,
            `✅ Linked! You're connected to *${salonName}* as *${found.stylist.stylist_name}*.`
          );
          await sendMessage.sendText(
            chatId,
            "Now send a photo (or a photo + notes) and I’ll generate a caption preview. Reply APPROVE / REGENERATE / CANCEL."
          );
          return;
        }

        // Delegate to the core router.
        // IMPORTANT: lookupStylist(chatId) will work only after LINK.
        await handleIncomingMessage({
          source: "teams",
          chatId,
          text,
          imageUrl,
          drafts,
          generateCaption: ({ imageDataUrl, notes, salon, stylist, city }) =>
            safeGenerateCaption({
              imageUrl: imageDataUrl,
              notes,
              stylist,
              salon,
              city,
            }),
          moderateAIOutput,
          sendMessage,
          io: req.app.get("io"),
        });
      });
    } catch (err) {
      console.error("❌ Teams adapter error:", err);
      // Always ACK to Azure/Teams so it doesn't retry endlessly
      if (!res.headersSent) res.status(200).send();
    }
  });

  return router;
}
