// migrations/054_vendor_scheduled_status.js
// Registers vendor_scheduled as a valid post status.
// No DDL needed — posts.status is TEXT with no CHECK constraint.
// This migration documents the new status introduced for vendor campaign pre-scheduling.
export default function migrate(db) {
  console.log("[054] vendor_scheduled status registered (no DDL required)");
}
