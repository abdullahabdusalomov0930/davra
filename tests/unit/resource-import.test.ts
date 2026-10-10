import { describe, expect, it } from "vitest";

import { IMPORT_COLUMNS, missingImportColumns, parseImportRecord } from "@/lib/resource-import";

const topics = new Map([["dasturlash", "00000000-0000-4000-8000-000000000001"]]);

const row = {
  title: "CS50: kompyuter fanlariga kirish",
  url: "https://cs50.harvard.edu/x/?utm_source=telegram",
  topic: "dasturlash",
  type: "course",
  language: "en",
  price: "free",
  level: "beginner",
  summary: "Harvardning mashhur kursi: C, Python, SQL va veb dasturlash asoslari amaliy topshiriqlar bilan.",
  for_whom: "Dasturlashni noldan boshlayotganlar uchun",
  author_review: "",
};

describe("resource import rows", () => {
  it("knows which columns are required", () => {
    expect(missingImportColumns([...IMPORT_COLUMNS])).toEqual([]);
    expect(missingImportColumns(["title", "url"])).toEqual([
      "topic",
      "type",
      "language",
      "price",
      "level",
      "summary",
      "for_whom",
    ]);
  });

  it("validates a row like the form does and normalizes the link", () => {
    const parsed = parseImportRecord(row, topics);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.url).toBe("https://cs50.harvard.edu/x/");
      expect(parsed.data.topicId).toBe(topics.get("dasturlash"));
      expect(parsed.data.authorReview).toBeNull();
    }
  });

  it("reports every problem with its field and message key", () => {
    const parsed = parseImportRecord(
      { ...row, title: "PYTHON BEPUL KURSLARI HAMMASI", summary: "Qisqa", level: "expert" },
      topics,
    );
    expect(parsed).toEqual({
      ok: false,
      problems: expect.arrayContaining([
        { field: "title", key: "titleAllCaps" },
        { field: "summary", key: "summaryTooShort" },
        { field: "level", key: "required" },
      ]),
    });
  });

  it("names an unknown topic slug", () => {
    expect(parseImportRecord({ ...row, topic: "kimyo" }, topics)).toEqual({
      ok: false,
      problems: [{ field: "topic", key: "unknownTopic" }],
    });
  });
});
