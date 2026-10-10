import { describe, expect, it } from "vitest";

import messages from "../../messages/uz.json";

// The legal pages render these arrays with t.raw, so their shape is not checked by TypeScript.
describe("legal texts", () => {
  for (const document of ["rules", "terms", "privacy"] as const) {
    it(`${document}: every section has a title and text`, () => {
      const { title, intro, metaDescription, sections } = messages.Legal[document];
      expect(title).toBeTruthy();
      expect(intro).toBeTruthy();
      expect(metaDescription.length).toBeLessThanOrEqual(170);
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections as { title: string; paragraphs?: string[]; items?: string[] }[]) {
        expect(section.title).toBeTruthy();
        const texts = [...(section.paragraphs ?? []), ...(section.items ?? [])];
        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) expect(typeof text).toBe("string");
      }
    });
  }

  it("uses the Uzbek letters, not look-alike apostrophes", () => {
    expect(JSON.stringify(messages.Legal)).not.toMatch(/[oOgG]['‘’`]/);
  });
});
