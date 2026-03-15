#!/usr/bin/env node
// scripts/delete-salon.js
// Usage:
//   node scripts/delete-salon.js list              — show all salons
//   node scripts/delete-salon.js info <slug>        — show details for one salon
//   node scripts/delete-salon.js delete <slug>      — delete salon + all related data

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ENV = process.env.APP_ENV || "local";
const DB_PATH =
  process.env.DB_PATH ||
  (APP_ENV === "production" ? "/data/postly.db" :
   APP_ENV === "staging"    ? "/tmp/postly.db"  :
                              path.join(__dirname, "..", "postly.db"));

const db = new Database(DB_PATH);

const [,, cmd, slug] = process.argv;

if (!cmd || cmd === "list") {
  const rows = db.prepare(`
    SELECT slug, name, status, plan_status, created_at
    FROM salons ORDER BY created_at DESC
  `).all();
  console.log("\n── Salons ──────────────────────────────────────");
  for (const r of rows) {
    console.log(`  ${r.slug.padEnd(30)} ${(r.name || "").padEnd(30)} ${(r.plan_status || "no-plan").padEnd(12)} ${r.status}`);
  }
  console.log(`\n${rows.length} salon(s) total\n`);
  process.exit(0);
}

if (!slug) {
  console.error("Usage: node scripts/delete-salon.js <list|info|delete> <slug>");
  process.exit(1);
}

const salon = db.prepare("SELECT * FROM salons WHERE slug = ?").get(slug);
if (!salon) {
  console.error(`No salon found with slug: ${slug}`);
  process.exit(1);
}

if (cmd === "info") {
  const managers = db.prepare("SELECT id, name, email, role FROM managers WHERE salon_id = ?").all(slug);
  const stylists = db.prepare("SELECT id, name, phone FROM stylists WHERE salon_id = ?").all(slug);
  const postCount = db.prepare("SELECT COUNT(*) as n FROM posts WHERE salon_id = ?").get(slug).n;

  console.log("\n── Salon ───────────────────────────────────────");
  console.log(`  Slug:        ${salon.slug}`);
  console.log(`  Name:        ${salon.name}`);
  console.log(`  Status:      ${salon.status} / ${salon.status_step}`);
  console.log(`  Plan:        ${salon.plan_status || "none"} (${salon.stripe_customer_id || "no Stripe"})`);
  console.log(`  Created:     ${salon.created_at}`);
  console.log(`  Group:       ${salon.group_id}`);

  console.log("\n── Managers ────────────────────────────────────");
  for (const m of managers) console.log(`  ${m.role.padEnd(10)} ${(m.name || "").padEnd(25)} ${m.email}`);

  console.log("\n── Stylists ────────────────────────────────────");
  for (const s of stylists) console.log(`  ${(s.name || "").padEnd(25)} ${s.phone}`);

  console.log(`\n── Posts: ${postCount} ──────────────────────────────────\n`);
  process.exit(0);
}

if (cmd === "delete") {
  console.log(`\nDeleting salon: ${slug} (${salon.name})\n`);

  const deleted = db.transaction(() => {
    const postIds = db.prepare("SELECT id FROM posts WHERE salon_id = ?").all(slug).map(r => r.id);
    const managerIds = db.prepare("SELECT id FROM managers WHERE salon_id = ?").all(slug).map(r => r.id);

    const counts = {};

    // post_insights
    if (postIds.length) {
      const placeholders = postIds.map(() => "?").join(",");
      counts.post_insights = db.prepare(`DELETE FROM post_insights WHERE post_id IN (${placeholders})`).run(...postIds).changes;
      counts.stylist_portal_tokens = db.prepare(`DELETE FROM stylist_portal_tokens WHERE post_id IN (${placeholders})`).run(...postIds).changes;
    }

    counts.posts                 = db.prepare("DELETE FROM posts                 WHERE salon_id = ?").run(slug).changes;
    counts.stylists              = db.prepare("DELETE FROM stylists              WHERE salon_id = ?").run(slug).changes;
    counts.stock_photos          = db.prepare("DELETE FROM stock_photos          WHERE salon_id = ?").run(slug).changes;
    counts.salon_integrations    = db.prepare("DELETE FROM salon_integrations    WHERE salon_id = ?").run(slug).changes;
    counts.salon_vendor_approvals= db.prepare("DELETE FROM salon_vendor_approvals WHERE salon_id = ?").run(slug).changes;
    counts.salon_vendor_feeds    = db.prepare("DELETE FROM salon_vendor_feeds    WHERE salon_id = ?").run(slug).changes;
    counts.vendor_post_log       = db.prepare("DELETE FROM vendor_post_log       WHERE salon_id = ?").run(slug).changes;
    counts.gamification_settings = db.prepare("DELETE FROM gamification_settings WHERE salon_id = ?").run(slug).changes;
    counts.security_events       = db.prepare("DELETE FROM security_events       WHERE salon_id = ?").run(slug).changes;
    counts.manager_tokens        = db.prepare("DELETE FROM manager_tokens        WHERE salon_id = ?").run(slug).changes;

    if (managerIds.length) {
      const placeholders = managerIds.map(() => "?").join(",");
      counts.manager_mfa = db.prepare(`DELETE FROM manager_mfa WHERE manager_id IN (${placeholders})`).run(...managerIds).changes;
      counts.password_reset_tokens = db.prepare(`DELETE FROM password_reset_tokens WHERE manager_id IN (${placeholders})`).run(...managerIds).changes;
    }

    counts.managers = db.prepare("DELETE FROM managers WHERE salon_id = ?").run(slug).changes;

    // salon_groups — only if no other salons reference this group
    if (salon.group_id) {
      const othersInGroup = db.prepare("SELECT COUNT(*) as n FROM salons WHERE group_id = ? AND slug != ?").get(salon.group_id, slug).n;
      if (othersInGroup === 0) {
        counts.salon_groups = db.prepare("DELETE FROM salon_groups WHERE id = ?").run(salon.group_id).changes;
      } else {
        counts.salon_groups = 0;
        console.log(`  ℹ️  Kept salon_group (${salon.group_id}) — ${othersInGroup} other location(s) still reference it`);
      }
    }

    counts.salons = db.prepare("DELETE FROM salons WHERE slug = ?").run(slug).changes;
    return counts;
  })();

  console.log("Deleted:");
  for (const [table, n] of Object.entries(deleted)) {
    if (n > 0) console.log(`  ${table}: ${n} row(s)`);
  }
  console.log("\nDone.\n");
  process.exit(0);
}

console.error(`Unknown command: ${cmd}. Use list, info, or delete.`);
process.exit(1);
