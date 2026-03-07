// migrations/013_trial_used.js
// Tracks whether a salon has ever activated a Stripe trial.
// Prevents repeat trials on plan upgrades.

export function run(db) {
  try {
    db.exec(`ALTER TABLE salons ADD COLUMN trial_used INTEGER DEFAULT 0`);
    console.log("[013] Added salons.trial_used");
  } catch (err) {
    if (!err.message.includes("duplicate column")) throw err;
  }

  // Mark any salon that has already had a Stripe subscription as trial_used
  db.prepare(`
    UPDATE salons SET trial_used = 1
    WHERE stripe_subscription_id IS NOT NULL OR plan_status IN ('active','past_due','suspended')
  `).run();

  console.log("✅ [Migration 013] trial_used column applied");
}
