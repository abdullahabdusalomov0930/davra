import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps paths on this site, with query and hash", () => {
    expect(safeRedirectPath("/sozlamalar")).toBe("/sozlamalar");
    expect(safeRedirectPath("/qidiruv?q=python#natijalar")).toBe("/qidiruv?q=python#natijalar");
  });

  it.each([
    ["absolute URL", "https://evil.example/phish"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["tab trick", "/\t/evil.example"],
    ["newline", "/sozlamalar\n"],
    ["javascript: URL", "javascript:alert(1)"],
    ["relative path", "sozlamalar"],
    ["empty string", ""],
  ])("rejects %s", (_name, value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });

  it("rejects non-strings and very long values, using the fallback", () => {
    expect(safeRedirectPath(undefined, "/kirish")).toBe("/kirish");
    expect(safeRedirectPath(["/a"], "/kirish")).toBe("/kirish");
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBe("/");
  });

  it("normalizes dot segments without leaving the site", () => {
    expect(safeRedirectPath("/../../etc/passwd")).toBe("/etc/passwd");
  });
});
