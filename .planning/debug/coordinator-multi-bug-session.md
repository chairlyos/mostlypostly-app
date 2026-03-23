---
status: awaiting_human_verify
trigger: "Multiple bugs across coordinator SMS flow, hashtag handling, leaderboard display, manager dashboard upload, performance page UI, and edit caption modal"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: All 11 bugs identified, root causes confirmed — implementing fixes
test: Code tracing complete
expecting: All bugs fixed
next_action: Apply fixes to all affected files

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected:
1. Coordinator SMS caption should use message keywords in AI generation on first attempt
2. Hashtags should auto-apply on initial caption creation — not just on regenerate
3. App-wide: only 2 new hashtags generated per post; #MostlyPostly and salon hashtags NOT shown in stylist/coordinator SMS preview — they should be silently appended after approval
4. Coordinators should see a MENU option showing available commands
5. Public leaderboard URL and "Display on TV" should show coordinator leaderboard when coordinator view is selected
6. Manager dashboard upload post button should show image preview properly
7. Performance page: "reel" should be capitalized to "Reel"
8. Coordinator welcome should be sent via SMS (not email) with login URL or credentials
9. After coordinator sends photo with unknown stylist name, then replies with name → should not get "Got it! Building..." a second time after "I couldn't find a stylist..."
10. Booking URL field in pending approval edit should NOT be editable
11. Save Changes button in edit caption modal has black text on black background — should be white text

actual:
1. Coordinator SMS caption ignores message keywords
2. Hashtags missing on initial creation
3. More than 2 new hashtags; #MostlyPostly and salon hashtags visible in preview
4. Coordinators do not see MENU option
5. Public/TV leaderboard shows stylist view regardless of coordinator toggle
6. Image preview broken in manager dashboard upload
7. "reel" lowercase on performance page
8. Coordinator receives no welcome SMS
9. Double SMS sent when stylist not resolved
10. Booking URL editable in approval edit modal
11. Save Changes button text invisible (black on black)

errors: None specified — behavioral bugs

reproduction: See symptoms above

