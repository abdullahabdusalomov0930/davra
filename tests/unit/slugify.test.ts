import { describe, expect, it } from "vitest";

import { isValidSlug, slugify, withSuffix } from "@/lib/slugify";

describe("slugify", () => {
  it("drops every kind of Uzbek apostrophe (oʻ → o, gʻ → g)", () => {
    expect(slugify("Oʻzbek tili: grammatika")).toBe("ozbek-tili-grammatika");
    expect(slugify("O'zbek tilida gʻoyalar")).toBe("ozbek-tilida-goyalar");
    expect(slugify("Maʼlumotlar tahlili")).toBe("malumotlar-tahlili");
    expect(slugify("O‘quv qo’llanma")).toBe("oquv-qollanma");
  });

  it("keeps sh, ch and ng as written", () => {
    expect(slugify("Shaxsiy moliya va choʻntak xarajatlari")).toBe("shaxsiy-moliya-va-chontak-xarajatlari");
    expect(slugify("Ingliz tili")).toBe("ingliz-tili");
  });

  it("transliterates Uzbek Cyrillic", () => {
    expect(slugify("Шахсий молия")).toBe("shaxsiy-moliya");
    expect(slugify("Ўзбек тили ва ғоялар")).toBe("ozbek-tili-va-goyalar");
    expect(slugify("Қисқа ҳикоялар")).toBe("qisqa-hikoyalar");
  });

  it("removes accents, symbols and emoji", () => {
    expect(slugify("Café & C++ 🚀 — 2026!")).toBe("cafe-c-2026");
  });

  it("cuts long titles at a word boundary", () => {
    const slug = slugify("Juda uzun sarlavha ".repeat(10));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("🚀🔥")).toBe("resurs");
  });
});

describe("withSuffix", () => {
  it("adds a 4-character suffix and stays within the limit", () => {
    expect(withSuffix("python-asoslari")).toMatch(/^python-asoslari-[a-z0-9]{4}$/);
    expect(withSuffix("a".repeat(80)).length).toBeLessThanOrEqual(80);
  });

  it("never leaves a double dash where the slug was cut", () => {
    expect(withSuffix(`${"a".repeat(74)}-${"b".repeat(5)}`)).toMatch(/^a{74}-[a-z0-9]{4}$/);
  });
});

describe("isValidSlug", () => {
  it("accepts what slugify produces and rejects everything else", () => {
    expect(isValidSlug(slugify("Oʻzbek tili: grammatika"))).toBe(true);
    expect(isValidSlug(withSuffix("a".repeat(80)))).toBe(true);
    expect(isValidSlug("Python")).toBe(false);
    expect(isValidSlug("python--asoslari")).toBe(false);
    expect(isValidSlug("-python")).toBe(false);
    expect(isValidSlug("a".repeat(101))).toBe(false);
  });
});
