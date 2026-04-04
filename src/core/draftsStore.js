// Shared singleton in-memory drafts store.
// Import this in any route that needs to read or write pending post drafts.
// server.js, twilio.js, telegram.js, and videoUpload.js all share the same Map instance.
export const drafts = new Map();
