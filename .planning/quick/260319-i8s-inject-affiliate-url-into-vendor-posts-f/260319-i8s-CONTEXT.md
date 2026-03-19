# Quick Task 260319-i8s: Inject Affiliate URL into Vendor Posts - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Task Boundary

Vendor posts currently do not deterministically inject the affiliate URL set on `salon_vendor_feeds.affiliate_url`. When a vendor post is scheduled and an affiliate URL is configured:
- **Facebook**: caption should read `{AI copy}\n\nShop today: {UTM-tracked short URL}\n\n{hashtag block}`
- **Instagram**: same caption but "Shop today: URL" line is stripped; instead append "Shop, link in bio."

This affects vendor posts ONLY (`vendor_campaign_id IS NOT NULL`). All other post types are untouched.

</domain>

<decisions>
## Implementation Decisions

### FB CTA placement
- "Shop today: {tracked URL}" goes **after the AI caption body, before the hashtag block**
- Format: `{caption}\n\nShop today: {shortUrl}\n\n{hashtagBlock}`

### IG CTA text
- Replace any booking/shop URL line with: **"Shop, link in bio."**
- Strip all URLs from IG caption (consistent with existing IG rules)

### AI prompt
- **Remove** the `safeAffiliateUrl` injection from `generateVendorCaption()` AI prompt
- System now controls affiliate URL placement deterministically — no risk of AI duplicating or mangling the URL
- AI writes clean product copy only

### No affiliate URL set
- If `salon_vendor_feeds.affiliate_url` is NULL/empty for this vendor, vendor posts behave exactly as before (no shop CTA appended, no special IG treatment)

### Claude's Discretion
- The existing "replace affiliateUrl in caption body" block in `processCampaign()` (which only fired if AI happened to include the raw URL) should be removed — it's superseded by the deterministic approach
- At publish time in `scheduler.js`, vendor post IG caption is built on-the-fly from `final_caption` by stripping "Shop today: URL" and appending "Shop, link in bio."
- No DB migration needed — `final_caption` stores the FB version; IG version derived at publish time

</decisions>

<specifics>
## Specific Ideas

**Files affected:**
- `src/core/vendorScheduler.js` — remove affiliate URL from AI prompt; build deterministic shop CTA in `processCampaign()`
- `src/scheduler.js` — at publish time, detect vendor posts and build IG-specific caption on-the-fly

**vendorScheduler.js changes:**
1. In `generateVendorCaption()`: remove the `safeAffiliateUrl` param from system/user prompt (and the validation block is no longer needed for prompt injection)
2. In `processCampaign()`: remove old "replace affiliateUrl in caption" block; add new block after hashtag assembly:
   ```
   if (affiliateUrl) {
     token = buildTrackingToken(...)
     shortUrl = buildShortUrl(token)
     finalCaption = caption + "\n\nShop today: " + shortUrl + "\n\n" + lockedBlock
   } else {
     finalCaption = caption + (lockedBlock ? "\n\n" + lockedBlock : "")
   }
   ```

**scheduler.js changes (at publish time):**
```
const isVendorPost = !!post.vendor_campaign_id;
let fbCaption = post.final_caption;
let igCaption = post.final_caption;

if (isVendorPost) {
  // IG: strip "Shop today: URL" line, strip any remaining URLs, append "Shop, link in bio."
  igCaption = post.final_caption
    .replace(/\n\nShop today: https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
  if (!igCaption.includes("Shop, link in bio.")) {
    igCaption += "\n\nShop, link in bio.";
  }
}
```
Then pass `fbCaption` to FB publish calls and `igCaption` to IG publish calls.

</specifics>

<canonical_refs>
## Canonical References

- `src/core/vendorScheduler.js` — `generateVendorCaption()` (line ~65), `processCampaign()` (line ~229)
- `src/scheduler.js` — publish block (line ~460), `enqueuePost()` (line ~579)
- `src/core/trackingUrl.js` — `buildTrackingToken()`, `buildShortUrl()`
- CLAUDE.md — "Vendor affiliate URL" convention, "UTM tracking tokens" convention

</canonical_refs>
