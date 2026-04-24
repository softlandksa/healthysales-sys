import { describe, it, expect } from "vitest";
import { formatSAR, formatNumber, formatPercent, cn } from "./utils";

describe("formatSAR", () => {
  it("formats positive amounts with SAR currency", () => {
    const result = formatSAR(1000);
    expect(result).toContain("1,000");
  });

  it("accepts string input", () => {
    const result = formatSAR("5000.50");
    expect(result).toContain("5,000");
  });
});

describe("formatNumber", () => {
  it("formats with comma separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("formatPercent", () => {
  it("appends % and respects decimal places", () => {
    expect(formatPercent(56.9)).toBe("56.9%");
    expect(formatPercent(100, 0)).toBe("100%");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "skipped", "included")).toBe("base included");
  });

  it("deduplicates tailwind classes via twMerge", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
  });
});
