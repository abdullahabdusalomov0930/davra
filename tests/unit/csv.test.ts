import { describe, expect, it } from "vitest";

import { parseCsv, parseCsvRecords } from "@/lib/csv";

describe("parseCsv", () => {
  it("splits rows and fields", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quotes, escaped quotes, commas and line breaks inside quotes", () => {
    expect(parseCsv('title,summary\n"CS50, Harvard","Dedi: ""zoʻr""\nikkinchi qator"\n')).toEqual([
      ["title", "summary"],
      ["CS50, Harvard", 'Dedi: "zoʻr"\nikkinchi qator'],
    ]);
  });

  it("accepts CRLF, a byte-order mark, empty fields and a last line without a line break", () => {
    expect(parseCsv("﻿a,b\r\n1,\r\n,2")).toEqual([
      ["a", "b"],
      ["1", ""],
      ["", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a\n\n1\n\n")).toEqual([["a"], ["1"]]);
  });

  it("refuses an unclosed quote", () => {
    expect(() => parseCsv('a\n"open')).toThrow();
  });
});

describe("parseCsvRecords", () => {
  it("keys rows by the trimmed header and numbers them from the file's second line", () => {
    const { columns, records } = parseCsvRecords(" title , url\nCS50,https://cs50.harvard.edu/x/\nShort\n");
    expect(columns).toEqual(["title", "url"]);
    expect(records).toEqual([
      { row: 2, values: { title: "CS50", url: "https://cs50.harvard.edu/x/" } },
      { row: 3, values: { title: "Short", url: "" } },
    ]);
  });
});
