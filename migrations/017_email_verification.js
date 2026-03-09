// migrations/017_email_verification.js
// Adds email verification fields and marketing opt-in to managers table.

export function run(db) {
  const addCol = (table, col, type) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (e) {
      if (!e.message.includes("duplicate column")) throw e;
    }
  };

  addCol("managers", "email_verified",          "INTEGER DEFAULT 0");
  addCol("managers", "email_verify_token",       "TEXT");
  addCol("managers", "email_verify_expires_at",  "TEXT");
  addCol("managers", "marketing_opt_in",         "INTEGER DEFAULT 1");
  addCol("managers", "terms_accepted_at",        "TEXT");
  addCol("salons",   "subscription_ends_at",     "TEXT");

  // Back-fill existing managers as already verified (signed up before this feature)
  db.prepare("UPDATE managers SET email_verified = 1 WHERE email_verified = 0 AND password_hash IS NOT NULL").run();

  console.log("✅ [Migration 017] email verification fields added");
}
