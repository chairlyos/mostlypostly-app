---
phase: quick-260320-ate
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/vendorAdmin.js
autonomous: true
requirements: [CSP-FIX]
must_haves:
  truths:
    - "Vendor admin page loads without CSP inline handler violations"
    - "Images with broken src gracefully hide instead of showing broken icon"
    - "Sync Now button still triggers vendor sync correctly"
    - "Missing credentials error shows as a gentle info message, not a red error"
  artifacts:
    - path: "src/routes/vendorAdmin.js"
      provides: "CSP-compliant vendor admin page"
      contains: "data-img-fallback"
  key_links:
    - from: "src/routes/vendorAdmin.js <script>"
      to: "img[data-img-fallback] elements"
      via: "error event delegation with capture"
      pattern: "addEventListener.*error.*data-img-fallback"
    - from: "src/routes/vendorAdmin.js <script>"
      to: "button[data-action=sync-vendor]"
      via: "click event delegation"
      pattern: "addEventListener.*click.*sync-vendor"
---

<objective>
Fix three CSP inline event handler violations in `src/routes/vendorAdmin.js` that block the vendor admin page from functioning correctly under Content Security Policy, and soften the missing-credentials error display for Aveda sync.

Purpose: The inline `onerror` and `onclick` attributes violate CSP policy, causing broken image fallbacks and a non-functional Sync Now button. The raw "Missing credentials" error is alarming when it is simply an unconfigured integration.
Output: A single patched file with all inline handlers replaced by event delegation and a gentler sync status message.
</objective>

<execution_context>
@/Users/troyhardister/.claude/get-shit-done/workflows/execute-plan.md
@/Users/troyhardister/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/routes/vendorAdmin.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace inline handlers with event delegation and soften credentials error</name>
  <files>src/routes/vendorAdmin.js</files>
  <action>
Three changes in `src/routes/vendorAdmin.js`:

**1. Replace both `onerror="this.style.display='none'"` with data attributes (lines ~345 and ~1782):**
- Change `onerror="this.style.display='none'"` to `data-img-fallback` on both `<img>` tags
- Add an error event listener with capture phase in the existing `<script>` block (before the closing `</script>`):
```js
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-img-fallback')) {
    e.target.style.display = 'none';
  }
}, true);
```

**2. Replace `onclick="syncVendor(...)"` with data-attribute delegation (line ~1854):**
- Change the button from:
  `<button type="button" onclick="syncVendor('${safe(brand.vendor_name)}')" ...>`
  to:
  `<button type="button" data-action="sync-vendor" data-vendor="${safe(brand.vendor_name)}" ...>`
- Add click delegation in the `<script>` block (near the existing `data-action="ai-gen-desc-brand"` delegation around line 2021):
```js
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="sync-vendor"]');
  if (btn) syncVendor(btn, btn.dataset.vendor);
});
```
- Update the `syncVendor` function signature from `syncVendor(name)` to `syncVendor(btn, name)` and remove `var btn = event.target;` (line ~2027). The rest of the function body stays the same.

**3. Soften the missing-credentials error display (line ~1853):**
- Replace the raw error div:
  ```
  ${brand.last_sync_error ? `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">${safe(brand.last_sync_error)}</div>` : ''}
  ```
  with a conditional that checks for credentials-related errors:
  ```
  ${brand.last_sync_error
    ? (brand.last_sync_error.includes('Missing credentials') || brand.last_sync_error.includes('env var'))
      ? `<div class="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">Automated sync not configured — set credentials env vars to enable.</div>`
      : `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">${safe(brand.last_sync_error)}</div>`
    : ''}
  ```
- Also update the Status label on line ~1850 — when the error is a missing-credentials error, show "Not configured" in gray instead of "Error" in red:
  ```
  ${brand.last_sync_error
    ? (brand.last_sync_error.includes('Missing credentials') || brand.last_sync_error.includes('env var'))
      ? `<span class="font-medium text-gray-500">Not configured</span>`
      : `<span class="font-medium text-red-600">Error</span>`
    : `<span class="font-medium ${brand.last_sync_at ? 'text-green-600' : 'text-gray-500'}">${brand.last_sync_at ? 'OK' : 'Not synced'}</span>`}
  ```
  </action>
  <verify>
    <automated>grep -n 'onerror\|onclick' src/routes/vendorAdmin.js | grep -v '// ' | head -10; echo "---"; grep -c 'data-img-fallback' src/routes/vendorAdmin.js; echo "---"; grep -c 'data-action="sync-vendor"' src/routes/vendorAdmin.js; echo "---"; grep -c 'Missing credentials' src/routes/vendorAdmin.js</automated>
  </verify>
  <done>Zero inline onerror/onclick attributes remain. Two data-img-fallback attributes present. One data-action="sync-vendor" button present. Missing credentials check present in template. Event delegation listeners in script block.</done>
</task>

</tasks>

<verification>
- `grep -n 'onerror=' src/routes/vendorAdmin.js` returns no results
- `grep -n 'onclick=' src/routes/vendorAdmin.js` returns no results
- `grep -c 'data-img-fallback' src/routes/vendorAdmin.js` returns 2
- `grep -c 'data-action="sync-vendor"' src/routes/vendorAdmin.js` returns 1
- `grep -c "addEventListener.*error" src/routes/vendorAdmin.js` returns 1
- `node -e "import('./src/routes/vendorAdmin.js')"` does not throw syntax errors
</verification>

<success_criteria>
- All three inline event handlers removed from vendorAdmin.js HTML output
- Image error fallback works via event delegation (capture phase)
- Sync Now button works via click event delegation
- Missing credentials shows as blue info box, not red error
- No JavaScript syntax errors in the file
</success_criteria>

<output>
After completion, create `.planning/quick/260320-ate-fix-csp-inline-event-handler-violation-o/260320-ate-SUMMARY.md`
</output>
