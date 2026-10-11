import { describe, expect, it } from "vitest";

import { buildCsp } from "@/lib/security/csp";

import { checkSecurityHeaders, parseCsp } from "../../scripts/security-smoke";

const productionCsp = buildCsp({ nonce: "bm9uY2U=", isDev: false });

/** What next.config.ts and src/proxy.ts send with a page today. */
function pageHeaders(overrides: Record<string, string | null> = {}): Headers {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": productionCsp,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  });
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
}

const withCsp = (csp: string) => checkSecurityHeaders(pageHeaders({ "Content-Security-Policy": csp }), { html: true });

describe("checkSecurityHeaders", () => {
  it("accepts the headers the app sends", () => {
    expect(checkSecurityHeaders(pageHeaders(), { html: true })).toEqual([]);
  });

  it("does not require a CSP on non-HTML responses such as robots.txt", () => {
    const headers = pageHeaders({ "Content-Type": "text/plain", "Content-Security-Policy": null });
    expect(checkSecurityHeaders(headers, { html: false })).toEqual([]);
    expect(checkSecurityHeaders(headers, { html: true })).toEqual(["Content-Security-Policy: missing"]);
  });

  it.each([
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
  ])("reports a missing %s", (name) => {
    expect(checkSecurityHeaders(pageHeaders({ [name]: null }), { html: false })).toEqual([`${name}: missing`]);
  });

  it("reports weak values of the static headers", () => {
    const problems = checkSecurityHeaders(
      pageHeaders({
        "Strict-Transport-Security": "max-age=3600",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "unsafe-url",
        "Permissions-Policy": "camera=(self), microphone=()",
        "Cross-Origin-Opener-Policy": "unsafe-none",
      }),
      { html: false },
    );
    expect(problems).toEqual([
      "Strict-Transport-Security: max-age under one year",
      "Strict-Transport-Security: no includeSubDomains",
      "Referrer-Policy: expected strict-origin-when-cross-origin, got unsafe-url",
      "Cross-Origin-Opener-Policy: expected same-origin, got unsafe-none",
      "X-Frame-Options: expected DENY, got SAMEORIGIN",
      "Permissions-Policy: camera is not disabled",
      "Permissions-Policy: geolocation is not disabled",
    ]);
  });

  it("flags X-Powered-By", () => {
    expect(checkSecurityHeaders(pageHeaders({ "X-Powered-By": "Next.js" }), { html: true })).toEqual([
      "X-Powered-By: should not be sent",
    ]);
  });

  it("flags the development CSP ('unsafe-eval')", () => {
    const devCsp = buildCsp({ nonce: "bm9uY2U=", isDev: true });
    expect(withCsp(devCsp)).toEqual(["CSP script-src: allows 'unsafe-eval'"]);
  });

  it("requires the important CSP directives", () => {
    expect(withCsp("script-src 'self' 'nonce-abc' 'strict-dynamic'")).toEqual([
      "CSP default-src: expected 'self' or 'none', got nothing",
      "CSP object-src: expected 'none', got nothing",
      "CSP base-uri: expected 'self' or 'none', got nothing",
      "CSP form-action: expected 'self' or 'none', got nothing",
      "CSP frame-ancestors: expected 'none', got nothing",
    ]);
  });

  it("rejects loosened CSP directives", () => {
    const loose = productionCsp
      .replace("default-src 'self'", "default-src *")
      .replace("frame-ancestors 'none'", "frame-ancestors 'self' https://example.com")
      .replace(/script-src [^;]+/, "script-src 'self' 'unsafe-inline' https:");
    expect(withCsp(loose)).toEqual([
      "CSP default-src: expected 'self' or 'none', got *",
      "CSP frame-ancestors: expected 'none', got 'self' https://example.com",
      "CSP script-src: no nonce",
      "CSP script-src: no 'strict-dynamic'",
      "CSP script-src: allows 'unsafe-inline' https:",
    ]);
  });
});

describe("parseCsp", () => {
  it("splits directives and keeps the first of a repeated one, as browsers do", () => {
    const csp = parseCsp("default-src 'self'; object-src 'none'; object-src *;  upgrade-insecure-requests");
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("upgrade-insecure-requests")).toEqual([]);
  });
});
