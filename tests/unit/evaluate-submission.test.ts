import { describe, expect, it, vi } from "vitest";

import { evaluateSubmission, similarity, type Submission } from "@/server/safety/evaluate";
import type { UrlInspection } from "@/server/safety/url-policy";
import { createWordFilter } from "@/server/safety/word-filter";

const filter = createWordFilter({ scam: ["pul ishlang"], gambling: ["kazino*"] });
const reached = (finalUrl: string | null = null): UrlInspection => ({
  decision: "allow",
  reasons: [],
  finalUrl,
  reputation: "unknown",
});

const resource = (overrides: Partial<Extract<Submission, { kind: "resource" }>> = {}): Submission => ({
  kind: "resource",
  url: "https://example.org/kurs",
  title: "Python asoslari",
  summary: "Oʻzgaruvchilar, sikllar va funksiyalarni misollar bilan tushuntiradigan bepul kurs.",
  forWhom: "Dasturlashni boshlayotganlar",
  authorReview: null,
  ...overrides,
});

describe("evaluateSubmission", () => {
  it("allows a trusted author's ordinary card and keeps where the link leads", async () => {
    const inspectUrl = vi.fn(async () => reached("https://example.org/kurs/"));
    expect(await evaluateSubmission(resource(), { trustLevel: 1, inspectUrl, filter })).toEqual({
      decision: "allow",
      reasons: [],
      fieldErrors: {},
      finalUrl: "https://example.org/kurs/",
      reputation: "unknown",
    });
    expect(inspectUrl).toHaveBeenCalledWith("https://example.org/kurs");
  });

  it("holds every card of a new member", async () => {
    expect(
      await evaluateSubmission(resource(), { trustLevel: 0, inspectUrl: async () => reached(), filter }),
    ).toMatchObject({
      decision: "needs_review",
      reasons: ["trust.new"],
      fieldErrors: {},
    });
  });

  it("refuses with a message on the right field, without visiting the link", async () => {
    const inspectUrl = vi.fn(async () => reached());
    const result = await evaluateSubmission(
      resource({ summary: "Uydan turib pul ishlang, hammasi juda oson va tez boʻladi." }),
      {
        trustLevel: 1,
        inspectUrl,
        filter,
      },
    );
    expect(result).toMatchObject({ decision: "reject", fieldErrors: { summary: "textNotAllowed" } });
    expect(inspectUrl).not.toHaveBeenCalled();
  });

  it("refuses bad links", async () => {
    expect(await evaluateSubmission(resource({ url: "https://bit.ly/abc" }), { trustLevel: 1, filter })).toMatchObject({
      decision: "reject",
      reasons: ["url.shortener"],
      fieldErrors: { url: "urlShortener" },
    });
    const flagged: UrlInspection = {
      decision: "reject",
      reasons: ["url.reputation"],
      message: "urlUnsafe",
      finalUrl: null,
      reputation: "flagged",
    };
    expect(
      await evaluateSubmission(resource(), { trustLevel: 3, inspectUrl: async () => flagged, filter }),
    ).toMatchObject({
      decision: "reject",
      fieldErrors: { url: "urlUnsafe" },
    });
  });

  it("refuses near-duplicates of the author's recent cards", async () => {
    const recentResources = [
      {
        title: "Python asoslari kursi",
        summary: "Oʻzgaruvchilar, sikllar va funksiyalarni misollar bilan tushuntiradigan bepul kurs.",
      },
    ];
    expect(await evaluateSubmission(resource(), { trustLevel: 1, recentResources, filter })).toMatchObject({
      decision: "reject",
      fieldErrors: { title: "textDuplicate" },
    });
    expect(
      await evaluateSubmission(resource(), {
        trustLevel: 1,
        recentResources: [
          { title: "Ingliz tili grammatikasi", summary: "Zamonlar va artikllar boʻyicha mashqlar toʻplami." },
        ],
        filter,
      }),
    ).toMatchObject({ decision: "allow" });
  });

  describe("comments", () => {
    const comment = (body: string): Submission => ({
      kind: "comment",
      resourceId: "00000000-0000-4000-8000-000000000001",
      body,
    });

    it("publishes a new member's comment without links", async () => {
      expect(
        await evaluateSubmission(comment("Rahmat, juda foydali boʻldi!"), { trustLevel: 0, filter }),
      ).toMatchObject({
        decision: "allow",
      });
    });

    it("holds a new member's comment with a link", async () => {
      const result = await evaluateSubmission(comment("Bu ham foydali: https://example.org/qoʻshimcha"), {
        trustLevel: 0,
        filter,
      });
      expect(result).toMatchObject({ decision: "needs_review", reasons: ["trust.new_link"] });
      expect(
        await evaluateSubmission(comment("Bu ham foydali: https://example.org/qoʻshimcha"), { trustLevel: 1, filter }),
      ).toMatchObject({
        decision: "allow",
      });
    });

    it("holds doubtful words and refuses serious ones", async () => {
      expect(
        await evaluateSubmission(comment("Kazino haqida emas, statistika haqida"), { trustLevel: 1, filter }),
      ).toMatchObject({
        decision: "needs_review",
      });
      expect(await evaluateSubmission(comment("Pul ishlang!"), { trustLevel: 1, filter })).toMatchObject({
        decision: "reject",
        fieldErrors: { body: "textNotAllowed" },
      });
    });
  });

  it("refuses what would wait for a moderator in reviews and profiles (no queue there)", async () => {
    const review: Submission = {
      kind: "rating",
      resourceId: "00000000-0000-4000-8000-000000000001",
      reviewText: "Kazino haqida yaxshi",
    };
    expect(await evaluateSubmission(review, { trustLevel: 1, filter })).toMatchObject({
      decision: "reject",
      fieldErrors: { reviewText: "textNotAllowed" },
    });
    const profile: Submission = {
      kind: "profile",
      displayName: "Ali",
      username: "kazino_uz",
      bio: "Qoʻngʻiroq qiling: +998 90 123 45 67",
      university: null,
      fieldOfStudy: null,
    };
    expect(await evaluateSubmission(profile, { trustLevel: 1, filter })).toMatchObject({
      decision: "reject",
      fieldErrors: { username: "textNotAllowed", bio: "textContact" },
    });
  });
});

describe("similarity", () => {
  it("compares the words of two texts", () => {
    expect(similarity("Python asoslari", "PYTHON — asoslari!")).toBe(1);
    expect(similarity("Python asoslari", "Ingliz tili")).toBe(0);
    expect(similarity("alfa beta gamma delta", "alfa beta gamma epsilon")).toBeCloseTo(0.6);
  });
});
