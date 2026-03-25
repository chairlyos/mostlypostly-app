export function run(db) {
  const postCols = db.pragma("table_info(posts)").map((c) => c.name);
  if (!postCols.includes("content_type")) {
    db.exec(`ALTER TABLE posts ADD COLUMN content_type TEXT`);
  }
  if (!postCols.includes("placement")) {
    db.exec(`ALTER TABLE posts ADD COLUMN placement TEXT`);
  }
  if (!postCols.includes("placement_overridden")) {
    db.exec(`ALTER TABLE posts ADD COLUMN placement_overridden INTEGER DEFAULT 0`);
  }

  const vcCols = db.pragma("table_info(vendor_campaigns)").map((c) => c.name);
  if (!vcCols.includes("content_type")) {
    db.exec(`ALTER TABLE vendor_campaigns ADD COLUMN content_type TEXT`);
  }

  console.log("[Migration 057] content_type + placement columns added");
}