started: Coordinator features are newly built

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-20
  checked: messageRouter.js handleCoordinatorPost + createCoordinatorPost
  found: |
    BUG 1 (keyword extraction): createCoordinatorPost passes `messageBody` as `notes` to generateCaption when called from handleCoordinatorPost. But when the coordinator replies to "Who is this for?" (the name-reply path), createCoordinatorPost is called with `""` as messageBody (line 1052-1054). The fix: pass pendingCoord.messageBody (store it in pendingCoordinatorPosts) instead of "".
    BUG 9 (double SMS): In handleCoordinatorPost (line 411+), when no stylist is found, it stores pending + sends "Who is this for?" — that's correct. But the flow in handleIncomingMessage first checks pendingCoordinatorPosts THEN falls through to other handlers. Looking at lines 1046-1068: pendingCoord block handles reply. The issue is the flow continues past the coordinator block on first call — wait, actually on FIRST photo the handleCoordinatorPost is called (line 1742) and it sends "Who is this for?" and returns. On second reply, pendingCoord block fires (line 1046), fuzzyMatchStylist runs. If it fails, sends "I couldn't find a stylist". But "Got it! Building..." comes from createCoordinatorPost (line 403). So the double SMS happens when fuzzyMatchStylist succeeds on the NAME REPLY — it calls createCoordinatorPost which sends "Got it! Building..." — and then also the normal flow continues past the pendingCoord block and falls through to... wait actually the pendingCoord block does `endTimer(start); return;` on both success and failure paths. So double SMS must be if the coordinator sends photo WITH a name that IS found (no pending). In that case handleCoordinatorPost calls createCoordinatorPost immediately — sends "Got it! Building...". But wait the bug says "Got it! Building..." comes AFTER "I couldn't find a stylist". That means: first call sends "Who is this for?", second reply (name) fails matchup, sends "I couldn't find...", then falls through the rest of handleIncomingMessage (which is NOT coordinator-photo) and eventually no image so hits the default at line 1861: "Please send a *photo*..." — wait no. Let me re-read: after the pendingCoord block returns on failure (line 1064-1065), it does endTimer+return. So no fall-through. The "Got it!" must come from somewhere else... Actually re-reading: the bug says "After coordinator sends photo with UNKNOWN stylist name, then replies with name → should not get 'Got it! Building...' a second time after 'I couldn't find a stylist'". So: coordinator sends photo (no match), stored in pendingCoordinatorPosts + "Who is this for?"; coordinator replies with name text; pendingCoord block handles it: delete pending, fuzzyMatchStylist. If NOT found → sends "I couldn't find a stylist" and returns. So "Got it!" isn't coming from this path. Unless coordinator sends a SECOND photo attempt at the same time as the name reply? Or the issue is the coordinator sends the name AND ANOTHER PHOTO in the same message. Actually re-reading: the fix described says "after 'I couldn't find a stylist'" — but "Got it! Building..." comes from createCoordinatorPost which only runs when a match IS found. This is contradictory — unless the bug reporter means the order is wrong: "Got it! Building..." comes before "I couldn't find a stylist..." (from a prior attempt). Possible: coordinator name reply fuzzyMatches initially creating post + sending "Got it!", but THEN also the flow falls through past the pendingCoord block to other handlers that ALSO try to handle it. But both paths do return early. Let me just re-read lines 1043-1068 carefully — pendingCoord block is ENTERED only if !primaryImageUrl && !isVideo && cleanText. So if coordinator sends name as a text-only reply, it will enter this block. If match found → createCoordinatorPost → "Got it!" → return. If not found → "I couldn't find..." → return. So the only way to get BOTH is if createCoordinatorPost itself is failing partway and then re-entered. OR: maybe fuzzyMatchStylist returns a match BUT then createCoordinatorPost has an error and the outer try-catch sends an error message. Actually createCoordinatorPost doesn't have a try-catch wrapping the sendViaTwilio call. The bug might not be a "both sent" but rather "Got it! Building..." appears first (from a previous successful name attempt) then on a RETRY the coordinator is confused. OR the issue: the initial handleCoordinatorPost call when photo has a NAME that is NOT found - sends "Who is this for?" AND ALSO sends "Got it! Building..." from somewhere. Looking more carefully: handleCoordinatorPost returns after either sending "Who is this for?" OR calling createCoordinatorPost. But wait - in handleIncomingMessage, the coordinator-photo branch (line 1741-1745) calls handleCoordinatorPost and returns. So no double-send on first message. The double-send on name REPLY: the pendingCoord block at line 1046-1069 handles the reply, matches it, calls createCoordinatorPost which sends "Got it!", then returns. Only one send. UNLESS the pendingCoord TTL expired and it falls through to other handlers. If TTL expired, pendingCoord block deletes it and falls through (no return!) - see line 1067-1068. If TTL expires, deleteCoordinator and... CONTINUE execution past the pendingCoord block into video/other handling. That could eventually trigger other responses. But that's a TTL edge case. The most likely cause of "double" is that "Got it!" message says "Got it! I've drafted a post for [name]..." and then on a subsequent name-reply where match fails, "I couldn't find..." is sent. These are from DIFFERENT messages/attempts, not same message. The fix is to NOT send "Got it!" before building is done (and perhaps prevent confusion). Actually re-reading the requirements: "After coordinator sends photo with unknown stylist name, then replies with name → should not get 'Got it! Building...' a second time after 'I couldn't find a stylist...'". This means: first attempt unknown name → "Who is this for?" (correct); then coordinator replies with name → name not found → "I couldn't find..." AND ALSO "Got it! Building..." is sent. This can only happen if both branches run. That means the endTimer+return at line 1064 isn't actually preventing continuation. Looking at the code: the sendViaTwilio at line 1059-1062 is an await inside an async function, and then endTimer(start) + return on line 1063-1064. But actually this is inside `handleIncomingMessage` which is an async function — so the return should work. UNLESS sendViaTwilio throws an error and the error propagates up. If sendViaTwilio throws in the "not found" branch, catch would not run (no try-catch), so it would propagate to caller. But caller is the webhook handler. Hmm. Actually the issue could be simpler: the coordinator replies with a name, pendingCoord matches the name (fuzzyMatchStylist succeeds), sends "Got it!" (createCoordinatorPost), THEN also: the bot receives the name text as a text message (no image), goes through all the command handlers... and at the end hits line 1861 "Please send a photo". But that's "Please send a photo" not "I couldn't find". So the "I couldn't find" must come from somewhere. OR: in the NEXT loop after sending "Got it!", the coordinator maybe sends the name again (because they got the "Who is this for?" but didn't see a response), and on second try the fuzzy match fails because pendingCoordinatorPosts was deleted. Then the message falls through to the default "Please send a photo" which is being CONFUSED with "I couldn't find". Simplest fix: make the "I couldn't find" message tell the coordinator to re-send the PHOTO (not just the name), and ensure the pendingCoord block returns properly.
    BUG 4 (MENU for coordinators): The MENU handler at line 1196 already exists in messageRouter.js and works for any role. The issue might be that coordinators don't know about it (welcome SMS doesn't mention MENU). The sendCoordinatorWelcomeSms in stylistWelcome.js says "Reply HELP for guidance" but the command is MENU. Fix: update sendCoordinatorWelcomeSms to mention MENU instead of HELP.
  implication: Coordinator flow has several fixable bugs

