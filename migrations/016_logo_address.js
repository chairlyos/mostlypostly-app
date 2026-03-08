// migrations/016_logo_address.js
// Adds logo_url, address, and zip columns to salons.

export function run(db) {
  const addColumn = (col, type) => {
    try {
      db.exec(`ALTER TABLE salons ADD COLUMN ${col} ${type}`);
    } catch (e) {
      if (!e.message.includes("duplicate column")) throw e;
    }
  };

  addColumn("logo_url", "TEXT");
  addColumn("address",  "TEXT");
  addColumn("zip",      "TEXT");

  console.log("✅ [Migration 016] logo_url, address, zip added to salons");
}
