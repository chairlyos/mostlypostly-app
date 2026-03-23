import db from './db.js';
import { randomUUID } from 'node:crypto';

const salonId = 'vanity-lounge';
const now = new Date();

function scheduleDate(dayOffset, hour = 10) {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const posts = [
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Samantha Brooks', post_type: 'standard_post',    status: 'manager_pending',  base_caption: 'Fresh highlights by Samantha! Book now.',                           final_caption: null,                                                         image_url: null, scheduled_for: null,                  published_at: null, error_message: null, salon_post_number: 9001 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Jessica Lee',     post_type: 'before_after_post', status: 'manager_approved', base_caption: 'Before & after transformation by Jessica. Color correction!',     final_caption: 'Before & after transformation by Jessica. Color correction!', image_url: null, scheduled_for: scheduleDate(0, 14),  published_at: null, error_message: null, salon_post_number: 9002 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Marcus Webb',     post_type: 'standard_post',    status: 'manager_approved', base_caption: 'Bold cut by Marcus. Ready to turn heads?',                         final_caption: 'Bold cut by Marcus. Ready to turn heads?',                   image_url: null, scheduled_for: scheduleDate(1, 10),  published_at: null, error_message: null, salon_post_number: 9003 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Taylor Kim',      post_type: 'promotions',        status: 'manager_approved', base_caption: '20% off all color services this week only!',                       final_caption: '20% off all color services this week only!',                 image_url: null, scheduled_for: scheduleDate(1, 16),  published_at: null, error_message: null, salon_post_number: 9004 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Aisha Patel',     post_type: 'availability',      status: 'manager_approved', base_caption: 'Aisha has openings Thursday at 11am and 3pm. Book now!',          final_caption: 'Aisha has openings Thursday at 11am and 3pm. Book now!',     image_url: null, scheduled_for: scheduleDate(3, 9),   published_at: null, error_message: null, salon_post_number: 9005 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Riley Chen',      post_type: 'celebration',       status: 'manager_approved', base_caption: 'Happy Birthday Riley! 5 amazing years of stunning cuts.',        final_caption: 'Happy Birthday Riley! 5 amazing years of stunning cuts.',    image_url: null, scheduled_for: scheduleDate(5, 11),  published_at: null, error_message: null, salon_post_number: 9006 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Devon Morris',    post_type: 'standard_post',    status: 'published',        base_caption: 'Stunning balayage by Devon.',                                       final_caption: 'Stunning balayage by Devon.',                                image_url: null, scheduled_for: scheduleDate(-1, 10), published_at: scheduleDate(-1, 10), error_message: null, salon_post_number: 9007 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Priya Sharma',    post_type: 'standard_post',    status: 'failed',           base_caption: 'Gorgeous updo by Priya.',                                          final_caption: 'Gorgeous updo by Priya.',                                    image_url: null, scheduled_for: scheduleDate(-2, 13), published_at: null, error_message: 'Instagram token expired', salon_post_number: 9008 },
  { id: randomUUID(), salon_id: salonId, stylist_name: 'Natalie Ford',    post_type: 'standard_post',    status: 'manager_approved', base_caption: "Natalie's signature blowout — book your appointment today.",    final_caption: "Natalie's signature blowout — book your appointment today.", image_url: null, scheduled_for: scheduleDate(7, 10),  published_at: null, error_message: null, salon_post_number: 9009 },
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO posts
  (id, salon_id, stylist_name, post_type, status, base_caption, final_caption, image_url, scheduled_for, published_at, salon_post_number, error_message)
  VALUES
  (@id, @salon_id, @stylist_name, @post_type, @status, @base_caption, @final_caption, @image_url, @scheduled_for, @published_at, @salon_post_number, @error_message)
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) stmt.run(row);
});

insertMany(posts);
console.log(`✅ Inserted ${posts.length} test posts into vanity-lounge:`);
posts.forEach(p => console.log(`  ${p.status.padEnd(18)} ${p.post_type.padEnd(20)} scheduled=${p.scheduled_for?.slice(0,10) ?? 'none'} — ${p.stylist_name}`));