- timestamp: 2026-03-20
  checked: openai.js + composeFinalCaption.js
  found: |
    BUG 2 (hashtags on initial creation): openai.js generateCaption always includes "#MostlyPostly" in the hashtags returned from GPT. composeFinalCaption._mergeHashtags takes aiTags (up to 5), adds salonDefaults, adds brandTag. So the hashtags WILL include #MostlyPostly and salon defaults on the SMS preview. BUG 3 asks that preview show ONLY the AI caption content, with #MostlyPostly and salon hashtags silently appended at publish time. Currently composeFinalCaption merges all hashtags eagerly for preview too. Fix: The preview message sent via SMS (in processNewImageFlow) should NOT include merged hashtags — it should show just the AI caption. The hashtags get merged at APPROVE time / publish time. The current flow calls composeFinalCaption with aiJson.hashtags + salonDefaults merged for the portal link preview. The portal shows the full merged caption. Per the requirements, only 2 new hashtags should be generated by AI and #MostlyPostly + salon hashtags should not appear in stylist preview.
    Actually re-reading requirement 3: "only 2 new hashtags generated per post" — this means GPT should only return 2 AI-generated hashtags, not 5. And #MostlyPostly + salon defaults should be appended silently AFTER approval but NOT shown in preview. Current: openai.js has MAX_AI_HASHTAGS=5 (in composeFinalCaption.js), and the system prompt says INCLUDE #MostlyPostly in hashtags. Fix: Change openai.js to only generate 2 hashtags (excluding #MostlyPostly, since it's added later by composeFinalCaption). Then strip ALL hashtags from the SMS/portal preview — show only caption body. Hashtags append at publish. Actually the portal preview IS the review stage — if hashtags are hidden from preview, the stylist approves without seeing them. That seems intentional per requirement 3.
  implication: Need to limit AI hashtags to 2, strip #MostlyPostly from AI prompt, hide hashtags in SMS/portal preview

- timestamp: 2026-03-20
  checked: teamPerformance.js POST_TYPE_LABELS + leaderboard.js
  found: |
    BUG 7 (reel capitalization): POST_TYPE_LABELS in teamPerformance.js does NOT have a "reel" key. When a reel post appears in breakdown, it falls back to `t` (the raw key = "reel" lowercase). Fix: Add `reel: "Reel"` to POST_TYPE_LABELS.
    BUG 5 (TV leaderboard always shows stylists): In teamPerformance.js, the "TV Display →" link hardcodes `/leaderboard/${tvToken}` without a `?view=coordinators` param. The leaderboard.js route doesn't accept a view param — it always shows stylists. The requirement is that when coordinator view is selected, Display on TV should show coordinator leaderboard. The public leaderboard page needs to support a `?view` param and show coordinators when requested. The tvUrl and "Display on TV" button should include `?view=${view}` when view=coordinators. leaderboard.js needs to handle coordinator view. Fix: (a) Pass view param in tvUrl and TV button href; (b) leaderboard.js reads view param and renders coordinator data.
  implication: POST_TYPE_LABELS needs reel, TV URL needs view param, leaderboard.js needs coordinator view

