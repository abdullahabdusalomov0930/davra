import { describe, expect, it } from "vitest";

import { isAllCaps, resourceSchema, withoutUrls } from "@/lib/validators";

const valid = {
  url: "https://www.coursera.org/learn/python?utm_source=telegram",
  title: "Python for Everybody",
  topicId: "6b1b5c2e-8a4f-4d6e-9c8b-2f6e1a0d3c7b",
  type: "course",
  language: "en",
  price: "freemium",
  level: "beginner",
  summary: "Python dasturlash asoslari: oʻzgaruvchilar, sikllar, fayllar va maʼlumotlar bazasi bilan ishlash.",
  forWhom: "Dasturlashni noldan boshlayotganlar",
  authorReview: "  ",
} as const;

const errorOf = (input: Record<string, unknown>) => {
  const result = resourceSchema.safeParse(input);
  return result.success ? undefined : result.error.issues.map((issue) => issue.message);
};

describe("resourceSchema", () => {
  it("normalizes the URL and stores an empty review as null", () => {
    const data = resourceSchema.parse(valid);
    expect(data.url).toBe("https://www.coursera.org/learn/python");
    expect(data.authorReview).toBeNull();
  });

  it("asks for a link when the field is empty, and for a valid one otherwise", () => {
    expect(errorOf({ ...valid, url: "  " })).toEqual(["required"]);
    expect(errorOf({ ...valid, url: "not a link" })).toEqual(["urlInvalid"]);
  });

  it("rejects ALL CAPS titles but allows acronyms", () => {
    expect(errorOf({ ...valid, title: "PYTHON ASOSLARI BEPUL KURS" })).toContain("titleAllCaps");
    expect(resourceSchema.safeParse({ ...valid, title: "IELTS Writing 7+" }).success).toBe(true);
    expect(resourceSchema.safeParse({ ...valid, title: "MIT OCW 6.006" }).success).toBe(true);
  });

  it("rejects emoji floods", () => {
    expect(errorOf({ ...valid, title: "🔥🔥🔥 Python" })).toContain("tooManyEmoji");
  });

  it("rejects a summary that is only a link", () => {
    expect(
      errorOf({ ...valid, summary: "https://www.coursera.org/learn/python-for-everybody-specialization" }),
    ).toContain("summaryOnlyUrl");
  });

  it("checks lengths and enums", () => {
    expect(errorOf({ ...valid, title: "Py" })).toContain("titleTooShort");
    expect(errorOf({ ...valid, forWhom: "Hamma" })).toContain("forWhomTooShort");
    expect(errorOf({ ...valid, type: "podcast" })).toContain("required");
    expect(errorOf({ ...valid, topicId: "x" })).toContain("topicRequired");
    expect(errorOf({ ...valid, url: "http://localhost" })).toContain("urlNotPublic");
  });
});

describe("helpers", () => {
  it("isAllCaps needs at least 10 letters", () => {
    expect(isAllCaps("SQL VA NOSQL ASOSLARI")).toBe(true);
    expect(isAllCaps("HARVARD CS50")).toBe(false);
  });

  it("withoutUrls removes links", () => {
    expect(withoutUrls("Kurs: https://example.com/a va www.example.org")).toBe("Kurs: va");
  });
});
