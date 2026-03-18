// tests/vendorHashtags.test.js
import { describe, it, expect } from "vitest";
import { buildVendorHashtagBlock, normalizeHashtag } from "../src/core/vendorScheduler.js";

describe("normalizeHashtag", () => {
  it("adds # prefix if missing", () => {
    expect(normalizeHashtag("aveda")).toBe("#aveda");
  });
  it("keeps existing # prefix", () => {
    expect(normalizeHashtag("#aveda")).toBe("#aveda");
  });
  it("returns empty string for falsy input", () => {
    expect(normalizeHashtag("")).toBe("");
    expect(normalizeHashtag(null)).toBe("");
  });
  it("returns empty string for whitespace-only input", () => {
    expect(normalizeHashtag("   ")).toBe("");
  });
  it("returns empty string for multi-word input (invalid hashtag)", () => {
    expect(normalizeHashtag("aveda color")).toBe("");
    expect(normalizeHashtag("#aveda color")).toBe("");
  });
});

describe("buildVendorHashtagBlock", () => {
  it("takes first 3 salon tags, 2 brand tags, 1 product tag, appends #MostlyPostly", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair", "#Style", "#Color", "#Extra"],
      brandHashtags: ["#AvedaColor", "#FullSpectrum"],
      productHashtag: "#Botanique",
    });
    expect(result).toBe("#Hair #Style #Color #AvedaColor #FullSpectrum #Botanique #MostlyPostly");
  });
  it("caps brand hashtags at 2", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair"],
      brandHashtags: ["#A", "#B", "#C"],
      productHashtag: null,
    });
    expect(result).toBe("#Hair #A #B #MostlyPostly");
  });
  it("skips product hashtag if null", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#Hair"],
      brandHashtags: [],
      productHashtag: null,
    });
    expect(result).toBe("#Hair #MostlyPostly");
  });
  it("handles empty salon hashtags", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: [],
      brandHashtags: ["#AvedaColor"],
      productHashtag: null,
    });
    expect(result).toBe("#AvedaColor #MostlyPostly");
  });
  it("deduplicates #MostlyPostly when already in salon hashtags", () => {
    const result = buildVendorHashtagBlock({
      salonHashtags: ["#MostlyPostly", "#Hair"],
      brandHashtags: [],
      productHashtag: null,
    });
    const count = (result.match(/#MostlyPostly/g) || []).length;
    expect(count).toBe(1);
  });
});
