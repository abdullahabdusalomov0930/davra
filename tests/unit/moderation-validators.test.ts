import { describe, expect, it } from "vitest";

import { blockedDomainSchema, removalRequestSchema, reportSchema, topicSchema } from "@/lib/validators";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);

const id = "6b1b5c2e-8a4f-4d6e-9c8b-2f6e1a0d3c7b";

describe("reportSchema", () => {
  it("needs a reason and turns an empty note into null", () => {
    expect(reportSchema.parse({ targetType: "comment", targetId: id, reason: "spam", details: " " })).toEqual({
      targetType: "comment",
      targetId: id,
      reason: "spam",
      details: null,
    });
    expect(messages(reportSchema.safeParse({ targetType: "resource", targetId: id, details: "" }))).toEqual([
      "reportReasonRequired",
    ]);
  });

  it("only accepts targets the report button offers", () => {
    expect(
      reportSchema.safeParse({ targetType: "broken_link", targetId: id, reason: "spam", details: "" }).success,
    ).toBe(false);
  });
});

describe("removalRequestSchema", () => {
  const valid = {
    resourceUrl: "https://davra.uz/resurs/python-asoslari",
    requesterName: "Nashriyot",
    requesterEmail: "legal@example.com",
    details: "Bu kitob nusxasi ruxsatsiz tarqatilmoqda.",
    confirm: true,
    website: "",
  } as const;

  it("accepts a complete request", () => {
    expect(removalRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("checks each field", () => {
    expect(messages(removalRequestSchema.safeParse({ ...valid, resourceUrl: "javascript:alert(1)" }))).toEqual([
      "removalUrlInvalid",
    ]);
    expect(messages(removalRequestSchema.safeParse({ ...valid, requesterEmail: "no-at-sign" }))).toEqual([
      "emailInvalid",
    ]);
    expect(messages(removalRequestSchema.safeParse({ ...valid, details: "Juda qisqa" }))).toEqual([
      "removalDetailsTooShort",
    ]);
    expect(messages(removalRequestSchema.safeParse({ ...valid, confirm: false }))).toEqual(["removalConfirmRequired"]);
  });

  it("rejects a filled honeypot", () => {
    expect(removalRequestSchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});

describe("topicSchema", () => {
  it("follows the database rules", () => {
    expect(
      topicSchema.safeParse({ slug: "ingliz-tili", nameUz: "Ingliz tili", descriptionUz: "", sortOrder: 30 }).success,
    ).toBe(true);
    expect(
      messages(topicSchema.safeParse({ slug: "Ingliz Tili", nameUz: "I", descriptionUz: "", sortOrder: 30 })),
    ).toEqual(["topicSlugFormat", "topicNameLength"]);
  });
});

describe("blockedDomainSchema", () => {
  it("reduces a pasted link to its domain", () => {
    expect(blockedDomainSchema.parse({ domain: "https://www.Spam.example.com/x?y=1", reason: "" })).toEqual({
      domain: "spam.example.com",
      reason: null,
    });
  });

  it("rejects things that are not domains", () => {
    expect(messages(blockedDomainSchema.safeParse({ domain: "localhost", reason: "" }))).toEqual(["domainFormat"]);
  });
});
