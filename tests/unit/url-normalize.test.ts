import { describe, expect, it } from "vitest";

import { displayDomain, normalizeUrl, urlTwins } from "@/lib/url-normalize";

const url = (input: string) => {
  const result = normalizeUrl(input);
  return result.ok ? result.url : result.error;
};

describe("normalizeUrl", () => {
  it("lower-cases the host, drops the fragment and keeps the path as written", () => {
    expect(url("HTTPS://Www.KhanAcademy.org/Math/Algebra/#unit-1")).toBe("https://www.khanacademy.org/Math/Algebra/");
    expect(url("https://example.com/kurs")).toBe("https://example.com/kurs");
    expect(url("https://example.com")).toBe("https://example.com/");
  });

  it("accepts a bare domain", () => {
    expect(url("  khanacademy.org ")).toBe("https://khanacademy.org/");
  });

  it("removes tracking parameters and keeps the rest exactly as written", () => {
    expect(url("https://example.com/kurs?utm_source=tg&b=2&fbclid=x&a=1%202&UTM_Medium=y")).toBe(
      "https://example.com/kurs?b=2&a=1%202",
    );
    expect(url("https://example.com/?gclid=1")).toBe("https://example.com/");
  });

  it("gives YouTube links one canonical form", () => {
    expect(url("https://youtu.be/dQw4w9WgXcQ?si=abc&t=42")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42");
    expect(url("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=abc")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(url("https://youtube.com/@3blue1brown")).toBe("https://www.youtube.com/@3blue1brown");
  });

  it("keeps share-like parameters on other sites", () => {
    expect(url("https://example.com/page?si=7&feature=1")).toBe("https://example.com/page?si=7&feature=1");
  });

  it("converts international domains to punycode", () => {
    expect(url("https://тест.рф/kurs")).toBe("https://xn--e1aybc.xn--p1ai/kurs");
  });

  it.each([
    ["not a URL", "salom dunyo", "urlInvalid"],
    ["another scheme", "ftp://example.com/file", "urlInvalid"],
    ["javascript:", "javascript:alert(1)", "urlInvalid"],
    ["credentials", "https://user:pass@example.com", "urlCredentials"],
    ["an IP address", "http://192.168.1.10/admin", "urlNotPublic"],
    ["localhost", "http://localhost:3000", "urlNotPublic"],
    ["an intranet name", "https://wiki.internal/page", "urlNotPublic"],
    ["IPv6", "http://[::1]/", "urlNotPublic"],
    ["a non-standard port", "https://example.com:8080/kurs", "urlPort"],
  ])("rejects %s", (_name, input, error) => {
    expect(url(input)).toBe(error);
  });

  it("rejects URLs over 2048 characters", () => {
    expect(url(`https://example.com/${"a".repeat(2100)}`)).toBe("urlTooLong");
  });

  it("produces URLs the database accepts", () => {
    const dbPattern = /^https?:\/\/[a-z0-9.-]+(:[0-9]{1,5})?([/?#]|$)/;
    for (const input of ["Example.COM:443/x", "https://тест.рф", "youtu.be/abc"]) {
      expect(url(input)).toMatch(dbPattern);
    }
  });
});

describe("urlTwins", () => {
  it("lists the www, http and trailing-slash spellings of the same page, normalized URL first", () => {
    const twins = urlTwins("https://example.com/kurs?a=1");
    expect(twins[0]).toBe("https://example.com/kurs?a=1");
    expect(twins).toHaveLength(8);
    expect(twins).toEqual(
      expect.arrayContaining([
        "https://www.example.com/kurs?a=1",
        "https://example.com/kurs/?a=1",
        "http://www.example.com/kurs/?a=1",
      ]),
    );
  });

  it("does not invent a slash-less root or touch the port", () => {
    expect(urlTwins("https://www.example.com/")).toEqual([
      "https://www.example.com/",
      "https://example.com/",
      "http://www.example.com/",
      "http://example.com/",
    ]);
    expect(urlTwins("https://example.com:8080/a/")).toContain("http://www.example.com:8080/a");
  });
});

describe("displayDomain", () => {
  it("shows the host without www", () => {
    expect(displayDomain("https://www.coursera.org/learn/python")).toBe("coursera.org");
  });
});
