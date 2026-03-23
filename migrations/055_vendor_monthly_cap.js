export const up = (db) => {
  db.prepare(`ALTER TABLE salons ADD COLUMN vendor_monthly_cap INTEGER DEFAULT 8`).run();
};
