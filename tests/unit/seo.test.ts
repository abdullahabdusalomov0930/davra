import { describe, expect, it } from "vitest";

import { metaDescription } from "@/lib/seo";

describe("metaDescription", () => {
  it("keeps short text and tidies whitespace", () => {
    expect(metaDescription("  Python   asoslari\nva amaliyot ")).toBe("Python asoslari va amaliyot");
  });

  it("cuts long text at a word boundary and adds an ellipsis", () => {
    const text = "Oʻzgaruvchilar, sikllar, funksiyalar va fayllar bilan ishlashni oʻrgatadigan video darslar.";
    const short = metaDescription(text, 40);
    expect(short).toBe("Oʻzgaruvchilar, sikllar, funksiyalar va…");
    expect(short.length).toBeLessThanOrEqual(40);
  });

  it("cuts inside a very long word when there is no good boundary", () => {
    expect(metaDescription("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });
});
