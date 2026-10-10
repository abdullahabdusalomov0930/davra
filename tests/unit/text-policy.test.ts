import { describe, expect, it } from "vitest";

import { cleanText } from "@/lib/clean-text";
import { checkText, countLinks, TEXT_RULES } from "@/server/safety/text-policy";
import { createWordFilter } from "@/server/safety/word-filter";

const char = (codePoint: number) => String.fromCodePoint(codePoint);

describe("cleanText", () => {
  it("removes invisible and control characters", () => {
    const text = `Bepul${char(0x200b)} kurs${char(0x202e)}${char(0x00ad)}${char(0x0007)}`;
    expect(cleanText(text)).toBe("Bepul kurs");
  });

  it("keeps the joiner inside emoji", () => {
    const technologist = `${char(0x1f469)}${char(0x200d)}${char(0x1f4bb)}`;
    expect(cleanText(`Dasturchi ${technologist}`)).toBe(`Dasturchi ${technologist}`);
  });

  it("turns stylised letters into plain ones, keeping maths", () => {
    expect(cleanText("𝐁𝐄𝐏𝐔𝐋 ｋｕｒｓ")).toBe("BEPUL kurs");
    expect(cleanText("x² + y² va H₂O, ½ qism")).toBe("x² + y² va H₂O, ½ qism");
  });

  it("collapses spaces and long repeats", () => {
    expect(cleanText("  Juda    zoooooʻr!!!!!!  ")).toBe("Juda zoooʻr!!!");
    expect(cleanText("Narxi 100000 soʻm")).toBe("Narxi 100000 soʻm");
  });

  it("keeps paragraphs only where allowed", () => {
    expect(cleanText("Birinchi\r\n\r\n\r\n\r\nIkkinchi\n", { multiline: true })).toBe("Birinchi\n\nIkkinchi");
    expect(cleanText("Birinchi\nIkkinchi")).toBe("Birinchi Ikkinchi");
  });

  it("is safe to apply twice", () => {
    const once = cleanText(`  𝐀  zoooooʻr\n\n\n\nmatn${char(0x200b)}  `, { multiline: true });
    expect(cleanText(once, { multiline: true })).toBe(once);
  });
});

describe("checkText", () => {
  const filter = createWordFilter({ gambling: ["kazino*"], scam: ["pul ishlang"] });
  const check = (value: string, kind: keyof typeof TEXT_RULES = "text", field = "summary") =>
    checkText(value, TEXT_RULES[kind], { field, filter });

  it("allows ordinary texts", () => {
    expect(check("Python asoslarini oʻrgatadigan bepul kurs. Batafsil: https://python.org/doc")).toEqual({
      decision: "allow",
      reasons: [],
    });
  });

  it("refuses words of the serious categories and holds the doubtful ones", () => {
    expect(check("Uydan turib pul ishlang!")).toMatchObject({
      decision: "reject",
      reasons: ["text.scam:summary"],
      message: "textNotAllowed",
    });
    expect(check("Kazino haqida statistik tahlil")).toMatchObject({
      decision: "needs_review",
      reasons: ["text.gambling:summary"],
    });
  });

  it("counts links", () => {
    expect(countLinks("https://a.uz va www.b.com hamda site.uz/kurs")).toBe(3);
    expect(countLinks("Node.js/Express, ASP.NET va Coursera.org")).toBe(0);
    expect(check("Sarlavha https://example.com", "line", "title")).toMatchObject({
      decision: "reject",
      message: "textTooManyLinks",
    });
    expect(check("Ikki havola: https://a.uz/1 va https://b.uz/2 bor")).toMatchObject({
      decision: "reject",
      message: "textTooManyLinks",
    });
    expect(check("https://example.com/kurs")).toMatchObject({ decision: "reject", message: "textOnlyLink" });
  });

  it("refuses phone numbers and invite links in resource texts", () => {
    for (const text of [
      "Batafsil maʼlumot uchun qoʻngʻiroq qiling: +998 90 123 45 67",
      "Batafsil maʼlumot uchun yozing: 90 123-45-67",
      "Guruhimizga qoʻshiling: t.me/+AbCdEf123",
      "WhatsApp guruhi: chat.whatsapp.com/AbCdEf",
    ]) {
      expect(check(text), text).toMatchObject({ decision: "reject", message: "textContact" });
    }
    expect(check("ISBN 978-5-04-123456-7, 2020–2024 yillar")).toEqual({ decision: "allow", reasons: [] });
  });

  it("holds contacts in comments for a moderator", () => {
    expect(check("Menga yozing: +998901234567", "comment", "body")).toMatchObject({
      decision: "needs_review",
      reasons: ["text.contact:body"],
    });
  });

  it("explains the most serious problem", () => {
    expect(check("Kazino: +998 90 123 45 67")).toMatchObject({
      decision: "reject",
      reasons: ["text.gambling:summary", "text.contact:summary"],
      message: "textContact",
    });
  });
});