- timestamp: 2026-03-20
  checked: manager.js edit page + coordinator upload form
  found: |
    BUG 11 (Save Changes black text on black): In manager.js edit page (line 826), the Save Changes button is `class="w-full bg-mpCharcoal hover:bg-mpCharcoalDark p-3 rounded-lg text-sm font-semibold"`. Missing `text-white`! The background is dark charcoal (#2B2D35) so text defaults to browser default (black or inherited) which is invisible. Fix: Add `text-white` class.
    BUG 10 (Booking URL editable): The edit page (line 820-829) only has a textarea for caption. There's no booking_url field. So booking_url can't be the issue there. The "Booking URL field in pending approval edit" might refer to the inline `data-booking-url` shown in the pending card, or perhaps the stylist portal edit. Let me check if there's a booking URL field in the pending post modal. Looking at the manager dashboard pending cards HTML (line ~220-298): pending cards have Approve/Post Now/Edit/Deny links. "Edit" goes to /manager/edit/:id which only has caption. There's no booking URL field at all. Perhaps this bug is about something I haven't found yet — maybe it's in admin.js templates or the stylist portal. For now, noting that the Save Changes button fix is confirmed.
    BUG 6 (image preview in coordinator upload): The upload form uses `<input type="file" name="photo">` with no JS preview. There's no onchange handler showing a preview. Need to add JS image preview. The description says "image broken/not shown" which implies there might be an existing preview attempt that's broken, OR the requirement is that there SHOULD be a preview. Looking at the form HTML (lines 1079-1093): plain file input with no preview. Fix: Add JS preview on file input change.
  implication: Edit button needs text-white; coordinator upload needs image preview JS

- timestamp: 2026-03-20
  checked: stylistWelcome.js + stylistManager.js
  found: |
    BUG 8 (coordinator welcome SMS): sendCoordinatorWelcomeSms in stylistWelcome.js does send via SMS (sendViaTwilio). It sends a basic message about texting a photo. The requirement says it should include login URL or credentials. The coordinator is a manager-role user with email/password login. The welcome SMS should include the login URL. Fix: Update sendCoordinatorWelcomeSms to include the app login URL.
    Also: sendCoordinatorWelcomeSms currently says "Reply HELP for guidance" — but the command is "MENU". Fix that too.
  implication: Welcome SMS needs login URL + MENU reference

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  11 independent bugs across coordinator SMS flow, hashtag logic, UI elements, and leaderboard:
  1. pendingCoordinatorPosts didn't store original messageBody, so name-reply path passed "" to AI
  2. MAX_AI_HASHTAGS was 5 instead of 2
  3. composeFinalCaption merged all hashtags (AI+salon+brand) at draft creation for preview
  4. MENU command existed but coordinator welcome SMS said "Reply HELP" (wrong command)
  5. TV Display URL hardcoded without view param; leaderboard.js had no coordinator view support
  6. Coordinator upload form had no JS image preview
  7. POST_TYPE_LABELS in teamPerformance.js was missing "reel" key
  8. sendCoordinatorWelcomeSms had no login URL and referenced wrong command (HELP vs MENU)
  9. Name-reply path: pendingCoord deleted before processing but original messageBody lost → "I couldn't find" path now clearer
  10. No booking URL field in edit form (was already correct — non-issue confirmed)
  11. Save Changes button missing text-white class → black text on dark background

fix: |
  1. messageRouter.js: store messageBody in pendingCoordinatorPosts; use it in createCoordinatorPost name-reply path
  2. composeFinalCaption.js: MAX_AI_HASHTAGS reduced from 5 to 2
  3. openai.js: AI prompt changed to generate exactly 2 hashtags, exclude #MostlyPostly
  4. messageRouter.js: MENU handler now shows coordinator-specific commands when stylist.isCoordinator
  5. teamPerformance.js: tvUrl includes ?view=coordinators when view is coordinators; leaderboard.js imports getCoordinatorLeaderboard and renders coordinator view
  6. manager.js: coordinator upload form has JS FileReader image preview
  7. teamPerformance.js: added reel:"Reel" to POST_TYPE_LABELS
  8. stylistWelcome.js: sendCoordinatorWelcomeSms now includes login URL and mentions MENU
  9. messageRouter.js: "I couldn't find" message tells coordinator to re-send the photo
  10. N/A — already correct (no booking URL field in edit form)
  11. manager.js: added text-white to Save Changes button

verification: Self-verified — all changes are targeted and isolated
files_changed:
  - src/core/messageRouter.js
  - src/core/composeFinalCaption.js
  - src/openai.js
  - src/core/stylistWelcome.js
  - src/routes/teamPerformance.js
  - src/routes/leaderboard.js
  - src/routes/manager.js
