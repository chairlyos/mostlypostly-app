# MostlyPostly Knowledge Base

_A plain-English guide to every feature — for salon managers, stylists, and platform admins._

---

## For Stylists

### How Posting Works (SMS)

MostlyPostly works entirely through text message — no app to download, no accounts to create. Once your manager adds you to the system, you'll receive a welcome text from your salon's MostlyPostly number.

**To create a post:**

1. Take a photo of your work (a color result, a fresh cut, a before-and-after, etc.)
2. Text that photo to your salon's MostlyPostly number
3. Within a few seconds, the AI reads your photo and writes a branded caption for you
4. You'll receive the caption back as a text message for review

That's it. The AI already knows your salon's tone of voice, your booking link, and your Instagram handle — so every caption sounds like your brand, not a robot.

**Good to know:**
- You can text one photo or multiple photos in the same message for carousel/gallery posts
- The system works 24/7 — you can submit posts at any hour; the scheduler will post them at the right time
- If you share photos via iMessage or WhatsApp, use SMS instead — the MostlyPostly number is a standard text number

---

### How Posting Works (Telegram)

If your salon uses Telegram instead of SMS, the flow is identical — just send your photo to the MostlyPostly Telegram bot your manager connected. Everything else works the same way.

---

### Approving Your Caption

After you receive the AI-generated caption, you have three choices:

**Reply APPROVE** — sends the post to your manager for review (if your salon requires it) or directly into the posting schedule.

**Reply EDIT followed by your new text** — replaces the caption entirely with whatever you type. For example: `EDIT Just gave Sarah her first balayage and she cried happy tears. Book the link below!` Then the post goes through the same approval path as APPROVE.

**Reply REDO followed by a direction** — asks the AI to rewrite the caption while keeping your salon's brand. For example: `REDO make it more playful and mention summer vibes`. The AI rewrites it and sends you a new preview. You can REDO as many times as you want.

**Good to know:**
- You can also reply `APPROVE` or `CANCEL` in plain text — no need to tap buttons
- CANCEL discards the post entirely. Nothing will be saved or sent for review.
- Your caption is a draft until you APPROVE it — taking your time is fine

---

### Requesting a Rewrite

Use **REDO** any time the caption doesn't feel right. You can be as specific or as vague as you want:

- `REDO shorter`
- `REDO focus on the color transformation, not the client`
- `REDO add a mention of the keratin treatment`
- `REDO make it feel more luxurious`

The AI rewrites within your salon's brand guidelines, so the tone will stay consistent even as you adjust the direction.

---

### Posting Your Availability

If your salon is connected to Zenoti (your booking software) and you've been mapped as an employee in that system, you can post your open appointment slots automatically.

**To post your availability:**

1. Text your salon's MostlyPostly number a message like:
   - "Post my availability"
   - "Post my openings this week"
   - "Post my availability for Wednesday"
   - "Post my openings March 20"
2. MostlyPostly pulls your real open slots from the booking system
3. A styled graphic is created showing your available times and services
4. You'll receive a link to preview and submit the post

You can be specific about the date range — the system understands "this week," "next week," "tomorrow," "the 20th," and more.

**If your salon isn't connected to Zenoti:** You can still text your availability in plain language (e.g., "I have openings Tuesday 10am-12pm for cuts and color") and the AI will write a caption from that.

**Good to know:**
- Availability posts always go through manager approval before publishing
- The preview link lets you update the availability details if anything looks off before you submit

---

### Instagram Collaborator Tagging (COLLAB)

If your Instagram handle is on file, you can opt in to be tagged as a collaborator on Instagram posts. This means the post appears on both the salon's feed and your personal Instagram feed — more visibility for your work.

**To opt in:** Text `COLLAB` to your salon's MostlyPostly number.

**To opt out:** Text `NOCOLLAB` at any time.

Your manager can also toggle this on or off from the Team page in the portal.

**Good to know:**
- Instagram will notify you each time a collaboration tag is sent — you'll need to accept it in the Instagram app for the post to appear on your profile
- Collaboration tagging requires that your Instagram handle is saved on your stylist profile

---

### What Happens After You Approve

Once you reply APPROVE (or EDIT with new text), here's what happens:

