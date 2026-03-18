// tests/composeFinalCaption.test.js
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
    expect(result).not.toContain("Book now");
  });

  it("IG with null booking_url does NOT include Book via link in bio", () => {
    const result = composeFinalCaption({
      ...base,
      platform: "instagram",
      bookingUrl: null,
    });
    expect(result).not.toContain("Book via link in bio.");
  });

  it("Facebook with booking_url includes the URL but not Book via link in bio", () => {
    const result = composeFinalCaption({
      ...base,
      platform: "facebook",
      bookingUrl: "https://example.com/book",
    });
    expect(result).not.toContain("Book via link in bio.");
    expect(result).toContain("https://example.com/book");
  });

  it("Facebook without booking_url has no booking section", () => {
    const result = composeFinalCaption({
      ...base,
      platform: "facebook",
      bookingUrl: "",
    });
    expect(result).not.toContain("Book");
  });
});
