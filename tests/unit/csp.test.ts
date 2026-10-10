import { describe, expect, it } from "vitest";

import { buildCsp } from "@/lib/security/csp";

const base = { nonce: "abc123" };

function directive(csp: string, name: string) {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
}

describe("buildCsp", () => {
  it("locks scripts to the nonce with strict-dynamic in production", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    const csp = buildCsp({ ...base, isDev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("lets the browser talk to the site only (authentication runs on the server)", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'");
  });

  it("allows Cloudflare Turnstile's frame only when it is configured", () => {
    expect(directive(buildCsp({ ...base, isDev: false, turnstile: true }), "frame-src")).toBe(
      "frame-src https://challenges.cloudflare.com",
    );
  });

  it("loads images only from the site itself (no user uploads, no third-party icons)", () => {
    expect(directive(buildCsp({ ...base, isDev: false }), "img-src")).toBe("img-src 'self' data:");
  });

  it("blocks plugins, framing and foreign base URIs", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });
});
