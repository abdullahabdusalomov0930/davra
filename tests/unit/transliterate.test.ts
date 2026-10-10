import { describe, expect, it } from "vitest";

import { hasCyrillic, toLatin } from "@/lib/transliterate";

describe("toLatin", () => {
  it("writes Uzbek Cyrillic in Uzbek Latin", () => {
    expect(toLatin("Шахсий молия")).toBe("shaxsiy moliya");
    expect(toLatin("Ўзбек тили")).toBe("oʻzbek tili");
    expect(toLatin("Ғалаба, Қарши, Ҳаёт")).toBe("gʻalaba, qarshi, hayot");
  });

  it("handles Russian letters and leaves Latin text alone", () => {
    expect(toLatin("Личные финансы")).toBe("lichnie finansi");
    expect(toLatin("Python 3")).toBe("python 3");
  });
});

describe("hasCyrillic", () => {
  it("detects Cyrillic letters", () => {
    expect(hasCyrillic("молия")).toBe(true);
    expect(hasCyrillic("Python asoslari")).toBe(false);
  });
});
