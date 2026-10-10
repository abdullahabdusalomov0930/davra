import { describe, expect, it } from "vitest";

import { createWordFilter, wordFilter, wordsOf } from "@/server/safety/word-filter";

const char = (codePoint: number) => String.fromCodePoint(codePoint);
const CYRILLIC_A = char(0x0430);
const CYRILLIC_O = char(0x043e);
const GREEK_O = char(0x03bf);
const ZERO_WIDTH = char(0x200b);

describe("word filter", () => {
  const filter = createWordFilter({
    gambling: ["kazino*"],
    scam: ["tez boyib keting", "pul ishla*"],
    profanity: ["blyat", "ass"],
  });

  it("finds whole words, stems and phrases", () => {
    expect(filter.find("Eng yaxshi kazino shu yerda")).toEqual(["gambling"]);
    expect(filter.find("Kazinoda yutish sirlari")).toEqual(["gambling"]);
    expect(filter.find("Bu kurs bilan tez boyib keting!")).toEqual(["scam"]);
    expect(filter.find("Internetda pul ishlash yoʻllari")).toEqual(["scam"]);
    expect(filter.find("Python asoslari: oʻzgaruvchilar va sikllar")).toEqual([]);
  });

  it("does not match inside other words", () => {
    expect(filter.find("class, pass, assistant")).toEqual([]);
    expect(filter.find("as soon as possible")).toEqual([]);
    expect(filter.find("tez boyib")).toEqual([]);
  });

  it("sees through simple disguises", () => {
    expect(filter.find("KAZINO")).toEqual(["gambling"]);
    expect(filter.find("kaaaaazino")).toEqual(["gambling"]);
    expect(filter.find("k.a.z.i.n.o")).toEqual(["gambling"]);
    expect(filter.find("k a z i n o")).toEqual(["gambling"]);
    expect(filter.find("ka-zi-no")).toEqual(["gambling"]);
    expect(filter.find("k4z1n0")).toEqual(["gambling"]);
    expect(filter.find("kàzìnò")).toEqual(["gambling"]);
    expect(filter.find("𝐤𝐚𝐳𝐢𝐧𝐨")).toEqual(["gambling"]);
    expect(filter.find(`k${CYRILLIC_A}zino`)).toEqual(["gambling"]);
    expect(filter.find(`kazin${GREEK_O}`)).toEqual(["gambling"]);
    expect(filter.find(`ka${ZERO_WIDTH}zino`)).toEqual(["gambling"]);
    expect(filter.find("bl1at")).toEqual([]);
    expect(filter.find("b1yat")).toEqual(["profanity"]);
    expect(filter.find("@$$")).toEqual(["profanity"]);
  });

  it("compares Cyrillic and Latin spellings", () => {
    expect(filter.find("Онлайн казино")).toEqual(["gambling"]);
    expect(filter.find("тез бойиб кетинг")).toEqual(["scam"]);
    expect(filter.find("блят")).toEqual(["profanity"]);
    // A Cyrillic word with one Latin letter is read as Cyrillic.
    expect(filter.find(`к${"a"}зино`)).toEqual(["gambling"]);
    expect(filter.find(`${CYRILLIC_O}nline kazino`)).toEqual(["gambling"]);
  });

  it("leaves numbers alone", () => {
    const digits = createWordFilter({ scam: ["soot"] });
    expect(digits.find("5007 ta foydalanuvchi")).toEqual([]);
    expect(digits.find("s00t")).toEqual(["scam"]);
  });
});

describe("starter lists", () => {
  it.each([
    ["Eng yaxshi kazino bonuslari", ["gambling"]],
    ["Uydan turib pul ishlang, kuniga 100$", ["scam"]],
    ["Sportga stavka qiling va yuting", ["gambling"]],
    ["Ставки на спорт онлайн", ["gambling"]],
    ["Get rich quick with this course", ["scam"]],
    ["Быстрый заработок без вложений", ["scam"]],
  ])("flags %j", (text, categories) => {
    expect(wordFilter.find(text)).toEqual(categories);
  });

  it.each([
    "Markaziy bankning asosiy foiz stavkasi qanday belgilanadi",
    "Tez pul oʻtkazmalari va bank kartalari xavfsizligi",
    "Python asoslari: sikllar, funksiyalar va sinflar",
    "Moliyaviy savodxonlik: oson pul tejash usullari",
    "Щит и меч: тарих дарслари",
    "Kassa apparatlari bilan ishlash",
    "Node.js va Express bilan REST API",
    "Planning poker va agile jamoalar",
    "Xuyi yumshoq, oʻquvchilar bilan sabrli oʻqituvchi",
    "Jalb qilingan investitsiyalar statistikasi",
    "Jiddiy loyihalar uchun Git",
    "Pedikyur va manikyur kurslari",
    "Kant falsafasi boʻyicha maʼruzalar",
  ])("lets %j through", (text) => {
    expect(wordFilter.find(text)).toEqual([]);
  });
});

describe("wordsOf", () => {
  it("returns the words as the filter compares them", () => {
    expect(wordsOf("Bepul KURS — Pythón!")).toEqual(["bepul", "kurs", "python"]);
    expect(wordsOf("Oʻzbek tili 2024")).toEqual(["ozbek", "tili"]);
  });
});
