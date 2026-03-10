// src/core/integrationHandlers.js
// Handles events dispatched from booking system webhooks (Zenoti, Vagaro, etc.)

import db from "../../db.js";
import { sendViaTwilio } from "../routes/twilio.js";

// ──────────────────────────────────────────────────────────────
// Zenoti event dispatcher
// Zenoti sends all events to a single endpoint, differentiated
// by the "event_type" field in the payload body.
// ──────────────────────────────────────────────────────────────
export async function handleZenotiEvent(salonId, eventType, payload) {
  console.log(`[Zenoti] salon=${salonId} event=${eventType}`);

  switch (eventType) {
    case "appointment.completed":
    case "AppointmentCompleted":
      return handleAppointmentCompleted(salonId, payload);
    default:
      console.log(`[Zenoti] Unhandled event type: ${eventType}`);
  }
}

// ──────────────────────────────────────────────────────────────
// appointment.completed
// Fired when a client checks out. We look up the stylist by
// employee ID (stored in stylists.integration_employee_id) and
// send them an SMS nudge with the service name pre-filled.
// ──────────────────────────────────────────────────────────────
async function handleAppointmentCompleted(salonId, payload) {
  try {
    // Zenoti payload shape varies by center configuration.
    // Try both camelCase and snake_case field names.
    const employeeId =
      payload?.employee?.id ||
      payload?.therapist_id ||
      payload?.staff_id ||
      payload?.service_employee_id;

    const serviceName =
      payload?.service?.name ||
      payload?.service_name ||
      payload?.appointment_service?.name ||
      null;

    const guestFirstName =
      payload?.guest?.first_name ||
      payload?.client?.first_name ||
      payload?.guest_first_name ||
      null;

    if (!employeeId) {
      console.warn(`[Zenoti] appointment.completed missing employee ID for salon=${salonId}`);
      return;
    }

    // Look up the stylist by their Zenoti employee ID
    const stylist = db
      .prepare(
        `SELECT s.* FROM stylists s
         WHERE s.salon_id = ? AND s.integration_employee_id = ?
         LIMIT 1`
      )
      .get(salonId, String(employeeId));

    if (!stylist) {
      console.log(`[Zenoti] No stylist found for employee_id=${employeeId} salon=${salonId}`);
      return;
    }

    if (!stylist.phone) {
      console.log(`[Zenoti] Stylist ${stylist.name} has no phone number — skipping nudge`);
      return;
    }

    // Build the SMS nudge
    let msg = `📸 Your appointment just wrapped!`;
    if (serviceName) msg += ` Snap a photo of your ${serviceName}`;
    else msg += ` Snap a photo of your work`;
    if (guestFirstName) msg += ` for ${guestFirstName}`;
    msg += ` and text it here to generate a branded post automatically!`;

    await sendViaTwilio(stylist.phone, msg);
    console.log(`[Zenoti] Nudge sent → ${stylist.name} (${stylist.phone})`);

    // Update last_event_at on the integration row
    db.prepare(
      `UPDATE salon_integrations SET last_event_at = datetime('now')
       WHERE salon_id = ? AND platform = 'zenoti'`
    ).run(salonId);
  } catch (err) {
    console.error(`[Zenoti] handleAppointmentCompleted error:`, err.message);
  }
}

// ──────────────────────────────────────────────────────────────
// Vagaro event dispatcher (future)
// ──────────────────────────────────────────────────────────────
export async function handleVagaroEvent(salonId, eventType, payload) {
  console.log(`[Vagaro] salon=${salonId} event=${eventType}`);
  // TODO: implement when Vagaro integration is added
}