1. **If manager approval is required:** Your manager gets a notification with a link to review the post. They can approve, edit, or deny it from the web portal.
2. **If auto-publish is on:** The post goes straight into the posting schedule — no manager step needed.
3. **Scheduling:** MostlyPostly automatically picks the best time to publish within your salon's posting window (e.g., 9am–8pm) with smart spacing between posts so your feed doesn't get flooded.
4. **Publishing:** The post goes live on Facebook, Instagram, and/or Google Business Profile simultaneously.
5. **Analytics:** Once live, the system tracks reach, likes, saves, and engagement — your manager can see how each post performs.

---

## For Salon Managers

### Dashboard Overview

The Dashboard is your home base. When you log in, you'll land here and see:

- **Pending posts waiting for your approval** — each card shows the photo, AI-generated caption, the stylist who submitted it, and the post type
- **Recently published posts** — a quick look at what's already gone live
- **A red error banner** if any post failed to publish (with a plain-English explanation and a one-click retry)

You can approve, deny, or edit any pending post directly from the dashboard. No need to navigate anywhere else for day-to-day approvals.

---

### Approving Posts

When a stylist submits a post for review, you'll see it on the Dashboard as a pending card.

**To approve:** Click the **Approve** button. The post moves into the scheduled queue and will publish at the next available slot.

**To edit before approving:** Click into the post, update the caption, then approve. Your edits are saved as the final caption.

**To deny:** Click **Deny**. The post is removed and the stylist isn't notified automatically (you may want to reach out separately if feedback is needed).

**Post Now:** If you want a post to go live immediately (bypassing the schedule), use the **Post Now** option. It publishes within seconds.

**Good to know:**
- If manager approval is turned off in your settings, posts go straight to the queue when stylists approve them — you still see everything on the Dashboard, just already scheduled
- You can edit the caption at any point before the post publishes — even after approving

---

### The Post Queue

The Post Queue (`/manager/queue`) shows every approved post that's scheduled but hasn't published yet, in chronological order.

**What you can do here:**
- See exactly when each post is scheduled to go live
- Drag posts up or down to change the publishing order — the time slots stay the same, only the order of posts changes
- Get a bird's eye view of your entire upcoming content calendar

**How reordering works:** The queue holds a set of reserved time slots. When you drag a post to a new position, it inherits the time slot of the post that was there before. Nothing gets rescheduled to a new time — the slots stay, the posts swap.

**Good to know:**
- Only approved-and-scheduled posts appear in the queue — drafts and pending posts are on the Dashboard
- Changes save automatically after you drop a card into its new position

---

### Post Types

#### Standard Posts

The most common post type. A stylist texts a photo → AI writes a caption → it publishes to Facebook and Instagram as a regular feed post. Captions are automatically adapted for each platform (Facebook includes the full booking link; Instagram uses your handle and omits the raw URL).

#### Before & After Posts

When a stylist sends two photos together that show a transformation, the system recognizes them as a before-and-after and handles the caption accordingly — emphasizing the contrast and result.

#### Availability Posts

Graphic posts showing a stylist's open appointment slots. These are vertical story-style images (1080×1920) with the stylist's photo or a salon stock photo as the background, and a frosted overlay showing available times. Works automatically with Zenoti, or stylists can text their hours in plain language.

#### Promotion Posts

Managers can create promotion posts directly from the Dashboard. These are designed to announce a sale, discount, or limited-time offer.

**To create a promotion:**
1. Go to **Dashboard → Create Promotion**
2. Fill in:
   - **Product or Service** (required) — what you're promoting
   - **Discount** (optional) — e.g., "20% off" or "$15 off"
   - **Special Text** (optional) — e.g., "This week only!"
   - **Offer Expiration Date** (required)
3. The system generates a styled story graphic with your salon's brand colors, a stock photo background, and the promotion details
4. Review and approve it like any other post

**Good to know:**
- The system uses your salon's uploaded stock photos (or pulls a real salon photo from Pexels) as the background — no AI-generated images
- Promotion posts are created by managers, not stylists

#### Vendor Brand Posts (Pro Plan)

If your salon is on the Pro plan and you've enabled a vendor feed (like Aveda or Redken), the system automatically generates posts for that brand's active campaigns. The AI adapts the campaign content to your salon's tone of voice. See the Vendor Brand Integrations section for full details.

