# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:**
- Vitest v3.2.4
- Config: No dedicated `vitest.config.js` file; runs with default config
- Entry point: `tests/*.test.js`

**Assertion Library:**
- Vitest built-in expect API (`expect()`)

**Run Commands:**
```bash
npm test              # Run all tests once (vitest run)
npm run test:watch   # Watch mode (not configured but vitest supports via CLI flag)
npm run test:cov     # Coverage (not configured but vitest supports via CLI flag)
```

## Test File Organization

**Location:**
- Separate `tests/` directory at project root
- Not co-located with source files

**Naming:**
- Pattern: `[module].test.js`
- Examples: `composeFinalCaption.test.js`, `rcs.test.js`, `vendorHashtags.test.js`, `igCollaborator.test.js`

**Structure:**
```
tests/
├── composeFinalCaption.test.js     # 60 lines
├── igCollaborator.test.js           # 30 lines
├── rcs.test.js                      # 68 lines
└── vendorHashtags.test.js           # 68 lines
```

Total: 4 test suites covering core utility and messaging functions.

## Test Structure

**Suite Organization:**

From `tests/composeFinalCaption.test.js`:
```javascript
import { describe, it, expect } from "vitest";
import { composeFinalCaption } from "../src/core/composeFinalCaption.js";

const base = {
  caption: "Beautiful balayage",
  stylistName: "Jane",
  hashtags: [],
  salon: {},
};

describe("composeFinalCaption — Book CTA behavior", () => {
  it("IG with booking_url includes Book via link in bio", () => {
    const result = composeFinalCaption({
      ...base,
      platform: "instagram",
      bookingUrl: "https://example.com/book",
    });
    expect(result).toContain("Book via link in bio.");
  });

  it("IG without booking_url does NOT include Book via link in bio", () => {
    const result = composeFinalCaption({
      ...base,
      platform: "instagram",
      bookingUrl: "",
    });
    expect(result).not.toContain("Book via link in bio.");
  });
});
```

**Patterns:**

1. **Setup (base objects):** Shared test data defined before `describe` block, spread into each test case to avoid repetition
2. **Describe blocks:** Group related test cases by behavior aspect (e.g., "Book CTA behavior")
3. **Test cases:** One assertion or tight cluster of related assertions per `it()`
4. **Naming:** Test name describes the condition and expected outcome (not "test1", "test2")

## Mocking

**Framework:** `vi` module from Vitest

**Module-level mocking:**

From `tests/rcs.test.js`:
```javascript
vi.mock("twilio", () => {
  const create = vi.fn().mockResolvedValue({ sid: "SM123" });
  const MessagingResponse = vi.fn(() => ({
    toString: () => "<Response/>",
    message: vi.fn()
  }));
  const twilioConstructor = vi.fn(() => ({
    messages: { create }
  }));
  twilioConstructor.twiml = { MessagingResponse };
  twilioConstructor.validateRequest = vi.fn(() => true);
  return {
    default: twilioConstructor,
    twiml: { MessagingResponse },
    validateRequest: vi.fn(() => true),
  };
});
```

**Setup pattern:**
1. Mock modules BEFORE importing the module under test (top of file)
2. Set environment variables before import (e.g., `process.env.TWILIO_ACCOUNT_SID = "ACtest"`)
3. Use `beforeEach` to reset modules for state isolation:
   ```javascript
   beforeEach(async () => {
     vi.resetModules();
     process.env.RCS_ENABLED = "true";
     const twilio = await import("twilio");
     mockCreate = twilio.default().messages.create;
     const mod = await import("../src/routes/twilio.js");
     sendViaRcs = mod.sendViaRcs;
   });
   ```

**Function stubs:**

From `tests/igCollaborator.test.js`:
```javascript
const stylist = { ig_collab: 1, instagram_handle: "janedoe" };
expect(buildCollaborators(stylist)).toEqual(["janedoe"]);
```

Simple fixture objects passed to functions; no spy wrapping needed for pure functions.

**What to Mock:**
- External API clients (Twilio, OpenAI, etc.)
- Network calls
- Module imports that have side effects (e.g., database connection)
- Third-party SDK calls

**What NOT to Mock:**
- Pure utility functions (hashtag normalization, caption composition)
- Database schema/helpers used by the module under test (mock only the client if needed)
- Internal domain logic (import and test as-is)

## Fixtures and Factories

**Test Data:**

Fixtures are simple object literals defined at top of test suite:

```javascript
const base = {
  caption: "Beautiful balayage",
  stylistName: "Jane",
  hashtags: [],
  salon: {},
};

// In test, spread base + override:
const result = composeFinalCaption({
  ...base,
  platform: "instagram",
  bookingUrl: "https://example.com/book",
});
```

**Location:**
- Defined inline within test file (no separate fixtures directory)
- Kept minimal to show test intent clearly

