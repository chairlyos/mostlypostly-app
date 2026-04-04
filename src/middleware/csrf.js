// src/middleware/csrf.js
// Synchronizer token pattern CSRF protection.
//
// - Generates a per-session token on first request
// - Validates token on all state-mutating requests (POST/PUT/PATCH/DELETE)
// - Auto-injects hidden <input name="_csrf"> into every <form method="POST"> in HTML responses
// - Exposes token in res.locals.csrfToken for manual use and a <meta> tag in pageShell
//
// Skipped routes (external webhooks / payment processors that send their own auth):
//   /billing/webhook, /inbound/twilio, /inbound/telegram, /integrations/webhook/*

import crypto from "crypto";

const SKIP_PREFIXES = [
  "/billing/webhook",
  "/inbound/twilio",
  "/inbound/telegram",
  "/integrations/webhook",
  "/api/demo-request",
  "/stylist/upload-video",  // token-authenticated upload page — no session required
];

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Returns the CSRF middleware function.
 * Mount AFTER session middleware in server.js.
 */
export default function csrfProtection() {
  return function csrf(req, res, next) {
    // Skip external webhook routes
    const path = req.path || "";
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      return next();
    }

    // Ensure a token exists in the session
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateToken();
    }

    const token = req.session.csrfToken;
    res.locals.csrfToken = token;

    // Validate on mutating methods
    const mutating = ["POST", "PUT", "PATCH", "DELETE"];
    if (mutating.includes(req.method)) {
      const submitted =
        req.body?._csrf ||
        req.headers["x-csrf-token"] ||
        req.query._csrf;

      if (!submitted || submitted !== token) {
        console.warn(`[CSRF] Token mismatch on ${req.method} ${req.path} — ip=${req.ip}`);
        return res.status(403).type("html").send(`
          <!DOCTYPE html><html><head><meta charset="UTF-8"/>
          <title>Forbidden — MostlyPostly</title></head>
          <body style="font-family:sans-serif;padding:40px;text-align:center">
            <h1 style="color:#2B2D35">Session expired or invalid request</h1>
            <p>Please <a href="${req.headers.referer || "/manager"}">go back</a> and try again.</p>
          </body></html>
        `);
      }
    }

    // Auto-inject CSRF token into all HTML responses:
    //   1. Hidden field in every <form method="POST"> — no per-route changes needed
    //   2. For multipart/form-data forms, inject token as ?_csrf= query param in the
    //      action URL instead, because the body isn't parsed until multer runs (after
    //      this middleware), so req.body._csrf would always be undefined for file uploads.
    //   3. <meta name="csrf-token"> in <head> — for client-side JS (admin.js modals)
    const originalSend = res.send.bind(res);
    res.send = function (body) {
      if (typeof body === "string" && body.includes("<form")) {
        body = body.replace(
          /(<form[^>]+method=["']?post["']?[^>]*>)/gi,
          (match) => {
            const isMultipart = /enctype=["']multipart\/form-data["']/i.test(match);
            if (isMultipart) {
              // Inject token into the action URL query string
              return match.replace(
                /(action=["'])([^"']*)(["'])/i,
                (_, q1, url, q2) => {
                  const sep = url.includes("?") ? "&" : "?";
                  return `${q1}${url}${sep}_csrf=${token}${q2}`;
                }
              );
            }
            return `${match}<input type="hidden" name="_csrf" value="${token}">`;
          }
        );
      }
      if (typeof body === "string" && body.includes("</head>")) {
        // Inject meta tag before </head> for JS access via document.querySelector
        body = body.replace(
          "</head>",
          `<meta name="csrf-token" content="${token}"></head>`
        );
      }
      return originalSend(body);
    };

    next();
  };
}
