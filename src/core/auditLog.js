// src/core/auditLog.js
// Logs security-relevant events to the security_events table.
// Fire-and-forget — never throws, never blocks the request.

import { randomUUID } from "crypto";
import db from "../../db.js";

/**
 * @param {object} opts
 * @param {string}  opts.eventType   — e.g. "login_success", "login_failure"
 * @param {string}  [opts.salonId]
 * @param {string}  [opts.managerId]
 * @param {object}  [opts.req]       — Express request (for IP + user agent)
 * @param {object}  [opts.metadata]  — any extra JSON-serializable data
 */
export function logSecurityEvent({ eventType, salonId, managerId, req, metadata } = {}) {
  try {
    const ip        = req ? (req.ip || req.headers?.["x-forwarded-for"] || null) : null;
    const userAgent = req ? (req.headers?.["user-agent"] || null) : null;

    db.prepare(
      `INSERT INTO security_events (id, salon_id, manager_id, event_type, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      salonId   || null,
      managerId || null,
      eventType,
      ip,
      userAgent,
      metadata ? JSON.stringify(metadata) : null
    );
  } catch (err) {
    // Never crash the request on an audit failure — just log to console
    console.error("[auditLog] Failed to write security event:", err.message);
  }
}
