---
phase: quick
plan: 260322-tew
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/vendorAdmin.js
autonomous: true
requirements: [QUICK-TEW]
must_haves:
  truths:
    - "Operator can change a campaign's frequency_cap inline from the brand detail page"
    - "Changing the cap also clears the vendor_post_log for that campaign's current month so the scheduler re-evaluates"
    - "Cap value is validated (1-6 range, integer)"
  artifacts:
    - path: "src/routes/vendorAdmin.js"
      provides: "POST /campaign/:id/reset-cap endpoint + inline cap editor in brand detail campaigns table"
  key_links:
    - from: "brand detail campaign table row"
      to: "POST /internal/vendors/campaign/:id/reset-cap"
      via: "fetch() from inline form"
      pattern: "fetch.*reset-cap"
---

<objective>
Add an inline frequency cap editor to the brand detail page (`/internal/vendors/brands/:name`) campaigns table so the operator can change a campaign's `frequency_cap` and reset its `vendor_post_log` for the current month without navigating to the full edit page.

Purpose: Allows quick cap adjustments after deleting excess posts, so the scheduler re-triggers with the correct cap.
Output: Updated vendorAdmin.js with inline cap edit + reset endpoint.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/routes/vendorAdmin.js (lines 2122-2430 — brand detail page + existing renew endpoint pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add POST /campaign/:id/reset-cap endpoint and inline cap editor UI</name>
  <files>src/routes/vendorAdmin.js</files>
  <action>
Two changes to vendorAdmin.js:

1. **Add POST endpoint** — Insert after the existing `POST /campaign/renew` route (after line ~2623):

```js
// POST /campaign/:id/reset-cap — Update frequency cap and clear current month's post log
router.post("/campaign/:id/reset-cap", requireSecret, requirePin, (req, res) => {
  const { id } = req.params;
  const newCap = parseInt(req.body.frequency_cap, 10);
  if (!newCap || newCap < 1 || newCap > 6) {
    return res.status(400).json({ error: "frequency_cap must be 1-6" });
  }

  const campaign = db.prepare(`SELECT id, vendor_name FROM vendor_campaigns WHERE id = ?`).get(id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  db.prepare(`UPDATE vendor_campaigns SET frequency_cap = ? WHERE id = ?`).run(newCap, id);

  const thisMonth = new Date().toISOString().slice(0, 7);
  db.prepare(`DELETE FROM vendor_post_log WHERE campaign_id = ? AND posted_month = ?`).run(id, thisMonth);

  res.json({ ok: true, frequency_cap: newCap });
});
```

2. **Replace the static cap display in the brand detail campaigns table** (line ~2160). Replace:
```
<td class="px-4 py-3 text-xs text-gray-500">${safe(c.frequency_cap || 4)}/mo</td>
```
With an inline editable cell:
```html
<td class="px-4 py-3">
  <div class="flex items-center gap-1" data-cap-cell="${safe(c.id)}">
    <input type="number" min="1" max="6" value="${c.frequency_cap || 4}"
           class="w-12 border rounded px-1.5 py-0.5 text-xs text-center" data-cap-input="${safe(c.id)}" />
    <span class="text-xs text-gray-500">/mo</span>
    <button type="button" data-action="reset-cap" data-campaign-id="${safe(c.id)}"
            class="text-xs text-orange-500 hover:text-orange-700 font-medium ml-1 hidden" data-cap-btn="${safe(c.id)}">Reset</button>
  </div>
</td>
```

3. **Add client-side JS** in the brand detail page's existing `<script>` block (before the closing `</script>` tag around line ~2426). Add event delegation for the cap input and reset button:

```js
// Show Reset button when cap value changes from original
document.addEventListener('input', function(e) {
  var inp = e.target.closest('[data-cap-input]');
  if (!inp) return;
  var id = inp.getAttribute('data-cap-input');
  var btn = document.querySelector('[data-cap-btn="' + id + '"]');
  if (btn) btn.classList.toggle('hidden', false);
});

// Reset cap via fetch
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="reset-cap"]');
  if (!btn) return;
  var campaignId = btn.dataset.campaignId;
  var inp = document.querySelector('[data-cap-input="' + campaignId + '"]');
  var newCap = parseInt(inp.value, 10);
  if (!newCap || newCap < 1 || newCap > 6) { alert('Cap must be 1-6'); return; }
  if (!confirm('Set cap to ' + newCap + '/mo and clear this month\'s post log?')) return;
  btn.disabled = true;
  btn.textContent = 'Saving...';
  var secret = new URLSearchParams(window.location.search).get('secret') || '';
  fetch('/internal/vendors/campaign/' + campaignId + '/reset-cap?secret=' + encodeURIComponent(secret), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' },
    body: JSON.stringify({ frequency_cap: newCap })
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) { btn.textContent = 'Done'; btn.classList.add('text-green-600'); setTimeout(function() { btn.classList.add('hidden'); btn.textContent = 'Reset'; btn.classList.remove('text-green-600'); btn.disabled = false; }, 1500); }
      else { alert(d.error || 'Error'); btn.textContent = 'Reset'; btn.disabled = false; }
    })
    .catch(function() { alert('Network error'); btn.textContent = 'Reset'; btn.disabled = false; });
});
```

Important notes:
- Follow existing patterns: `requireSecret` + `requirePin` middleware on the POST route (same as renew endpoint)
- Use `qs(req)` pattern for secret propagation in any redirects (though this endpoint returns JSON)
- The vendor_post_log DELETE pattern is identical to the existing renew endpoint (line 2620)
- The input uses `type="number" min="1" max="6"` matching the existing campaign edit form constraints
- No express.json() middleware needed — the route file already handles JSON body parsing via Express built-in
  </action>
  <verify>
    <automated>cd /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app && grep -c "reset-cap" src/routes/vendorAdmin.js</automated>
  </verify>
  <done>
    - Brand detail page shows inline number input + "Reset" button per campaign row instead of static "N/mo" text
    - POST /internal/vendors/campaign/:id/reset-cap updates frequency_cap in vendor_campaigns and clears vendor_post_log for current month
    - Reset button appears on input change, shows confirm dialog, provides success/error feedback
    - Cap value validated to 1-6 range on both client and server
  </done>
</task>

</tasks>

<verification>
- `grep -n "reset-cap" src/routes/vendorAdmin.js` shows both the endpoint and UI references
- `grep -n "data-cap-input" src/routes/vendorAdmin.js` shows inline input in campaign table
- Server starts without errors: `node --check src/routes/vendorAdmin.js`
</verification>

<success_criteria>
- Operator can change frequency_cap for any campaign inline on the brand detail page
- Changing the cap clears vendor_post_log for the current month (same pattern as renew)
- No page reload needed — fetch-based with inline feedback
</success_criteria>

<output>
After completion, create `.planning/quick/260322-tew-add-vendor-campaign-frequency-cap-reset-/260322-tew-SUMMARY.md`
</output>
