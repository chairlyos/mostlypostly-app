---
phase: quick-260319-fii
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/vendorAdmin.js
autonomous: true
requirements: [FIX-AI-GENERATE-BUTTON]

must_haves:
  truths:
    - "AI Generate button on inline per-vendor campaign form calls aiGenerateDesc and populates description"
    - "AI Generate button on top-level campaign form calls aiGenerateDesc and populates description"
    - "AI Generate button on brand detail page calls aiGenerateDescBrand and populates description"
  artifacts:
    - path: "src/routes/vendorAdmin.js"
      provides: "Fixed onclick handlers and function signatures"
      contains: "aiGenerateDesc"
  key_links:
    - from: "onclick attribute (line ~424)"
      to: "aiGenerateDesc function (line ~1109)"
      via: "string ID args resolved inside function"
      pattern: "getElementById.*productNameInputId"
    - from: "onclick attribute (line ~992)"
      to: "aiGenerateDesc function (line ~1109)"
      via: "string ID args resolved inside function"
    - from: "onclick attribute (line ~1786)"
      to: "aiGenerateDescBrand function (line ~1843)"
      via: "string ID arg resolved inside function"
---

<objective>
Fix AI Generate button in Platform Console campaign forms. The button currently does nothing when clicked because `document.getElementById('...').value` is evaluated inline in onclick HTML attributes -- if the element lookup returns null, a TypeError is thrown before the function is ever called, and the browser swallows it silently.

Purpose: Restore AI description generation for vendor campaigns across all three form contexts.
Output: Working AI Generate buttons on inline, top-level, and brand detail campaign forms.
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
  <name>Task 1: Fix aiGenerateDesc to accept element IDs and resolve values internally</name>
  <files>src/routes/vendorAdmin.js</files>
  <action>
In `src/routes/vendorAdmin.js`, make these changes:

**A) Update `aiGenerateDesc` function definition (line ~1109):**

Change the function signature and add internal resolution:

```js
async function aiGenerateDesc(btn, vendorArg, productNameInputId, targetId) {
  // Resolve vendor: try as element ID first, fall back to literal string
  var vendorEl = document.getElementById(vendorArg);
  var vendorName = vendorEl ? vendorEl.value : vendorArg;
  // Resolve product name: always by element ID
  var prodEl = document.getElementById(productNameInputId);
  if (!prodEl) {
    alert('Could not find product name field (ID: ' + productNameInputId + ')');
    return;
  }
  var productName = prodEl.value;
  if (!vendorName || !productName) {
    alert('Enter vendor name and product name first.');
    return;
  }
  var target = document.getElementById(targetId);
  if (!target) {
    alert('Could not find description field (ID: ' + targetId + ')');
    return;
  }
  // ... rest of function unchanged from "if (target.value.trim())" onward
}
```

The key change: `vendorName` and `productName` parameters no longer arrive as pre-resolved `.value` strings. They arrive as element IDs (or a literal vendor name string for inline forms) and are resolved inside the function.

**B) Fix inline per-vendor form onclick (line ~424):**

Change from:
```
onclick="aiGenerateDesc(this, '${safe(vendor)}', document.getElementById('${inlineProdId}').value, '${inlineFormId}')"
```
To:
```
onclick="aiGenerateDesc(this, '${safe(vendor)}', '${inlineProdId}', '${inlineFormId}')"
```

The `'${safe(vendor)}'` stays as a literal string (not an element ID) -- the function's "try getElementById, fall back to literal" logic handles this.

**C) Fix top-level form onclick (line ~992):**

Change from:
```
onclick="aiGenerateDesc(this, document.getElementById('top-form-vendor-name').value, document.getElementById('top-form-product-name').value, 'top-form-desc')"
```
To:
```
onclick="aiGenerateDesc(this, 'top-form-vendor-name', 'top-form-product-name', 'top-form-desc')"
```

**D) Fix brand detail page `aiGenerateDescBrand` onclick (line ~1786):**

Change from:
```
onclick="aiGenerateDescBrand(this, '${safe(brand.vendor_name)}', document.getElementById('brand-form-product-name').value, 'brand-form-desc')"
```
To:
```
onclick="aiGenerateDescBrand(this, '${safe(brand.vendor_name)}', 'brand-form-product-name', 'brand-form-desc')"
```

**E) Update `aiGenerateDescBrand` function definition (line ~1843):**

Apply the same resolution pattern as `aiGenerateDesc`:

```js
async function aiGenerateDescBrand(btn, vendorArg, productNameInputId, targetId) {
  var vendorEl = document.getElementById(vendorArg);
  var vendorName = vendorEl ? vendorEl.value : vendorArg;
  var prodEl = document.getElementById(productNameInputId);
  if (!prodEl) {
    alert('Could not find product name field (ID: ' + productNameInputId + ')');
    return;
  }
  var productName = prodEl.value;
  if (!vendorName || !productName) {
    alert('Enter product name first.');
    return;
  }
  var target = document.getElementById(targetId);
  if (!target) {
    alert('Could not find description field (ID: ' + targetId + ')');
    return;
  }
  // ... rest of function unchanged from "if (target.value.trim())" onward
}
```

**DO NOT** modify the edit campaign page `aiGen` function (line ~1985) -- it was already fixed in commit 077230b.
  </action>
  <verify>
    <automated>cd /Users/troyhardister/chairlyos/mostlypostly/mostlypostly-app && grep -n "document.getElementById.*\.value" src/routes/vendorAdmin.js | grep "onclick" | wc -l | xargs test 0 -eq && echo "PASS: no inline .value in onclick" || echo "FAIL: still has inline .value in onclick"</automated>
  </verify>
  <done>
    - Zero onclick attributes contain `document.getElementById(...).value` inline (grep returns empty)
    - `aiGenerateDesc` function resolves element IDs internally with getElementById + explicit alert on missing elements
    - `aiGenerateDescBrand` function resolves element IDs internally with same pattern
    - Three onclick call sites pass string IDs, not inline .value lookups
    - Edit campaign `aiGen` function untouched
  </done>
</task>

</tasks>

<verification>
1. `grep -n "document.getElementById.*\.value" src/routes/vendorAdmin.js | grep "onclick"` returns no matches
2. `grep -n "aiGenerateDesc(this," src/routes/vendorAdmin.js` shows string arguments only (no inline .value)
3. Server starts without error
</verification>

<success_criteria>
- AI Generate button works on all three campaign form contexts (inline, top-level, brand detail)
- No silent failures -- missing elements produce visible alert messages
- Edit campaign page aiGen remains unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/260319-fii-fix-ai-generate-button-in-platform-conso/260319-fii-SUMMARY.md`
</output>
