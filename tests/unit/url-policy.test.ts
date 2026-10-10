import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UrlReputationProvider } from "@/server/safety/reputation";
import { safeFetch, SafeFetchError } from "@/server/safety/safe-fetch";
import { checkUrl, inspectUrl, isLookalikeHost } from "@/server/safety/url-policy";

vi.mock("@/server/safety/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/safety/safe-fetch")>()),
  safeFetch: vi.fn(),
}));

const fetched = vi.mocked(safeFetch);
const char = (codePoint: number) => String.fromCodePoint(codePoint);

describe("checkUrl", () => {
  it("allows ordinary links and removes tracking parameters", () => {
    expect(checkUrl("https://Example.org/kurs?utm_source=tg&fbclid=1&id=5#bolim")).toEqual({
      decision: "allow",
      url: "https://example.org/kurs?id=5",
      host: "example.org",
      reasons: [],
    });
  });

  it.each([
    ["javascript:alert(1)", "urlInvalid"],
    ["data:text/html,hi", "urlInvalid"],
    ["ftp://example.org/file", "urlInvalid"],
    ["http://127.0.0.1/admin", "urlNotPublic"],
    ["http://localhost/", "urlNotPublic"],
    ["http://192.168.1.1/", "urlNotPublic"],
    ["https://example.org:8443/", "urlPort"],
    ["https://bit.ly/abc", "urlShortener"],
    ["https://www.cutt.ly/abc", "urlShortener"],
    ["https://pornhub.com/", "urlBlocked"],
    ["https://ru.1xbet.com/", "urlBlocked"],
  ])("refuses %s", (url, message) => {
    expect(checkUrl(url)).toMatchObject({ decision: "reject", message });
  });

  it("refuses lookalike domains", () => {
    expect(checkUrl(`https://p${char(0x0430)}ypal.com/login`)).toMatchObject({
      decision: "reject",
      message: "urlLookalike",
    });
  });

  it("holds links to file hosting sites for review", () => {
    const check = checkUrl("https://disk.yandex.ru/d/abc");
    expect(check.decision === "reject" ? null : check.reasons).toEqual(["url.category:file_hosting"]);
  });
});

describe("isLookalikeHost", () => {
  it.each([
    [`p${char(0x0430)}ypal.com`, true],
    // "аррӏе" entirely in Cyrillic letters that look Latin.
    [[0x0430, 0x0440, 0x0440, 0x04cf, 0x0435].map(char).join("") + ".com", true],
    [`g${char(0x03bf)}${char(0x03bf)}gle.com`, true],
    ["яндекс.рф", false],
    ["oʻzbek.uz", false],
    ["example.org", false],
  ])("%s → %s", (host, expected) => {
    expect(isLookalikeHost(new URL(`https://${host}`).hostname)).toBe(expected);
  });
});

describe("inspectUrl", () => {
  const reputation = (verdicts: Record<string, "safe" | "flagged">): UrlReputationProvider => ({
    name: "test",
    check: async (urls) => new Map(urls.map((url) => [url, verdicts[url] ?? "unknown"])),
  });
  const inspect = (url: string, verdicts: Record<string, "safe" | "flagged"> = {}) =>
    inspectUrl(url, { userAgent: "test", reputation: reputation(verdicts) });
  const answer = (url: string, redirects: string[] = []) =>
    fetched.mockResolvedValueOnce({ status: 200, url, redirects, challenge: false });

  beforeEach(() => fetched.mockReset());

  it("follows the link and remembers where it leads", async () => {
    answer("https://example.org/new", ["https://example.org/old"]);
    expect(
      await inspect("https://example.org/old", {
        "https://example.org/old": "safe",
        "https://example.org/new": "safe",
      }),
    ).toEqual({
      decision: "allow",
      reasons: [],
      finalUrl: "https://example.org/new",
      reputation: "safe",
    });
    expect(fetched).toHaveBeenCalledWith("https://example.org/old", expect.objectContaining({ method: "HEAD" }));
  });

  it("checks the final address with the same rules", async () => {
    answer("https://bit.ly/x", ["https://example.org/go"]);
    expect(await inspect("https://example.org/go")).toMatchObject({
      decision: "reject",
      reasons: ["final.url.shortener"],
      message: "urlShortener",
    });

    answer("https://www.xvideos.com/", ["https://example.org/go"]);
    expect(await inspect("https://example.org/go")).toMatchObject({ decision: "reject", message: "urlBlocked" });

    answer("https://drive.google.com/file/d/1", ["https://example.org/go"]);
    expect(await inspect("https://example.org/go")).toMatchObject({
      decision: "needs_review",
      reasons: ["final.url.category:file_hosting"],
    });
  });

  it("refuses links that redirect into a private network", async () => {
    fetched.mockRejectedValueOnce(new SafeFetchError("blocked_address", "http://10.0.0.1/"));
    expect(await inspect("https://example.org/go")).toMatchObject({ decision: "reject", message: "urlNotPublic" });
  });

  it("holds long redirect chains and lets unreachable sites through", async () => {
    fetched.mockRejectedValueOnce(new SafeFetchError("too_many_redirects", "https://example.org/4"));
    expect(await inspect("https://example.org/1")).toMatchObject({
      decision: "needs_review",
      reasons: ["url.redirect_chain"],
    });

    fetched.mockRejectedValueOnce(new SafeFetchError("timeout", "https://example.org/slow"));
    expect(await inspect("https://example.org/slow")).toEqual({
      decision: "allow",
      reasons: [],
      finalUrl: null,
      reputation: "unknown",
    });
  });

  it("refuses links the reputation service flags", async () => {
    answer("https://example.org/malware", ["https://example.org/ok"]);
    expect(await inspect("https://example.org/ok", { "https://example.org/malware": "flagged" })).toMatchObject({
      decision: "reject",
      message: "urlUnsafe",
      reputation: "flagged",
    });
  });
});
