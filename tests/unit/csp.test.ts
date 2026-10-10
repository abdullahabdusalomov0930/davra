import { describe, expect, it } from "vitest";

import { buildCsp } from "@/lib/security/csp";

const base = { nonce: "abc123", supabaseUrl: "https://xyz.supabase.co/some/path" };

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

  it("allows the Supabase origin (not the full URL) for API calls only", () => {
    const csp = buildCsp({ ...base, isDev: false });
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://xyz.supabase.co");
    expect(csp).not.toContain("/some/path");
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