#### Celebration Posts (Birthday & Anniversary)

MostlyPostly automatically detects team birthdays and work anniversaries and creates a celebratory post for each one — no manual action needed.

**How it works:**
- Each morning around 6am (in your salon's time zone), the system checks for any stylists with a birthday or hire anniversary that day
- If found, it generates two posts automatically: a **square feed image** (1080×1080) and a **story image** (1080×1920), both using the stylist's photo
- The images include a festive headline (in the font style you've selected), the salon's logo watermark, and an AI-written caption
- Both posts are pre-approved and go directly into the schedule — you'll get a text message letting you know they're queued

**To set the font style for celebration posts:** Go to **Admin → Branding** and choose from Script, Editorial, or Playful. You can select multiple styles, and the system will cycle through them.

**To set up birthdays and anniversaries:** Add each stylist's birthday and hire date in their profile on the Team page.

---

### Analytics

#### Post Performance

The Analytics page shows how every published post performed across Facebook and Instagram:

- **Reach** — how many unique accounts saw the post
- **Likes / Reactions** — combined across both platforms
- **Comments** — from Facebook and Instagram
- **Saves** — how many people saved the post (Instagram)
- **Shares** — Facebook shares
- **Engagement Rate** — percentage of people who reached the post and interacted with it

You can sort by any column and filter by date range or platform.

**Top Performing Posts:** A dedicated section highlights the posts with the highest reach and engagement — useful for understanding what content resonates with your audience.

**Syncing:** Analytics data is pulled from Facebook and Instagram automatically. You can also manually trigger a sync from the Analytics page if you want the latest numbers right away.

#### Link Performance & ROI

The **Link Performance** card tracks every time someone clicks a booking link or vendor affiliate link from your posts — and estimates the revenue those clicks represent.

- **Booking link clicks** — tracked from every post that includes your booking URL. Each click is counted once.
- **Estimated ROI** — calculated as clicks × your average ticket value (set in Admin → Business Info). Default is $95.
- **Vendor affiliate clicks** — if you have a vendor affiliate link set, clicks on those are tracked separately.
- **Instagram Bio Link** — MostlyPostly generates a permanent link for your Instagram bio (`app.mostlypostly.com/t/your-salon/book`). Every time someone taps it, it counts as a bio click.

**Good to know:**
- IP addresses are never stored — only an anonymized hash is used for deduplication
- You can update your average ticket value any time in Admin → Business Info

---

### Admin Settings

The Admin page is where you configure everything about your salon's posting behavior and branding. It's organized into cards.

#### Business Info

- **Salon Name, Address, Website** — your core business details
- **Salon Logo** — upload your logo here. It appears as a watermark on celebration posts and is visible on the Admin page. You can replace it any time.
- **Booking URL** — the link that gets included in every post caption. Make sure this points to your online booking page.
- **Instagram Handle** — your salon's @handle (without the @). Used in Instagram captions in place of the raw booking URL.
- **Average Ticket Value** — used to estimate revenue from booking link clicks in Analytics. Set this to your typical per-appointment revenue.
- **Instagram Bio Link** — a permanent short link you can paste into your Instagram bio. Every tap on it is tracked in Analytics → Link Performance.

#### Brand Colors

Your brand color palette is extracted from your website during onboarding. It's used to color the accent bars and buttons on generated images (availability and promotion posts).

The palette shows five swatches with their hex codes. You can re-extract the palette at any time if you've redesigned your website.

#### Hashtags

Set up to 5 default hashtags that get appended to every post. These are your salon's go-to tags (e.g., `#HairGoals`, `#CarmelIndiana`, `#BalayageSpecialist`).

**Good to know:**
- Hashtags are appended after the AI-generated caption — they're never passed to the AI, so they won't influence the writing
- Vendor posts have their own hashtag layer on top of your salon defaults

#### Posting Schedule

Control when and how often MostlyPostly publishes:

- **Posting Window** — set a start time and end time (e.g., 9:00am to 8:00pm). Posts will only go live within this window.
- **Post Spacing** — set a minimum and maximum gap between posts (in minutes). This prevents your feed from being flooded if multiple posts are approved at once. A 60–240 minute range, for example, means posts go out no closer than 1 hour and no further than 4 hours apart.

#### Stock Photos

Stock photos are the backgrounds used for availability and promotion images. The system picks from these photos randomly (not always the latest upload) to create variety.

**Salon-wide stock photos** — uploaded here in Admin → Stock Photos. These are used as backgrounds for promotion posts and as a fallback for availability posts.

**Per-stylist stock photos** — uploaded on each stylist's profile in Team → Edit Stylist → Photo Library. These are used as backgrounds on that stylist's availability posts.

If no stock photos are uploaded, the system automatically pulls a real salon photo from Pexels (a free stock photo library). You don't need to upload anything to get started — but your own photos will always look more on-brand.

#### Celebration Font Style (Admin → Branding)

Choose the typography for birthday and anniversary posts. Options:
- **Script** — flowing, handwritten look (e.g., Great Vibes)
- **Editorial** — clean, modern all-caps
- **Playful** — bold and fun (e.g., Pacifico)

You can select multiple styles — the system will cycle through them so each celebration looks a little different.

---

### Team Management

The Team page is where you manage everyone who interacts with MostlyPostly: stylists who post via SMS, and managers or staff who use the web portal.

#### Adding Stylists

1. Go to **Team → Add Team Member**
2. Select **Stylist** as the role
3. Enter their name, phone number, and optionally their Instagram handle and specialties
4. Click **Add** — a welcome SMS is automatically sent to their phone with instructions on how to start posting

**Good to know:**
- Stylists don't need to create an account or download anything — they just need to receive the welcome text
- You can resend the welcome SMS from their stylist card if they missed it or got a new phone
- Each stylist card shows a colored activity dot: green = texted in the last 7 days, yellow = 8–30 days, red = over 30 days or never

#### Adding Managers and Staff

**Manager role:** Can manage stylists, branding, posting rules, and stock photos. Cannot access billing.

**Staff role:** Can see the Dashboard, Post Queue, Analytics, and Performance. Cannot access Team, Admin, Vendors, or Billing.

1. Go to **Team → Add Team Member**
2. Select **Manager** or **Staff**
3. Enter their name, email, and phone number
4. A temporary password is created — share it with them so they can log in at `app.mostlypostly.com`

**Good to know:**
- The number of portal seats depends on your plan: Starter includes only the owner; Growth adds 1 manager/staff seat; Pro is unlimited
- If you're on Starter or Growth and all seats are filled, the Manager/Staff options will be greyed out until you upgrade

#### Granting Portal Access to an Existing Stylist

A stylist who already posts via SMS can also be given a web portal login — without creating a separate account.

1. Find the stylist on the Team page
2. Click **Grant Portal Access** on their card
3. Enter the email and role (Manager or Staff)
4. Their stylist card will now show both a "Stylist" badge and a "Manager/Staff" badge

Their two identities (SMS poster and portal user) are linked. They'll use the portal login for approvals and settings, and continue texting for post submissions.

---

### Integrations

All external platform connections are managed from the **Integrations** page (`/manager/integrations`).

#### Facebook & Instagram

Connect your Facebook Page and Instagram Business Account to enable publishing. The OAuth flow authorizes MostlyPostly to post on your behalf. Once connected, your Page token is stored permanently — you won't need to reconnect unless you revoke access.

**Good to know:**
- Your Instagram account must be a Business or Creator account, connected to your Facebook Page
- If you disconnect and reconnect Facebook, the system will need to re-match historical posts for analytics purposes

#### Google Business Profile

Connect your Google Business Profile to have posts automatically published there as well. MostlyPostly publishes standard posts as "What's New" updates and promotion posts as "Offer" updates with expiration dates.

1. Click **Connect Google Business Profile**
2. Sign in with the Google account that manages your GMB listing
3. Select the correct location if you have multiple
4. Use the **Enable GMB Publishing** toggle to turn automatic GMB posting on or off

**Good to know:**
- Google tokens refresh automatically in the background — you won't need to reconnect regularly
- GMB posts are separate from Facebook/Instagram posts but use the same caption

#### Zenoti (Booking Software)

If your salon uses Zenoti, you can connect it so stylists can automatically generate availability posts from their real open appointment slots.

To connect:
1. Go to **Integrations → Zenoti**
2. Enter your Zenoti API key, Application ID, and Center ID (found in your Zenoti admin panel)
3. Once connected, map each stylist to their Zenoti employee record from the Team page

Only mapped stylists can generate automatic availability posts. Unmapped stylists can still text their own hours.

---

### Vendor Brand Integrations

Vendor Brand Integrations are a **Pro plan** feature that lets your salon automatically generate and post content from professional beauty brand campaigns (like Aveda, Redken, or Wella).

#### What Vendor Posts Are

Brands upload product campaigns to the MostlyPostly platform — including product photos, descriptions, messaging guidelines, and expiration dates. Once your salon is approved for a brand, MostlyPostly generates posts for those campaigns automatically, written in your salon's tone of voice.

Vendor posts are mixed into your regular posting schedule alongside stylist content. They count toward your monthly post limit.

#### Enabling a Vendor Feed

1. Go to **Admin → Vendors** (or the Vendors page in the sidebar)
2. Find the brand you want to enable
3. If you're not yet approved, click **Request Access** — the MostlyPostly team will review your request
4. Once approved, use the toggle to enable the brand feed

When enabled, the scheduler will automatically pull active campaigns from that brand and generate posts on your behalf.

#### Category Filters

Each vendor brand can have multiple campaign categories (e.g., Color, Highlights, Standard, Promotion). You can filter which categories your salon will post from — useful if you want to focus on specific product lines.

Leave all categories selected to receive all campaign content from that brand.

#### The Add to Queue Button

The **Add to Queue** button on a vendor campaign card lets you manually trigger a vendor post for that campaign right now — rather than waiting for the scheduler to pick it up automatically. The post goes through your normal approval process.

#### The Reset Button

The **Reset** button clears the current month's posting log for that campaign, allowing it to post again this month if it hit its frequency cap. Use this if a campaign wasn't posting and you want to give it a fresh start.

#### Affiliate Links

If you have an affiliate or referral link for a brand, you can add it to the vendor feed settings. When an affiliate URL is set, MostlyPostly includes that link in the captions it generates for that brand — giving you credit for any purchases your followers make.

Click counts on affiliate links are tracked in **Analytics → Link Performance**.

---

### Billing & Plans

Your billing settings live at **Billing** in the sidebar (visible to owners only).

#### Plans

| Plan | Monthly | Annual | Posts/Month | Stylists | Locations | Portal Seats |
|---|---|---|---|---|---|---|
| Starter | $49 | $44/mo | 60 | 4 | 1 | 1 (owner) |
| Growth | $149 | $134/mo | 150 | 12 | 2 | 2 |
| Pro | $249 | $224/mo | 400 | Unlimited | 5 | Unlimited |

Annual pricing is billed as a single payment. You save roughly 10% compared to monthly.

#### Free Trial

Every new salon gets a **7-day free trial** — no credit card needed to start. Trials are one per salon, for life. Upgrading your plan while on trial ends the trial and starts billing on the new plan immediately.

#### Managing Your Subscription

From the Billing page you can:
- Switch between monthly and annual billing
- Upgrade or downgrade your plan
- Access the **Stripe Customer Portal** to update your payment method or download invoices
- See your current month's post usage vs. your plan limit

#### Overages

If you exceed your monthly post limit, additional posts are charged at:
- Starter: $2.50 per 10 posts
- Growth: $2.00 per 10 posts
- Pro: $1.50 per 10 posts

#### Promo Codes

If you have a promo code, enter it on the checkout page — there's a promo code field built into the payment form.

---

### Multi-Location

If your brand has more than one salon, you can manage all locations from a single MostlyPostly account (Growth plan allows 2 locations; Pro allows 5).

#### Switching Between Locations

The active location is shown as a small initials badge in the sidebar (e.g., "VS" for Vanity Salon). Click it to go to the **Locations** page, where you can see all your locations and switch between them with one click.

When you switch locations, everything in the portal — the dashboard, post queue, analytics, team, admin settings — instantly scopes to that location. No re-logging in needed.

#### Adding a New Location

1. Go to **Locations → Add New Location**
2. Walk through the onboarding flow to set up the new salon (name, phone number, Facebook/Instagram connection, posting rules)
3. Once set up, the new location appears in your sidebar switcher

**Good to know:**
- Each location has its own stylists, posting schedule, stock photos, and analytics
- Managers are shared across the group — one login can manage all locations
- Each stylist has a unique phone number, so MostlyPostly always knows which location's number they texted

---

## For Platform Admins (Internal)

> These features are only accessible to MostlyPostly staff. They are not visible to salon customers.

### Platform Console Overview

The Platform Console is an internal-only admin tool accessible via a secret URL. It requires both a secret key in the URL and a PIN entered at login. It is never linked from any customer-facing page.

The Console has five main areas:
- **Salon Plan Overrides** — manually set any salon's plan and status
- **Vendor Campaign Manager** — manage brand campaigns and CSV uploads
- **Vendor Approvals** — approve or deny salon requests to access a brand feed
- **Salon Management** — view all salons, reset manager emails, delete salons
- **Stats Bar** — platform-wide post and salon counts

---

### Managing Brands and Campaigns

#### Viewing Campaigns

The Console shows all vendor campaigns grouped by brand. Each campaign displays:
- Campaign name and product name
- Active/expired status
- Frequency cap (posts per month)
- Whether client-side renewal is allowed

#### Uploading Campaigns via CSV

Brands can submit campaigns in bulk using a CSV file. Download the template from the Console to get the correct column structure, then upload the filled-in CSV.

**Required CSV columns:**
- `vendor_name` — the brand name (e.g., "Aveda")
- `campaign_name` — internal campaign identifier
- `product_name` — short product name shown on campaign cards
- `product_description` — 1–2 sentence description used in AI caption generation
- `photo_url` — a publicly accessible URL to the product image
- `expires_at` — date after which no new posts are generated (YYYY-MM-DD format)

**Optional CSV columns:**
- `hashtags` — comma-separated, # is optional
- `tone_direction` — messaging tone for the AI (e.g., "educational and premium")
- `cta_instructions` — what action to encourage (e.g., "Ask about our Aveda color menu")
- `service_pairing_notes` — services this product pairs well with
- `frequency_cap` — max posts per month from this campaign (defaults to 4)
- `category` — campaign category (e.g., Color, Highlights, Standard, Promotion)
- `product_hashtag` — a single product-specific hashtag (e.g., #FullSpectrum)

#### Brand Configuration

Each brand in the Console has its own configuration:
- **Brand hashtags** — up to 2 brand-level hashtags automatically appended to every post from that brand
- **Campaign categories** — the categories available for salons to filter by
- **Client renewal** — toggle whether salon admins can renew an expiring campaign themselves (extends it 30 days)

#### Deleting Campaigns

Campaigns can be deleted individually from the Console. Deletion is permanent. If a campaign is actively being used by salons, those salons' feeds will simply skip that campaign going forward.

---

### Vendor Approvals

When a salon requests access to a brand feed, the request appears in the Console's Vendor Approvals section with a status of "Pending."

**To approve:** Click **Approve**. The salon immediately gains access to enable that brand's feed.

**To deny:** Click **Deny**. The salon cannot access that brand's campaigns.

Salons can upload proof of their brand affiliation (e.g., a certificate, account link, or affiliate URL) when requesting access. Proof is visible in the Console.

---

### Salon Plan Overrides

Use the Plan Override table to instantly change any salon's plan and status — no Stripe interaction required. This is the primary tool for:

- Setting up demo accounts
- Testing Pro features (vendor feeds, multi-location, unlimited seats)
- Manually adjusting a salon's plan during a support issue

**To override a salon's plan:**
1. Find the salon in the Plan Overrides table (search or scroll)
2. Select the desired plan (trial, starter, growth, pro) and status (trialing, active, past_due, suspended)
3. Click **Set**

**Good to know:**
- Plan overrides bypass Stripe entirely — the salon won't be charged
- Use the test salon (Studio 500) for testing and reset it to `trial/trialing` when done
- Overrides persist until you change them again or a Stripe webhook event updates the salon's status

---

_Last updated: March 2026_
_Questions or corrections? Contact support@mostlypostly.com_
