// migrations/022_stylist_integration_id.js
// Stores the external employee ID from a booking system (e.g., Zenoti employee UUID)
// so we can match webhook payloads back to a MostlyPostly stylist.
export function run(db) {
  try {
    db.exec(`ALTER TABLE stylists ADD COLUMN integration_employee_id TEXT`);
    console.log("[022] Added stylists.integration_employee_id");
  } catch (e) {
    if (!e.message.includes("duplicate column")) throw e;
  }
}
