// migrations/019_stock_photo_category.js
// Add category column to stock_photos for better filtering
// Categories: salon, profile, styling, general

export function run(db) {
  try {
    db.exec(`ALTER TABLE stock_photos ADD COLUMN category TEXT NOT NULL DEFAULT 'general'`);
    console.log("[019] Added stock_photos.category");
  } catch (e) {
    if (!e.message.includes("duplicate column")) throw e;
  }
}
