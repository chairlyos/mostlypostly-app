import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'postly.db');

const db = new Database(dbPath);

// Show before state
console.log('\n--- BEFORE ---');
const before = db.prepare('SELECT vendor_name, brand_hashtags, categories FROM vendor_brands ORDER BY vendor_name').all();
console.log('vendor_brands:', JSON.stringify(before, null, 2));

const renames = [
  {
    oldName: 'Your Brand',
    newName: 'Aveda',
    brand_hashtags: '["#AvedaColor","#Aveda"]',
    categories: '["Color","Standard","Promotion"]',
    product_value: 55,
  },
  {
    oldName: 'Your Brand 2',
    newName: 'Redken',
    brand_hashtags: '["#RedkenReady","#Redken"]',
    categories: '["Color","Standard","Styling"]',
    product_value: 40,
  },
  {
    oldName: 'Your Brand 3',
    newName: 'Olaplex',
    brand_hashtags: '["#Olaplex","#OlaplexTreatment"]',
    categories: '["Treatment","Standard","Repair"]',
    product_value: 50,
  },
];

const doRename = db.transaction(() => {
  for (const { oldName, newName, brand_hashtags, categories, product_value } of renames) {
    // Fetch existing row to carry over columns
    const existing = db.prepare('SELECT * FROM vendor_brands WHERE vendor_name = ?').get(oldName);
    if (!existing) {
      console.warn(`WARNING: "${oldName}" not found in vendor_brands — skipping`);
      continue;
    }

    // Update all FK references first
    db.prepare('UPDATE vendor_campaigns SET vendor_name = ? WHERE vendor_name = ?').run(newName, oldName);
    db.prepare('UPDATE salon_vendor_feeds SET vendor_name = ? WHERE vendor_name = ?').run(newName, oldName);
    db.prepare('UPDATE salon_vendor_approvals SET vendor_name = ? WHERE vendor_name = ?').run(newName, oldName);

    // Insert new vendor_brands row with carried-over + updated values
    db.prepare(`
      INSERT INTO vendor_brands (
        vendor_name,
        brand_hashtags,
        categories,
        allow_client_renewal,
        product_value,
        min_gap_days,
        platform_max_cap,
        last_sync_at,
        last_sync_count,
        last_sync_error,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newName,
      brand_hashtags,
      categories,
      existing.allow_client_renewal,
      product_value,
      existing.min_gap_days,
      existing.platform_max_cap,
      existing.last_sync_at,
      existing.last_sync_count,
      existing.last_sync_error,
      existing.created_at,
    );

    // Delete old row
    db.prepare('DELETE FROM vendor_brands WHERE vendor_name = ?').run(oldName);

    console.log(`Renamed: "${oldName}" -> "${newName}"`);
  }
});

doRename();

// Show after state
console.log('\n--- AFTER ---');
const after = db.prepare('SELECT vendor_name, brand_hashtags, categories, product_value FROM vendor_brands ORDER BY vendor_name').all();
console.log('vendor_brands:', JSON.stringify(after, null, 2));

const feeds = db.prepare('SELECT salon_id, vendor_name, enabled FROM salon_vendor_feeds ORDER BY vendor_name').all();
console.log('salon_vendor_feeds:', JSON.stringify(feeds, null, 2));

const campaigns = db.prepare('SELECT DISTINCT vendor_name FROM vendor_campaigns ORDER BY vendor_name').all();
console.log('vendor_campaigns (distinct vendor_name):', JSON.stringify(campaigns, null, 2));

const approvals = db.prepare('SELECT salon_id, vendor_name, status FROM salon_vendor_approvals ORDER BY vendor_name').all();
console.log('salon_vendor_approvals:', JSON.stringify(approvals, null, 2));

db.close();
console.log('\nDone.');