**Naming:**
- `base` for common test object
- Specific objects named by context (e.g., `stylist`, `salon`)

## Coverage

**Requirements:** Not enforced (no coverage threshold configured)

**View Coverage:**
```bash
# Not configured, but Vitest supports:
vitest run --coverage
```

**Current state:** 4 test suites exist; no coverage measurement in CI.

## Test Types

**Unit Tests:**
- Scope: Pure functions with clear inputs/outputs
- Approach: Arrange-Act-Assert pattern
- Focus: Behavior contracts (e.g., "caption with platform=instagram removes URLs")
- Example: `composeFinalCaption.test.js` — tests caption formatting rules for different platforms

**Behavior-Driven Tests:**
- Scope: Multi-step flows with configuration
- Example: `rcs.test.js` — tests RCS enablement logic across environments
- Pattern: Setup environment → call function → verify call made with correct params

**Integration Tests:**
- Not present; would require live external API access
- Strategy: Mock all external dependencies instead

**E2E Tests:**
- Not used (no Cypress, Playwright, or Puppeteer test harness)

## Common Patterns

**Arrange-Act-Assert:**

```javascript
// Arrange
const stylist = { ig_collab: 1, instagram_handle: "@janedoe" };

// Act
const result = buildCollaborators(stylist);

// Assert
expect(result).toEqual(["janedoe"]);
expect(result[0]).toBe("janedoe");
```

**Parametric Testing:**
Not used (no `test.each()` or table-driven patterns). Each case is written explicitly.

**Async Testing:**

From `tests/rcs.test.js`:
```javascript
it("sends with persistentAction when RCS_ENABLED=true", async () => {
  await sendViaRcs("+15550001111", "Hello!", ["reply:Approve", "reply:Cancel"]);
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      persistentAction: ["reply:Approve", "reply:Cancel"],
      body: "Hello!",
      to: "+15550001111",
    })
  );
});
```

Pattern:
1. Test function is async
2. `await` the call under test
3. Verify mock was called with expected args (no separate assertion on return value)

**Error Handling Testing:**

Not present in current test suite. Pattern when added:
```javascript
it("falls back gracefully when API fails", async () => {
  mockCreate.mockRejectedValueOnce(new Error("API down"));
  await sendViaRcs("+15550001111", "Hi");
  // Assert function doesn't throw, returns gracefully
  expect(mockCreate).toHaveBeenCalled();
});
```

**Mocking Patterns for Fixtures:**

From `tests/vendorHashtags.test.js`:
```javascript
it("takes first 3 salon tags, 2 brand tags, 1 product tag, appends #MostlyPostly", () => {
  const result = buildVendorHashtagBlock({
    salonHashtags: ["#Hair", "#Style", "#Color", "#Extra"],
    brandHashtags: ["#AvedaColor", "#FullSpectrum"],
    productHashtag: "#Botanique",
  });
  expect(result).toBe("#Hair #Style #Color #AvedaColor #FullSpectrum #Botanique #MostlyPostly");
});
```

Pure function test: no mocking needed; just pass structured input and verify output.

## Test Execution Details

**Module Isolation:**
- `vi.resetModules()` called in `beforeEach` to ensure each test starts fresh
- Allows changing environment variables between tests without affecting other suites
- Critical for mocking different module versions across test cases

**Environment Variable Injection:**

```javascript
beforeEach(async () => {
  vi.resetModules();
  process.env.RCS_ENABLED = "true";  // Set for this test
  const mod = await import("../src/routes/twilio.js");
  sendViaRcs = mod.sendViaRcs;
});
```

Then in another test:
```javascript
delete process.env.RCS_ENABLED;  // Unset for fallback test
```

**Mock Assertion Matchers:**
- `.toHaveBeenCalled()` — mock was called at least once
- `.toHaveBeenCalledWith(...)` — mock called with specific args
- `expect.objectContaining({...})` — partial match (used when full args are verbose)
- `expect.not.objectContaining({...})` — verify option NOT present

## Gaps and Future Testing

**Not Yet Tested:**
- Database layer (`storage.js`, `db.js`) — no test suite exists
- Route handlers (Express middleware, request/response handling) — no integration tests
- External API publishers (Facebook, Instagram, Google Business) — mocked in real code but no test coverage
- Image generation (`buildAvailabilityImage.js`, `buildPromotionImage.js`) — no tests
- Scheduler logic (`scheduler.js`) — complex state machine, no tests
- Zenoti integration (`zenotiSync.js`, `zenoti.js`) — no tests

**Recommended First Test Coverage Priorities:**
1. Database access patterns (IDOR protection, multi-tenancy filters)
2. Scheduler state machine (priority ordering, window calculations, caps)
3. Publisher error handling (retry logic, fallback behavior)
4. Image generation edge cases (missing photos, layout breaks)

---

*Testing analysis: 2026-03-19*
