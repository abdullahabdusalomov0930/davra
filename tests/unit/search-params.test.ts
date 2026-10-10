import { describe, expect, it } from "vitest";

import { feedQuerySchema, parseSearchParams, sortFromParam, toSearchQueryString } from "@/lib/validators";

describe("parseSearchParams", () => {
  it("reads the Uzbek parameter names", () => {
    expect(
      parseSearchParams({
        q: " python ",
        mavzu: "dasturlash",
        tur: "video",
        til: "uz",
        narx: "free",
        daraja: "all",
        tartib: "baho",
      }),
    ).toEqual({
      text: "python",
      topic: "dasturlash",
      type: "video",
      language: "uz",
      price: "free",
      level: "all",
      sort: "top",
      cursor: undefined,
    });
  });

  it("drops invalid values instead of failing", () => {
    const parsed = parseSearchParams({
      q: "   ",
      mavzu: "../admin",
      tur: "podcast",
      tartib: "random",
      til: ["ru", "uz"],
    });
    expect(parsed).toMatchObject({
      text: undefined,
      topic: undefined,
      type: undefined,
      sort: undefined,
      language: "ru",
    });
  });

  it("caps the query length", () => {
    expect(parseSearchParams({ q: "a".repeat(500) }).text).toHaveLength(100);
  });
});

describe("toSearchQueryString", () => {
  it("builds a query string without empty values", () => {
    expect(toSearchQueryString({ text: "ingliz tili", topic: "ielts", sort: "top" })).toBe(
      "?q=ingliz+tili&mavzu=ielts&tartib=baho",
    );
    expect(toSearchQueryString({})).toBe("");
  });

  it("leaves out the default sort", () => {
    expect(toSearchQueryString({ text: "python", sort: "relevance" })).toBe("?q=python");
    expect(toSearchQueryString({ sort: "newest" })).toBe("");
    expect(toSearchQueryString({ text: "python", sort: "newest" })).toBe("?q=python&tartib=yangi");
  });

  it("round-trips through parseSearchParams", () => {
    const values = { text: "oʻzbek", type: "book", sort: "top" } as const;
    const params = Object.fromEntries(new URLSearchParams(toSearchQueryString(values)));
    expect(parseSearchParams(params)).toMatchObject(values);
  });
});

describe("sortFromParam and feedQuerySchema", () => {
  it("maps URL sort names", () => {
    expect(sortFromParam("mashhur")).toBe("popular");
    expect(sortFromParam("popular")).toBeUndefined();
  });

  it("validates load-more requests", () => {
    expect(feedQuerySchema.safeParse({ sort: "newest", topicId: "6b1b5c2e-8a4f-4d6e-9c8b-2f6e1a0d3c7b" }).success).toBe(
      true,
    );
    expect(feedQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ sort: "newest", text: "x".repeat(101) }).success).toBe(false);
  });
});
